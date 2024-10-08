import express from 'express';
import bodyParser from 'body-parser';
import child from 'child_process';
import fs from 'fs';
import snowflakeId from 'snowflake-id';
import http from 'http';
import cors from 'cors';
import httpproxy from 'http-proxy';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { initAuth } from '@propelauth/express';
import cookieParser from 'cookie-parser';

import Chatbot from './chatbot.js';

const proxy = httpproxy.createProxyServer({ws: true});

// Initialize snowflake
const snowflake = new snowflakeId.default({
    mid : 42,
    offset : (2019-1970)*31536000*1000
});

const PORT = process.env.PORT || 3000;

const DEFAULT_VM = {
    name: 'New VM',
    os: 'windows-11',
    memory: 8192,
    cores: 4,
    disk: 32
};

const { requireUser } = initAuth({ authUrl: process.env.PROPEL_AUTH_URL, apiKey: process.env.PROPEL_AUTH_KEY });

const WINDOWS_VERSIONS = {
    'windows-11': 'win11',
    'windows-10': 'win10',
    'windows-8': 'win8',
    'windows-7': 'win7',
    'windows-vista': 'vista',
    'windows-xp': 'winxp',
};

const MACOS_VERSIONS = {
    'macos-sonomoa': 'sonoma',
    'macos-ventura': 'ventura',
    'macos-monterey': 'monterey',
    'macos-big-sur': 'big-sur',
}

let vms = fs.existsSync('data/vms.json') ? JSON.parse(fs.readFileSync('data/vms.json').toString()) : [];
let sessions = [];

/*=========================================
            Helper Functions
=========================================*/
function RunCommand(command) {
    return new Promise( (Resolve, Reject) => {
        child.exec(command, (error, stdout, stderr) => {
            if(error || stderr?.length)
                Reject({ error, stderr });
            else
                Resolve(stdout);
        })
    });
}

/*=========================================
        Container Management
=========================================*/
async function CreateVMContainer(vm) {
    console.log(`Creating VM "${vm.name}" (${vm.id})`);

    let creationCommand = '';
    let genericConfig = `--name vm-${vm.id} --device /dev/kvm --cap-add NET_ADMIN --restart unless-stopped --stop-timeout 30`;
    let env = `--env PUID=1000 --env PGID=1000 --env DISK_SIZE=${vm.disk}GB --env RAM_SIZE=${vm.memory}M --env CPU_CORES=${vm.cores}`;

    if(!fs.existsSync(`data/vms/${vm.id}`))
        fs.mkdirSync(`data/vms/${vm.id}`);

    if(vm.os in WINDOWS_VERSIONS) {
        creationCommand = `docker create ${genericConfig} ${env} --volume ${process.env.DATA}/vms/${vm.id}:/storage --env USERNAME=instapc --env PASSWORD=instapc --env VERSION=${WINDOWS_VERSIONS[vm.os]} dockurr/windows`;
    } else if(vm.os in MACOS_VERSIONS) {
        creationCommand = `docker create ${genericConfig} ${env} --volume ${process.env.DATA}/vms/${vm.id}:/storage --env VERSION=${MACOS_VERSIONS[vm.os]} dockurr/macos`;
    } else if(fs.existsSync(`data/images/${vm.os}.qcow2`)) {
        if(!fs.existsSync(`data/vms/${vm.id}/data.qcow2`))
            fs.copyFileSync(`data/images/${vm.os}.qcow2`, `data/vms/${vm.id}/data.qcow2`);

        creationCommand = `docker create ${genericConfig} ${env} --volume ${process.env.DATA}/vms/${vm.id}/data.qcow2:/boot.qcow2 qemux/qemu-docker`;
    } else {
        throw "Unknown VM Type";
    }

    return await RunCommand(creationCommand);
}

async function UpdateVMContainer(vm) {
    await DeleteVMContainer(vm, false);
    await CreateVMContainer(vm);
}

async function DeleteVMContainer(vm, cleanupFiles = true) {
    await StopVM(vm);

    console.log(`Deleting VM "${vm.name}" (${vm.id})`);

    await RunCommand(`docker rm vm-${vm.id}`).catch(error => {
        if(error.stderr.match('No such container'))
            return;

        throw error;
    });

    if(cleanupFiles)
        if(fs.existsSync(`data/vms/${vm.id}`))
            fs.rmSync(`data/vms/${vm.id}`, { recursive: true, force: true });
}

async function StartVM(vm) {
    console.log(`Starting VM "${vm.name}" (${vm.id})`);

    if(JSON.parse((await RunCommand(`docker inspect vm-${vm.id}`).catch(() => null)))?.State?.Running)
        return;

    await RunCommand(`docker network disconnect instapc vm-${vm.id}`).catch(() => {});
    await RunCommand(`docker network disconnect bridge vm-${vm.id}`).catch(() => {});
    await RunCommand(`docker network connect instapc vm-${vm.id}`).catch(() => {});
    await RunCommand(`docker start vm-${vm.id}`).catch(error => {
        if(error.stderr.match('No such container'))
            CreateVMContainer(vm).then(() => StartVM(vm));

        throw error;
    });
}

function StopVM(vm) {
    console.log(`Stopping VM "${vm.name}" (${vm.id})`);
    
    return RunCommand(`docker stop vm-${vm.id}`).catch(error => {
        if(error.stderr.match('No such container'))
            return;

        throw error;
    });
}

/*=========================================
        Middleware
=========================================*/

function EnsureVMOwnership(req, res, next) {
    let vm = vms.find(vm => vm.id === req.params.id);

    if(!vm)
        return res.sendStatus(404);

    if(vm.owner !== req.user.userId)
        return res.sendStatus(403);

    req.vm = vm;
    next();
}


/*=========================================
            Routes
=========================================*/
async function GetVMs(req, res) {
    res.json(vms.filter(vm => vm.owner === req.user.userId));
}

async function GetVM(req, res) {
    res.json(req.vm);
}

async function GetVMStatus(req, res) {
    RunCommand(`docker inspect vm-${req.vm.id}`).then(result => {
        res.json(JSON.parse(result)[0].State.Running ? 1 : 0);
    }).catch(() => {
        res.sendStatus(500);
    })
}

async function PostVMStart(req, res) {
    StartVM(req.vm).then(() => {
        res.sendStatus(204);
    }).catch(err => {
        console.error(err);
        res.sendStatus(500);
    });
}

async function PostVMStop(req, res) {
    StopVM(req.vm).then(() => {

        sessions.filter(session => session.vm === req.vm.id && session.closeTimeout).forEach(session => {
            clearTimeout(session.closeTimeout);
        });
        sessions = sessions.filter(session => session.vm !== req.vm.id);

        res.sendStatus(204);
    }).catch(err => {
        console.error(err);
        res.sendStatus(500);
    });
}

async function PostVM(req, res) {
    req.body.vm = {
        ...DEFAULT_VM,
        ...req.body.vm
    };
    req.body.vm.id = snowflake.generate();
    req.body.vm.owner = req.user.userId;

    vms.push(req.body.vm);
    CreateVMContainer(req.body.vm).then(() => StartVM(req.body.vm)).then(() => {
        res.json(req.body.vm);
    }).catch(() => {
        res.sendStatus(500);
    })
}

async function PatchVM(req, res) {
    if(!req.body.vm)
        return res.sendStatus(400);

    for(let property of ['name', 'memory', 'cores', 'disk'])
        if(req.body.vm[property] !== undefined)
            req.vm[property] = req.body.vm[property];

    UpdateVMContainer(req.vm).then(() => {
        res.sendStatus(204);
    }).catch(() => {
        res.sendStatus(500);
    })
}

async function DeleteVM(req, res) {
    DeleteVMContainer(req.vm).then(() => {
        sessions.filter(session => session.vm === req.vm.id && session.closeTimeout).forEach(session => {
            clearTimeout(session.closeTimeout);
        });

        vms = vms.filter(vm => vm.id !== req.vm.id);
        sessions = sessions.filter(session => session.vm !== req.vm.id);

        res.sendStatus(204);
    }).catch(() => {
        res.sendStatus(500);
    })
    
}

async function PostVMConnect(req, res) {
    StartVM(req.vm).then(() => {
        let session = sessions.find(session => session.user === req.user.userId && session.vm === req.vm.id);
        if(!session) {
            const id = snowflake.generate();
            session = {
                id,
                vm: req.vm.id,
                user: req.user.userId,
                proxy: createProxyMiddleware({
                    target: `http://vm-${req.vm.id}:8006/`,
                    changeOrigin: true
                })
            };
            sessions.push(session);
        }
        
        if(session.closeTimeout) {
            clearTimeout(session.closeTimeout);
            delete session.closeTimeout;
        }

        setTimeout(() => res.json(session.id), 250);
    }).catch(err => {
        console.error(err);
        res.sendStatus(500);
    });
    
}

function onWebsocketOpen(req, socket, head) {
    socket.destroy();
}

function onWebsocketClose(req, socket, head) {
    let session = sessions.find(session => session.id === socket.id);
    if(session) {
        session.closeTimeout = setTimeout(() => {
            sessions = sessions.filter(s => s.id !== session.id);
            StopVM(vms.find(vm => vm.id === session.vm)).catch(() => {});
        }, process.env.VM_TIMEOUT);
    }
}

function VNCProxy(req, res, next) {
    let session;

    if(req.query.session) {
        res.cookie('session', req.query.session);
        session = sessions.find(session => session.id === req.query.session);
        
        if(!session)
            return res.sendStatus(404);

        server.removeListener('upgrade', onWebsocketOpen);
        server.once('upgrade', (req, socket, head) => {
            proxy.once('open', socket => {
                socket.id = session.id;
            });
            proxy.ws(req, socket, { ...head, target: `http://vm-${session.vm}:8006/`});
            server.on('upgrade', onWebsocketOpen);
        });

    } else {
        session = sessions.find(session => session.id === req.cookies.session);
    }

    if(!session)
        return res.sendStatus(404);

    session.proxy(req, res, next);
}

/*=========================================
            Express Setup
=========================================*/
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/vm/', requireUser);
app.use('/vms/', requireUser);
app.post('/chatbot', requireUser, Chatbot);
app.use('/vm/:id', EnsureVMOwnership);
app.get('/vms', GetVMs);
app.get('/vm/:id', GetVM);
app.get('/vm/:id/status', GetVMStatus);
app.post('/vm/:id/start', PostVMStart);
app.post('/vm/:id/stop', PostVMStop);
app.post('/vm/:id/connect', PostVMConnect);
app.post('/vm/', PostVM);
app.patch('/vm/:id', PatchVM);
app.delete('/vm/:id', DeleteVM);
app.use('/', VNCProxy);

proxy.on('close', onWebsocketClose);
server.on('upgrade', onWebsocketOpen);

server.listen(PORT, async() => {
    console.log(`InstaPC API is running on port ${PORT}`);
});

[`SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`].forEach((eventType) => {
    process.on(eventType, (...data) => {
        console.log(`Shutting down due to ${eventType}`);
        if(eventType === 'uncaughtException')
            for(let elem of data)
                console.error(elem);

        // Savews data
        console.log('Saving VM Data...');
        fs.writeFileSync('data/vms.json', JSON.stringify(vms, null, 2));

        // Stops all VMs
        console.log('Stopping VMs...');
        Promise.all(vms.map(vm => StopVM(vm))).then(() => process.exit(0)).catch(() => process.exit(1));
    });
})
// Interfaces of database entities

export const MIN_MEM = 2048;
export const MAX_MEM = 16384;
export const MIN_CORES = 1;
export const MAX_CORES = 8;
export const MIN_DISK = 16;
export const MAX_DISK = 64;

export enum OS {
    Win11 = "windows-11",
    Win10 = "windows-10",
    Win8 = "windows-8",
    Win7 = "windows-7",
    WinVista = "windows-vista",
    WinXP = "windows-xp",
    Arch = "arch-basic",
    ArchKDE = "arch-kde",
    Elementary = "elementary",
    Mint= "mint",
    Ubuntu2004 = "ubuntu-20.04",
    Ubuntu2404 = "ubuntu-24.04",
    MacSonomoa = "macos-sonoma",
    MacVentura = "macos-ventura",
    MacMonterey = "macos-monterey",
    MacBigSur = "macos-big-sur",
}

export const OS_UI_NAMES = {
    [OS.Win11]: "Windows 11",
    [OS.Win10]: "Windows 10",
    [OS.Win8]: "Windows 10",
    [OS.Win7]: "Windows 7",
    [OS.WinVista]: "Windows Vista",
    [OS.WinXP]: "Windows XP",
    [OS.Arch]: "Arch (Barebones)",
    [OS.ArchKDE]: "Arch (KDE)",
    [OS.Elementary]: "Elementary",
    [OS.Mint]: "Mint",
    [OS.Ubuntu2004]: "Ubuntu 20.04",
    [OS.Ubuntu2404]: "Ubuntu 24.04",
    [OS.MacSonomoa]: "Mac OS (Sonomoa)",
    [OS.MacVentura]: "Mac OS (Ventura)",
    [OS.MacMonterey]: "Mac OS (Monterey)",
    [OS.MacBigSur]: "Mac OS (Big Sur)"
}

export interface VMData {
    name: string;
    os: OS;
    memory: number;
    cores: number;
    disk: number;
    id: string;
    owner: string;
}
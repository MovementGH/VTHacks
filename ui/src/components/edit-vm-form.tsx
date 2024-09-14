import {z} from "zod";
import VMForm, { vmFormSchema } from "./vm-form";
import { OS, VMData, OS_UI_NAMES } from "@/entities";
import { API_ROUTE } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast"

export default function EditVMForm({ fetchVMs }: { fetchVMs: () => void}) {
  const { toast } = useToast();

  function onSubmit(values: z.infer<typeof vmFormSchema>) {
    const body = {
        "vm": values
    }
    console.log("test");

    fetch(`${API_ROUTE}/vm`, { 
        method: "POST",
        body: JSON.stringify(body),
        headers: {'content-type': 'application/json'}
    })
        .then((res) => {
            if (res.status == 200) {
                toast({
                    description: `Succsefully created PC ${values.name} (${OS_UI_NAMES[values.os]})`
                });
                fetchVMs();
            }
        })
        .catch((err) => console.log(err))
  }

  return (
    <VMForm
      defaultValues={{
        name: "My PC",
        os: OS.Win11,
        memory: 4096,
        cores: 2,
        disk: 32,
      } as VMData}
      onSubmit={onSubmit}
    />
  )
}
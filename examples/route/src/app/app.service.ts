"use public";

import { Injectable, Signature } from "@kithinji/orca";
import { 
  appCreateInput, 
  appCreateOutput 
} from "./schemas/create";
import { 
  appGetInput, 
  appGetOutput 
} from "./schemas/get";
import { 
  appUpdateInput, 
  appUpdateOutput 
} from "./schemas/update";
import { appListOutput } from "./schemas/list";
import { 
  appDeleteInput, 
  appDeleteOutput 
} from "./schemas/delete";

@Injectable()
export class AppService {
    private items: any[] = [];

    @Signature(appCreateInput, appCreateOutput)
    public async create(input: any) {
        const item = {
            id: crypto.randomUUID(),
            ...input,
            createdAt: new Date(),
        };
        this.items.push(item);
        return item;
    }

    @Signature(appGetInput, appGetOutput)
    public async get(input: any) {
        const item = this.items.find((i) => i.id === input.id);
        if (!item) {
            throw new Error("Item not found");
        }
        return item;
    }

    @Signature(appListOutput)
    public async list() {
        return this.items;
    }

    @Signature(appUpdateInput, appUpdateOutput)
    public async update(input: any) {
        const index = this.items.findIndex((i) => i.id === input.id);
        if (index === -1) {
            throw new Error("Item not found");
        }
        
        this.items[index] = {
            ...this.items[index],
            ...input,
            updatedAt: new Date(),
        };
        
        return this.items[index];
    }

    @Signature(appDeleteInput, appDeleteOutput)
    public async delete(input: any) {
        const index = this.items.findIndex((i) => i.id === input.id);
        if (index === -1) {
            throw new Error("Item not found");
        }
        
        const deleted = this.items.splice(index, 1)[0];
        return deleted;
    }
}

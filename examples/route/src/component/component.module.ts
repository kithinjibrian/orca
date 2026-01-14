import { Module } from "@kithinji/orca";
import { Button } from "./component/button.component";


@Module({
    imports: [],
    providers: [],
    declarations: [Button],
    exports: [Button],
})
export class ComponentModule {}

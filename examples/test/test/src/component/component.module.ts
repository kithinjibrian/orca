import { Module } from "@kithinji/orca";
import { Button } from "./component/button.component";
import { Input } from "./component/input.component";
import { Form } from "./component/form.component";

@Module({
  imports: [],
  providers: [],
  declarations: [Button, Input, Form],
  exports: [Button, Input, Form],
})
export class ComponentModule {}

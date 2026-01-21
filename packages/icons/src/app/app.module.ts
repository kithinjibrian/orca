import { Module } from "@kithinji/orca";
import { Home } from "./components/home.component";

@Module({
  declarations: [Home],
  exports: [Home],
})
export class IconsModule {}

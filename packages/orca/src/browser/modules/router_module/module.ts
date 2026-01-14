import { DynamicModule } from "@/shared";
import { Navigate } from "./navigate";
import { RouterOutlet } from "./outlet";

export class RouterModule {
  static forRoot(): DynamicModule {
    return {
      module: RouterModule,
      declarations: [RouterOutlet],
      providers: [Navigate],
      exports: [Navigate, RouterOutlet],
    };
  }
}

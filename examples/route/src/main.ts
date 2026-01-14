import { NodeFactory } from "@kithinji/orca";
import { AppModule } from "./app/app.module";

async function bootstrap() {
  const app = await NodeFactory.create(AppModule);
  app.listen(8080, () => {
    console.log("Server started");
  });
}

bootstrap();

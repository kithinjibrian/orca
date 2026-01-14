import {
  DynamicModule,
  EXPRESS_ADAPTER_HOST,
  Inject,
  Injectable,
} from "@/shared";
import express, { type Express } from "express";
import * as path from "path";
import * as fs from "fs";

interface Options {
  rootPath: string;
}

export class ServeStaticModule {
  static forRoot(options: Options): DynamicModule {
    @Injectable()
    class ServeStaticService {
      constructor(
        @Inject(EXPRESS_ADAPTER_HOST, { maybe: true })
        private readonly app?: Express
      ) {
        if (!this.app) throw new Error("Couldn't find Express adapter!");

        const resolvedPath = path.resolve(options.rootPath);
        const indexPath = path.join(resolvedPath, "index.html");

        this.app.use(express.static(resolvedPath));

        this.app.get(/.*/, (req, res) => {
          res.sendFile(indexPath);
        });
      }
    }

    return {
      module: ServeStaticModule,
      providers: [
        {
          provide: ServeStaticService,
          useClass: ServeStaticService,
          eager: true,
        },
      ],
      exports: [ServeStaticService],
    };
  }
}

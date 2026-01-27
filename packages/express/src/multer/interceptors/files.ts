import {
  CallHandler,
  Constructor,
  ExecutionContext,
  OrcaInterceptor,
  mixin,
} from "@kithinji/orca";
import multer from "multer";
import { MulterOptions } from "../types/options";
import { Observable } from "rxjs";

type MulterInstance = any;

export function FilesInterceptor(
  fieldName: string,
  maxCount?: number,
  localOptions?: MulterOptions,
): Constructor<OrcaInterceptor> {
  class MixinInterceptor implements OrcaInterceptor {
    protected multer: MulterInstance;

    constructor() {
      this.multer = (multer as any)({
        ...localOptions,
      });
    }

    async intercept(
      context: ExecutionContext,
      next: CallHandler<any>,
    ): Promise<Observable<any>> {
      const ctx = context.switchToHttp();

      await new Promise<void>((resolve, reject) =>
        this.multer.array(fieldName, maxCount)(
          ctx.getRequest(),
          ctx.getResponse(),
          (err: any) => {
            if (err) {
              return reject(err);
            }

            resolve();
          },
        ),
      );

      return next.handle();
    }
  }

  let Interceptor = mixin(MixinInterceptor);

  return Interceptor;
}

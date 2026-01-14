import { Controller, from, interval, Observable, Sse } from "@kithinji/orca";

@Controller()
export class AppController {
  get(): Observable<number> {
    return interval(1000);
  }
}

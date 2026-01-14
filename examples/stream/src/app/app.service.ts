"use public";

import {
  Injectable,
  observable,
  Observable,
} from "@kithinji/orca";

@Injectable()
export class AppService {
  public stream(): Observable<number> {
    return observable((obs) => {
      let id = 0;
      setInterval(() => {
        obs.next(`hello, mum ${id}`);
        id++;
      }, 1000);
    });
  }
}

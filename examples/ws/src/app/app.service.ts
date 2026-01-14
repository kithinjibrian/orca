"use public";

import { Injectable, Subject } from "@kithinji/orca";

@Injectable()
export class AppService {
  public subject(): Subject<number> {
    const subject = new Subject();
    
    return subject;
  }
}

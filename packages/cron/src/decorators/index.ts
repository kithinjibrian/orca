import { CronJobParams } from "cron";
import { SetMetadata, applyDecorators } from "@kithinji/orca";
import {
  SCHEDULE_CRON_OPTIONS,
  SCHEDULER_NAME,
  SCHEDULER_TYPE,
} from "@/symbol";
import { SchedulerType } from "@/type";

export type CronOptions = {
  name?: string;
  timeZone?: unknown;
  utcOffset?: unknown;
  unrefTimeout?: boolean;
  waitForCompletion?: boolean;
  disabled?: boolean;
  threshold?: number;
} & (
  | {
      timeZone?: string;
      utcOffset?: never;
    }
  | {
      timeZone?: never;
      utcOffset?: number;
    }
);

export function Cron(
  cronTime: CronJobParams["cronTime"],
  options: CronOptions = {},
): MethodDecorator {
  const name = options?.name;
  return applyDecorators(
    SetMetadata(SCHEDULE_CRON_OPTIONS, {
      ...options,
      cronTime,
    }),
    SetMetadata(SCHEDULER_NAME, name),
    SetMetadata(SCHEDULER_TYPE, SchedulerType.CRON),
  );
}

// utils/timezone.ts
import { DateTime } from "luxon";

export function getKarachiTime(date?: Date | string): Date {
  if (date) {
    return DateTime.fromJSDate(new Date(date))
      .setZone("Asia/Karachi")
      .toJSDate();
  } else {
    return DateTime.now()
      .setZone("Asia/Karachi")
      .toJSDate();
  }
}

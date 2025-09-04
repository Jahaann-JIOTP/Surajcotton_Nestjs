import { DateTime } from 'luxon';
import { BadRequestException } from '@nestjs/common';

export type TimeRangerange =
  | 'Today'
  | 'Yesterday'
  | 'Week'
  | 'Last Week'
  | 'Month'
  | 'Last Month'
  | 'Year'
  | 'Last Year'
  | 'Quarter'
  | 'Last Quarter'
  | 'Last 3 Calendar Days'
  | 'Last 72 Hours';

export interface TimeRange {
  start: string;
  end: string;
}

export interface TimeRangePayload {
  range?: TimeRangerange;
  date?: string;
  from?: string;
  to?: string;
  startTime?: string; // HH:mm:ss
  endTime?: string; // HH:mm:ss
  timezone?: string; // default Asia/Karachi
}

export function getTimeRange(payload: TimeRangePayload): TimeRange {
  const timezone = payload.timezone || 'Asia/Karachi';
  const now = DateTime.now().setZone(timezone);

  let start: DateTime;
  let end: DateTime;

  // ---------- Helpers ----------
  const applyTime = (
    base: DateTime,
    time?: string,
    fallback: 'start' | 'end' = 'start',
  ) => {
    if (!time) {
      return fallback === 'start' ? base.startOf('day') : base.endOf('day');
    }
    const [hh, mm, ss] = time.split(':').map(Number);
    return base.set({ hour: hh, minute: mm || 0, second: ss || 0 });
  };

  // ---------- Case 1: From-To Range ----------
  if (payload.from || payload.to) {
    if (payload.from && payload.to) {
      const fromDate = DateTime.fromISO(payload.from, { zone: timezone });
      const toDate = DateTime.fromISO(payload.to, { zone: timezone });

      if (!fromDate.isValid || !toDate.isValid) {
        throw new BadRequestException(
          `Invalid from/to format, must be YYYY-MM-DD`,
        );
      }
      if (toDate < fromDate) {
        throw new BadRequestException(`"to" date cannot be before "from" date`);
      }

      start = applyTime(fromDate, payload.startTime, 'start');
      end = applyTime(toDate, payload.endTime, 'end');
      return { start: start.toISO() ?? '', end: end.toISO() ?? '' };
    }

    // only from
    if (payload.from) {
      const fromDate = DateTime.fromISO(payload.from, { zone: timezone });
      if (!fromDate.isValid)
        throw new BadRequestException(`Invalid from format`);
      start = applyTime(fromDate, payload.startTime, 'start');
      end = applyTime(fromDate, payload.endTime, 'end');
      return { start: start.toISO() ?? '', end: end.toISO() ?? '' };
    }

    // only to
    if (payload.to) {
      const toDate = DateTime.fromISO(payload.to, { zone: timezone });
      if (!toDate.isValid) throw new BadRequestException(`Invalid to format`);
      start = applyTime(toDate, payload.startTime, 'start');
      end = applyTime(toDate, payload.endTime, 'end');
      return { start: start.toISO() ?? '', end: end.toISO() ?? '' };
    }
  }

  // ---------- Case 2: Single Date ----------
  if (payload.date) {
    const date = DateTime.fromISO(payload.date, { zone: timezone });
    if (!date.isValid) throw new BadRequestException(`Invalid date format`);
    start = applyTime(date, payload.startTime, 'start');
    end = applyTime(date, payload.endTime, 'end');
    return { start: start.toISO() ?? '', end: end.toISO() ?? '' };
  }

  // ---------- Case 3: range ----------
  if (payload.range) {
    switch (payload.range) {
      case 'Today':
        start = now.startOf('day');
        end = now.endOf('day');
        break;
      case 'Yesterday':
        start = now.minus({ days: 1 }).startOf('day');
        end = now.minus({ days: 1 }).endOf('day');
        break;
      case 'Week':
        start = now.startOf('week');
        end = now.endOf('week');
        break;
      case 'Last Week':
        start = now.minus({ weeks: 1 }).startOf('week');
        end = now.minus({ weeks: 1 }).endOf('week');
        break;
      case 'Month':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case 'Last Month':
        start = now.minus({ months: 1 }).startOf('month');
        end = now.minus({ months: 1 }).endOf('month');
        break;
      case 'Year':
        start = now.startOf('year');
        end = now.endOf('year');
        break;
      case 'Last Year':
        start = now.minus({ years: 1 }).startOf('year');
        end = now.minus({ years: 1 }).endOf('year');
        break;
      case 'Quarter':
        start = now.startOf('quarter');
        end = now.endOf('quarter');
        break;
      case 'Last Quarter':
        start = now.minus({ quarters: 1 }).startOf('quarter');
        end = now.minus({ quarters: 1 }).endOf('quarter');
        break;

      // Last 3 calendar days (example: Aug 25 00:00 → Aug 27 23:59 if today is Aug 27)
      case 'Last 3 Calendar Days':
        start = now.minus({ days: 3 }).startOf('day');
        end = now.endOf('day');
        break;

      // Last rolling 72 hours (example: Aug 24 16:00 → Aug 27 16:00 if now is Aug 27 16:00)
      case 'Last 72 Hours':
        start = now.minus({ days: 3 });
        end = now;
        break;
      default:
        throw new BadRequestException(`Invalid range`);
    }

    start = applyTime(start, payload.startTime, 'start');
    end = applyTime(end, payload.endTime, 'end');
    return { start: start.toISO() ?? '', end: end.toISO() ?? '' };
  }

  throw new BadRequestException('Payload must contain date, range, or range');
}

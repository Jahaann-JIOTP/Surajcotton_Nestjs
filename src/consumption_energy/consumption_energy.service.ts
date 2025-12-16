
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';

import { consumption_energy } from './schemas/consumption_energy.schema';
import { Consumption_energyDto } from './dto/consumption_energy.dto';

/* ───────────────────────────────
   RESPONSE TYPES
─────────────────────────────── */

export interface HourlyData {
  Time: string;
  Today: number;
  Yesterday: number;
}

export interface WeeklyRow {
  Day: string;
  'This Week': number;
  'Last Week': number;
}

export interface MonthlyRow {
  Weeks: string;
  'This Month': number;
  'Last Month': number;
}

export interface YearlyRow {
  Month: string;
  'Current Year': number;
  'Previous Year': number;
}

/* ───────────────────────────────
   SERVICE
─────────────────────────────── */

@Injectable()
export class ConsumptionEnergyService {
  constructor(
    @InjectModel(consumption_energy.name, 'surajcotton')
    private readonly model: Model<consumption_energy>,
  ) {}

  /* ───────────────────────────────
     CENTRALIZED METER CONFIG
  ─────────────────────────────── */

  private readonly METER_GROUPS = {
    LT: [
      'U19_PLC_Del_ActiveEnergy',
      'U11_GW01_Del_ActiveEnergy',
    ],
    SOLAR: [
      'U6_GW02_Del_ActiveEnergy',
      'U17_GW03_Del_ActiveEnergy',
      'U24_GW01_Del_ActiveEnergy',
      'U28_PLC_Del_ActiveEnergy',
    ],
    HT: [
      'U22_PLC_Del_ActiveEnergy',
      'U26_PLC_Del_ActiveEnergy',
    ],
    WAPDA: [
      'U23_GW01_Del_ActiveEnergy',
      'U27_PLC_Del_ActiveEnergy',
    ],
  };

  private readonly ALL_KEYS = [
    ...this.METER_GROUPS.LT,
    ...this.METER_GROUPS.SOLAR,
    ...this.METER_GROUPS.HT,
    ...this.METER_GROUPS.WAPDA,
  ];

  /* ───────────────────────────────
     QUERY ROUTER
  ─────────────────────────────── */

  async handleQuery(query: Consumption_energyDto) {
    switch (query.value) {
      case 'today':
        return this.getTodayGeneration();
      case 'week':
        return this.getWeeklyGeneration();
      case 'month':
        return this.getMonthlyGeneration();
      case 'year':
        return this.getYearlyGeneration();
      default:
        return { error: 'Invalid value' };
    }
  }

  /* ───────────────────────────────
     CORE CONSUMPTION ENGINE
  ─────────────────────────────── */

  private async calculateConsumption(range: {
    start: string;
    end: string;
  }): Promise<number> {
    const projection = this.ALL_KEYS.reduce(
      (acc, k) => ({ ...acc, [k]: 1 }),
      { timestamp: 1 },
    );

    const data = await this.model.aggregate([
    {
      $match: {
        $expr: {
          $and: [
              { $gte: [{ $toDate: '$timestamp' }, new Date(range.start)] },
              { $lte: [{ $toDate: '$timestamp' }, new Date(range.end)] },
            ],
          },
        },
    },
    { $project: projection },
    { $sort: { timestamp: 1 } },
  ]);

    if (!data.length) return 0;

    const first = new Map<string, number>();
    const last = new Map<string, number>();

  for (const doc of data) {
      for (const key of this.ALL_KEYS) {
        const v = doc[key];
        if (typeof v === 'number') {
          if (!first.has(key)) first.set(key, v);
          last.set(key, v);
      }
    }
  }

    const sumGroup = (keys: string[]) =>
      keys.reduce((t, k) => {
        const s = first.get(k);
        const e = last.get(k);
        let d = s !== undefined && e !== undefined ? e - s : 0;
        if (d <= 0 || d > 1e12 || d < 1e-6) d = 0;
        return t + d;
      }, 0);

    const total =
      sumGroup(this.METER_GROUPS.LT) +
      sumGroup(this.METER_GROUPS.SOLAR) +
      sumGroup(this.METER_GROUPS.HT) +
      sumGroup(this.METER_GROUPS.WAPDA);

  return +total.toFixed(2);
}

  /* ───────────────────────────────
     WEEKLY (6AM → 6AM)
  ─────────────────────────────── */

  async getWeeklyGeneration(): Promise<WeeklyRow[]> {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const result: WeeklyRow[] = [];

    const monday = moment.tz('Asia/Karachi').startOf('week').add(1, 'day');

  for (let i = 0; i < 7; i++) {
      const start = monday.clone().add(i, 'days').hour(6).toISOString();
      const end = moment(start).add(1, 'day').toISOString();

    const [thisWeek, lastWeek] = await Promise.all([
        this.calculateConsumption({ start, end }),
        this.calculateConsumption({
          start: moment(start).subtract(7, 'days').toISOString(),
          end: moment(end).subtract(7, 'days').toISOString(),
        }),
    ]);

    result.push({
      Day: days[i],
        'This Week': thisWeek,
        'Last Week': lastWeek,
    });
  }

  return result;
}

  /* ───────────────────────────────
     DAILY HOURLY
  ─────────────────────────────── */

  private getDayRange(offset: number) {
    const start = moment.tz('Asia/Karachi').startOf('day').add(offset, 'days').hour(6);
    return {
      start: start.toDate(),
      end: start.clone().add(25, 'hours').toDate(),
    };
}


async getTodayGeneration(): Promise<HourlyData[]> {
    const today = this.getDayRange(0);
    const yesterday = this.getDayRange(-1);

    const fetch = (range: { start: Date; end: Date }) =>
      this.model.aggregate([
        { $addFields: { ts: { $toDate: '$timestamp' } } },
        { $match: { ts: { $gte: range.start, $lt: range.end } } },
        {
          $project: this.ALL_KEYS.reduce(
            (acc, k) => ({ ...acc, [k]: 1 }),
            { ts: 1 },
          ),
        },
        { $sort: { ts: 1 } },
      ]);

  const [todayData, yesterdayData] = await Promise.all([
      fetch(today),
      fetch(yesterday),
  ]);

    const calcHour = (data: any[], base: moment.Moment, h: number) => {
      const s = base.clone().add(h, 'hours');
      const e = s.clone().add(1, 'hour');
      let total = 0;

      for (const key of this.ALL_KEYS) {
        let first: number | undefined;
        let last: number | undefined;

        for (const d of data) {
          const t = moment(d.ts);
          if (t.isBetween(s, e, null, '[)') && typeof d[key] === 'number') {
            if (first === undefined) first = d[key];
            last = d[key];
          }
        }

        if (first !== undefined && last !== undefined) {
          const diff = last - first;
          if (diff > 0 && diff < 1e12) total += diff;
      }
    }

    return +total.toFixed(2);
  };

    const baseToday = moment(today.start).tz('Asia/Karachi');
    const baseYesterday = moment(yesterday.start).tz('Asia/Karachi');

    return Array.from({ length: 25 }).map((_, h) => ({
      Time: baseToday.clone().add(h, 'hours').format('YYYY-MM-DD HH:mm'),
      Today: calcHour(todayData, baseToday, h),
      Yesterday: calcHour(yesterdayData, baseYesterday, h),
    }));
}
  
  /* ───────────────────────────────
     MONTHLY
  ─────────────────────────────── */

  async getMonthlyGeneration(): Promise<MonthlyRow[]> {
    const labels = ['Week1', 'Week2', 'Week3', 'Week4'];
    const result: MonthlyRow[] = [];

    const now = moment.tz('Asia/Karachi');
    const prev = now.clone().subtract(1, 'month');

    const weeks = (m: moment.Moment) =>
      Array.from({ length: 4 }).map((_, i) => {
        const s = m.clone().startOf('month').startOf('week').add(1 + i * 7, 'day').hour(6);
        return { start: s.toISOString(), end: s.clone().add(7, 'days').toISOString() };
      });

    const w1 = weeks(now);
    const w2 = weeks(prev);

    for (let i = 0; i < 4; i++) {
    result.push({
        Weeks: labels[i],
        'This Month': await this.calculateConsumption(w1[i]),
        'Last Month': await this.calculateConsumption(w2[i]),
    });
  }

  return result;
}

  /* ───────────────────────────────
     YEARLY
  ─────────────────────────────── */

  async getYearlyGeneration(): Promise<YearlyRow[]> {
    const months = moment.monthsShort();
    const year = moment().year();
    const result: YearlyRow[] = [];

    for (let m = 0; m < 12; m++) {
      const start = moment.tz({ year, month: m, day: 1, hour: 6 }, 'Asia/Karachi');
      const end = start.clone().add(1, 'month');

    result.push({
        Month: months[m],
        'Current Year': await this.calculateConsumption({
          start: start.toISOString(),
          end: end.toISOString(),
        }),
        'Previous Year': await this.calculateConsumption({
          start: start.clone().subtract(1, 'year').toISOString(),
          end: end.clone().subtract(1, 'year').toISOString(),
        }),
    });
  }

  return result;
}
}

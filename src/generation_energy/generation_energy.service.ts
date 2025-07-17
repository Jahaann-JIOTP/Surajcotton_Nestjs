
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { generation_energy } from './schemas/generation_energy.schema';
import { generation_energyDto } from './dto/generation_energy.dto'; // Correct import for DTO

import * as moment from 'moment-timezone';

export interface HourlyData {
  Time: string;
  Today: number;
  Yesterday: number;
}

@Injectable()
export class GenerationEnergyService {
  constructor(
    @InjectModel(generation_energy.name, 'surajcotton') private readonly generationModel: Model<generation_energy>
  ) {}

  async handleQuery(query: generation_energyDto) {
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

private async calculateConsumption(range: { start: string; end: string }) {
  // Define all meter key arrays
  const DieselICKeys = ["U19_PLC_Del_ActiveEnergy"];
  const WapdaICKeys = ["U21_PLC_Del_ActiveEnergy"];
   const Solar1Keys = ["U6_GW02_Del_ActiveEnergy"];
   const Solar2Keys = ["U17_GW03_Del_ActiveEnergy"];
   const Wapda1Keys = ["U22_GW01_Del_ActiveEnergy"];
   const HTGenerationKeys = ['U20_GW03_Del_ActiveEnergy','U21_GW03_Del_ActiveEnergy','U23_GW01_Del_ActiveEnergy', 'U7_GW01_Del_ActiveEnergy',
      ];
  
  


  const allMeterKeys = [...DieselICKeys, ...WapdaICKeys, ...Solar1Keys, ...Solar2Keys, ...HTGenerationKeys];

  // ✅ Dynamically build meterSuffixMap from meter keys
  const meterSuffixMap: Record<string, string> = {};
  allMeterKeys.forEach(fullKey => {
    const [meterId, ...suffixParts] = fullKey.split("_");
    meterSuffixMap[meterId] = suffixParts.join("_");
  });

  // ✅ Build projection
  const projection: Record<string, number> = { timestamp: 1 };
  Object.entries(meterSuffixMap).forEach(([meterId, suffix]) => {
    projection[`${meterId}_${suffix}`] = 1;
  });

  // ✅ Fetch data from DB
  const data = await this.generationModel.aggregate([
    {
      $match: {
        timestamp: {
          $gte: range.start,
          $lte: range.end,
        },
      },
    },
    { $project: projection },
    { $sort: { timestamp: 1 } },
  ]);

  // ✅ Initialize first & last values
  const firstValues: Record<string, number | null> = {};
  const lastValues: Record<string, number | null> = {};
  Object.entries(meterSuffixMap).forEach(([meterId, suffix]) => {
    const key = `${meterId}_${suffix}`;
    firstValues[key] = null;
    lastValues[key] = null;
  });

  // ✅ Populate first/last values
  for (const doc of data) {
    Object.entries(meterSuffixMap).forEach(([meterId, suffix]) => {
      const key = `${meterId}_${suffix}`;
      const val = doc[key];
      if (typeof val === "number") {
        if (firstValues[key] === null) firstValues[key] = val;
        lastValues[key] = val;
      }
    });
  }

  // ✅ Compute consumption
  const consumption: Record<string, number> = {};
  Object.keys(firstValues).forEach(key => {
    if (firstValues[key] !== null && lastValues[key] !== null) {
      let diff = lastValues[key]! - firstValues[key]!;
      diff = diff >= 0 ? diff : 0; // no negative
      // Filter invalid (scientific notation / extreme) values
      if (diff > 1e12 || diff < 1e-6) diff = 0;
      consumption[key] = diff;
    } else {
      consumption[key] = 0;
    }
  });

  // ✅ Sum by group
  const sumByMeterGroup = (meterKeys: string[]) =>
    meterKeys.reduce((sum, fullKey) => {
      const [meterId, ...suffixParts] = fullKey.split("_");
      const key = `${meterId}_${suffixParts.join("_")}`;
      const value = consumption[key];
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

  // ✅ Calculate each group total
 const DieselIC = sumByMeterGroup(DieselICKeys);
  const WapdaIC = sumByMeterGroup(WapdaICKeys);
  const Solar1 = sumByMeterGroup(Solar1Keys);
  const Solar2 = sumByMeterGroup(Solar2Keys);
  const Wapda1 = sumByMeterGroup(Wapda1Keys);
  const HTGeneration = sumByMeterGroup(HTGenerationKeys);

  

  // ✅ Final totals
 const totalConsumption = DieselIC+ WapdaIC + Solar1 + Solar2 + Wapda1 +HTGeneration


// const total= totalConsumption + totalConsumption1
const total= totalConsumption


  return +total.toFixed(2);
}



// async getWeeklyGeneration() {
//   const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
//   const result: { Day: string; [key: string]: number | string }[] = [];

//   const now = moment().tz('Asia/Karachi');

//   // Get Monday of this week in Asia/Karachi
//   const mondayThisWeek = now.clone().startOf('week').add(1, 'day'); // Monday
//   if (mondayThisWeek.day() === 1) {
//     // Confirmed Monday
//     for (let i = 0; i < 7; i++) {
//       const thisDayStart = mondayThisWeek.clone().add(i, 'days').startOf('day');
//       const thisDayEnd = thisDayStart.clone().endOf('day');

//       const lastWeekStart = thisDayStart.clone().subtract(7, 'days');
//       const lastWeekEnd = thisDayEnd.clone().subtract(7, 'days');

//       const thisWeekConsumption = await this.calculateConsumption({
//         start: thisDayStart.toISOString(),
//         end: thisDayEnd.toISOString(),
//       });

//       const lastWeekConsumption = await this.calculateConsumption({
//         start: lastWeekStart.toISOString(),
//         end: lastWeekEnd.toISOString(),
//       });

//       result.push({
//         Day: days[i],
//         "This Week": +thisWeekConsumption.toFixed(2),
//         "Last Week": +lastWeekConsumption.toFixed(2),
//       });
//     }
//   }

//   return result;
// }
 

async calculateConsumption1(range: { start: string; end: string }): Promise<number> {
const DieselICKeys = ["U19_PLC_Del_ActiveEnergy"];
  const WapdaICKeys = ["U21_PLC_Del_ActiveEnergy"];
   const Solar1Keys = ["U6_GW02_Del_ActiveEnergy"];
   const Solar2Keys = ["U17_GW03_Del_ActiveEnergy"];
   const Wapda1Keys = ["U22_GW01_Del_ActiveEnergy"];
    const HTGenerationKeys = ['U20_GW03_Del_ActiveEnergy','U21_GW03_Del_ActiveEnergy','U23_GW01_Del_ActiveEnergy', 'U7_GW01_Del_ActiveEnergy',
      ];

  const allKeys = [
    ...DieselICKeys,
     ...WapdaICKeys,
     ...Solar1Keys, ...Solar2Keys, ...Wapda1Keys, 
    ...HTGenerationKeys
    ];


  // Use directly as UTC ISO string
  const startUTC = range.start;
  const endUTC = range.end;

  // Build projection dynamically
  const projection: Record<string, number> = { timestamp: 1 };
  allKeys.forEach(key => (projection[key] = 1));

  // Fetch data
  const data = await this.generationModel.aggregate([
    { $match: { timestamp: { $gte: startUTC, $lte: endUTC } } },
    { $project: projection },
    { $sort: { timestamp: 1 } },
  ]);

  const firstValues: Record<string, number | null> = {};
  const lastValues: Record<string, number | null> = {};
  const consumption: Record<string, number> = {};

  allKeys.forEach(key => {
    firstValues[key] = null;
    lastValues[key] = null;
    consumption[key] = 0;
  });

  // Process first and last values in one pass
  for (const doc of data) {
    allKeys.forEach(key => {
      const val = doc[key];
      if (typeof val === "number") {
        if (firstValues[key] === null) firstValues[key] = val;
        lastValues[key] = val;
      }
    });
  }

  // Calculate consumption
  // Calculate consumption
allKeys.forEach(key => {
  const start = firstValues[key];
  const end = lastValues[key];

  let value = start !== null && end !== null ? Math.max(0, end - start) : 0;

  // ✅ Apply scientific value filter (only if extremely high or low)
  if (value > 1e12 || value < 1e-6) {
    value = 0;
  }

  consumption[key] = value;
});


  // Sum per group
  const sum = (keys: string[]) =>
    keys.reduce((total, key) => total + (consumption[key] || 0), 0);

  const DieselIC = sum(DieselICKeys);
  const WapdaIC = sum(WapdaICKeys);
  const Solar1 = sum(Solar1Keys);
  const Solar2 = sum(Solar2Keys);
  const Wapda1 = sum(Wapda1Keys);
  const HTGeneration = sum(HTGenerationKeys);

  

  // ✅ Final totals
 const totalConsumption = 
 DieselIC+ WapdaIC + Solar1 + Solar2 + Wapda1 +HTGeneration

const total= totalConsumption
  // Logs
//   console.log(`[DEBUG] Range: ${startUTC} to ${endUTC}`);
//   console.log(`[DEBUG] Transport: ${transport}`);
//   console.log(`[DEBUG] Unit05Aux: ${unit05Aux}`);
//   console.log(`[DEBUG] Total: ${totalConsumption}`);

  // return +totalConsumption.toFixed(2);
  // return +totalConsumption1.toFixed(2);
  return +total.toFixed(2);
}




async getWeeklyGeneration() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const result: { Day: string; [key: string]: number | string }[] = [];

  const now = moment().tz('Asia/Karachi');
  const monday = now.clone().startOf('week').add(1, 'day'); // Monday

  for (let i = 0; i < 7; i++) {
    const thisDayStart = monday.clone().add(i, 'days').startOf('day').toISOString();
    const thisDayEnd = monday.clone().add(i, 'days').endOf('day').toISOString();

    const lastWeekStart = moment(thisDayStart).subtract(7, 'days').toISOString();
    const lastWeekEnd = moment(thisDayEnd).subtract(7, 'days').toISOString();

    const [thisWeek, lastWeek] = await Promise.all([
      this.calculateConsumption1({ start: thisDayStart, end: thisDayEnd }),
      this.calculateConsumption1({ start: lastWeekStart, end: lastWeekEnd }),
    ]);

    result.push({
      Day: days[i],
      "This Week": +thisWeek.toFixed(2),
      "Last Week": +lastWeek.toFixed(2),
    });
  }

  return result;                                  
}


async getTodayGeneration(): Promise<HourlyData[]> {
  const todayRange = this.getDayRange(0);
  const yesterdayRange = this.getDayRange(-1);

  const meterKeys = [
    "U19_PLC_Del_ActiveEnergy",
    "U21_PLC_Del_ActiveEnergy",
    "U6_GW02_Del_ActiveEnergy",
    "U17_GW03_Del_ActiveEnergy",
    "U23_GW01_Del_ActiveEnergy",
    "U20_GW03_Del_ActiveEnergy",
    "U21_GW03_Del_ActiveEnergy",
    "U7_GW01_Del_ActiveEnergy"
    

  ];

  const projection: Record<string, number> = { timestamp: 1 };
  meterKeys.forEach(key => projection[key] = 1);

  const [todayData, yesterdayData] = await Promise.all([
    this.generationModel.aggregate([
      { $match: { timestamp: { $gte: todayRange.start, $lte: todayRange.end } } },
      { $project: projection },
      { $sort: { timestamp: 1 } }
    ]),
    this.generationModel.aggregate([
      { $match: { timestamp: { $gte: yesterdayRange.start, $lte: yesterdayRange.end } } },
      { $project: projection },
      { $sort: { timestamp: 1 } }
    ])
  ]);

  const calculateHourly = (data: any[], hour: number, offset: number): number => {
    const base = moment().tz("Asia/Karachi").startOf("day").add(offset, 'days');
    const hourStart = base.clone().add(hour, 'hours');
    const hourEnd = hourStart.clone().add(1, 'hour');

    const firstValues: Record<string, number | null> = {};
    const lastValues: Record<string, number | null> = {};

    for (const doc of data) {
      const time = moment(doc.timestamp).tz("Asia/Karachi");
      if (time.isBetween(hourStart, hourEnd, null, '[)')) {
        meterKeys.forEach(key => {
          const val = doc[key];
          if (typeof val === "number") {
            if (firstValues[key] === undefined || firstValues[key] === null) {
              firstValues[key] = val;
            }
            lastValues[key] = val;
          }
        });
      }
    }

    let total = 0;
    meterKeys.forEach(key => {
      const first = firstValues[key];
      const last = lastValues[key];
      if (first !== null && last !== null && first !== undefined && last !== undefined) {
        let diff = last - first;
        if (diff < 0 || diff > 1e12 || diff < 1e-6) diff = 0;
        total += diff;
      }
    });

    return +total.toFixed(2);
  };

  const hourlyData: HourlyData[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const today = calculateHourly(todayData, hour, 0);
    const yesterday = calculateHourly(yesterdayData, hour, -1);

    hourlyData.push({
      Time: `${hour.toString().padStart(2, '0')}:00`,
      Today: today,
      Yesterday: yesterday
    });
  }

  return hourlyData;
}


  
  private getDayRange(offset: number): { start: string; end: string } {
    const date = new Date();
    date.setDate(date.getDate() + offset);
  
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
  
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
  
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }
  

  async getMonthlyGeneration() {
  const weekLabels = ["Week1", "Week2", "Week3", "Week4"];
  const result: { Weeks: string; [key: string]: number | string }[] = [];

  const getWeekRanges = (month: number, year: number) => {
    const weeks: [string, string][] = [];
    const startDate = new Date(year, month - 1, 1); // first day of month
    const firstMonday = new Date(startDate);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }

    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      weeks.push([
        new Date(weekStart.setHours(0, 0, 0, 0)).toISOString(),
        new Date(weekEnd.setHours(23, 59, 59, 999)).toISOString(),
      ]);
    }

    return weeks;
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const lastMonthDate = new Date(now.setMonth(now.getMonth() - 1));
  const lastMonth = lastMonthDate.getMonth() + 1;
  const lastYear = lastMonthDate.getFullYear();

  const weeksThisMonth = getWeekRanges(currentMonth, currentYear);
  const weeksLastMonth = getWeekRanges(lastMonth, lastYear);

  for (let i = 0; i < 4; i++) {
    const thisMonth = await this.calculateConsumption({
      start: weeksThisMonth[i][0],
      end: weeksThisMonth[i][1],
    });

    const lastMonth = await this.calculateConsumption({
      start: weeksLastMonth[i][0],
      end: weeksLastMonth[i][1],
    });

    result.push({
      Weeks: weekLabels[i],
      "This Month": +thisMonth.toFixed(2),
      "Last Month": +lastMonth.toFixed(2),
    });
  }

  return result;
}

  private getMonthDateRange(year: number, month: number): { start: string; end: string } {
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)); // last day of month
  
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }
  

  async getYearlyGeneration(): Promise<
  { Month: string; [key: string]: number | string }[]
> {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const result: { Month: string; [key: string]: number | string }[] = [];

  for (let month = 0; month < 12; month++) {
    const currentYearRange = this.getMonthDateRange(currentYear, month);
    const previousYearRange = this.getMonthDateRange(previousYear, month);

    const currentYearConsumption = Number(await this.calculateConsumption(currentYearRange)) || 0;
    const previousYearConsumption = Number(await this.calculateConsumption(previousYearRange)) || 0;

    result.push({
      Month: months[month],
      "Current Year": +currentYearConsumption.toFixed(2),
      "Previous Year": +previousYearConsumption.toFixed(2),
    });
  }

  return result;
}


}
  
  
  
  
  
  
  
  



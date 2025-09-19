
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { consumption_energy } from './schemas/consumption_energy.schema';
import { Consumption_energyDto  } from './dto/consumption_energy.dto'; // Correct import for DTO

import * as moment from 'moment-timezone';

export interface HourlyData {
  Time: string;
  Today: number;
  Yesterday: number;
}

@Injectable()
export class ConsumptionEnergyService {
  constructor(
    @InjectModel( consumption_energy.name, 'surajcotton') private readonly generationModel: Model< consumption_energy>
  ) {}

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

private async calculateConsumption(range: { start: string; end: string }) {
 
const TR2Keys = ["U21_PLC_Del_ActiveEnergy"];
// const TR1Keys = ["U21_PLC_Del_ActiveEnergy"];
// const GasLTPanelKeys = ["U7_GW01_Del_ActiveEnergy"];
// const PowerHouseKeys = ["U13_GW01_Del_ActiveEnergy"];
// const Solar1Keys = ["U6_GW02_Del_ActiveEnergy"];
// const Transformer1LT1CBKeys = ["U13_GW02_Del_ActiveEnergy"];
// const Transformer2ACBKeys = ["U16_GW03_Del_ActiveEnergy"];
// const Solar2Keys = ["U17_GW03_Del_ActiveEnergy"];









// const allMeterKeys = [...TR2Keys, ...TR1Keys, ...GasLTPanelKeys, ...PowerHouseKeys, ...Solar1Keys, ...Transformer1LT1CBKeys, ...Transformer2ACBKeys, ...Solar2Keys];
const allMeterKeys = [...TR2Keys];
// , ...TR1Keys, ...GasLTPanelKeys, ...PowerHouseKeys, ...Solar1Keys, ...Transformer1LT1CBKeys, ...Transformer2ACBKeys, ...Solar2Keys];
 

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

 
  const TR2 = sumByMeterGroup(TR2Keys);
  // const TR1 = sumByMeterGroup(TR1Keys);
  // const GasLTPanel = sumByMeterGroup(GasLTPanelKeys);
  // const PowerHouse = sumByMeterGroup(PowerHouseKeys);
  // const Solar1 = sumByMeterGroup(Solar1Keys);
  // const Transformer1LT1CB = sumByMeterGroup(Transformer1LT1CBKeys);
  // const Transformer2ACB = sumByMeterGroup(Transformer2ACBKeys);
  // const Solar2 = sumByMeterGroup(Solar2Keys);





  // ✅ Final totals
//  const totalConsumption = TR2 + TR1 + GasLTPanel + PowerHouse 
 const totalConsumption = TR2 



// const totalConsumption1= Solar1 + Transformer1LT1CB +Transformer2ACB + Solar2

// const total= totalConsumption + totalConsumption1
const total= totalConsumption


  return +total.toFixed(2);
}




 

async calculateConsumption1(range: { start: string; end: string }): Promise<number> {
  const TR2Keys = ["U19_PLC_Del_ActiveEnergy"];
  const TR1Keys = ["U21_PLC_Del_ActiveEnergy"];
  const GasLTPanelKeys = ["U7_GW01_Del_ActiveEnergy"];
  const PowerHouseKeys = ["U13_GW01_Del_ActiveEnergy"];
  const Solar1Keys = ["U6_GW02_Del_ActiveEnergy"];
  const Transformer1LT1CBKeys = ["U13_GW02_Del_ActiveEnergy"];
  const Transformer2ACBKeys = ["U16_GW03_Del_ActiveEnergy"];
  const Solar2Keys = ["U17_GW03_Del_ActiveEnergy"];

  const allKeys = [
    ...TR2Keys,
     ...TR1Keys, ...GasLTPanelKeys, ...PowerHouseKeys,
    ...Solar1Keys, ...Transformer1LT1CBKeys, ...Transformer2ACBKeys, ...Solar2Keys
  ];

  // Range as ISO (UTC Z); aap ki caller (getWeeklyGeneration) Asia/Karachi ko UTC mēn convert karke bhej rahi hai — sahi.
  const startUTC = range.start;
  const endUTC = range.end;

  // Log: incoming range
  // console.log(`[CONSUMP] Query range (UTC): start=${startUTC} end=${endUTC}`);

  // Build projection
  const projection: Record<string, number> = { timestamp: 1 };
  allKeys.forEach(key => (projection[key] = 1));

  // 🔒 Safer match: handle both string and Date timestamps (mixed collections)
  // NOTE: Agar aapke collection mēn timestamp 100% Date ho, to is $match ko
  // simple { timestamp: { $gte: new Date(startUTC), $lte: new Date(endUTC) } } se replace kar sakte hain.
  const data = await this.generationModel.aggregate([
    {
      $match: {
        $expr: {
          $and: [
            { $gte: [ { $toDate: '$timestamp' }, new Date(startUTC) ] },
            { $lte: [ { $toDate: '$timestamp' }, new Date(endUTC) ] },
          ]
        }
      }
    },
    { $project: projection },
    { $sort: { timestamp: 1 } },
  ]);

  // console.log(`[CONSUMP] Docs found: ${data.length}`);

  if (data.length > 0) {
    const firstTs = data[0].timestamp instanceof Date ? data[0].timestamp.toISOString() : data[0].timestamp;
    const lastTs  = data[data.length - 1].timestamp instanceof Date ? data[data.length - 1].timestamp.toISOString() : data[data.length - 1].timestamp;
    // console.log(`[CONSUMP] First doc ts: ${firstTs} | Last doc ts: ${lastTs}`);
  } else {
    // console.log(`[CONSUMP] No docs in range.`);
  }

  const firstValues: Record<string, number | null> = {};
  const lastValues: Record<string, number | null> = {};
  const consumption: Record<string, number> = {};
  allKeys.forEach(k => { firstValues[k] = null; lastValues[k] = null; consumption[k] = 0; });

  // Single pass: capture first/last numeric values
  for (const doc of data) {
    for (const key of allKeys) {
      const val = doc[key];
      if (typeof val === "number") {
        if (firstValues[key] === null) firstValues[key] = val;
        lastValues[key] = val;
      }
    }
  }

  // Compute per-key deltas + guardrails
  allKeys.forEach(key => {
    const s = firstValues[key];
    const e = lastValues[key];
    let delta = (s !== null && e !== null) ? Math.max(0, e - s) : 0;

    // Outlier clamp (scientific sanity)
    if (delta > 1e12 || delta < 1e-6) delta = 0;

    consumption[key] = delta;
  });

  // Optional: concise per-key debug (only non-zero)
  const nonZero = allKeys
    .filter(k => (consumption[k] || 0) > 0)
    .slice(0, 10) // log limit
    .map(k => ({
      key: k,
      first: firstValues[k],
      last: lastValues[k],
      delta: consumption[k]
    }));
  // console.log(`[CONSUMP] Non-zero sample (up to 10):`, nonZero);

  // Group sums
  const sum = (keys: string[]) => keys.reduce((t, k) => t + (consumption[k] || 0), 0);

  const TR2 = sum(TR2Keys);
  const TR1 = sum(TR1Keys);
  const GasLTPanel = sum(GasLTPanelKeys);
  const PowerHouse = sum(PowerHouseKeys);
  const Solar1 = sum(Solar1Keys);
  const Transformer1LT1CB = sum(Transformer1LT1CBKeys);
  const Transformer2ACB = sum(Transformer2ACBKeys);
  const Solar2 = sum(Solar2Keys);
  
  

  const totalConsumption = TR2 + TR1 + GasLTPanel + PowerHouse;
  const totalConsumption1 = Solar1 + Transformer1LT1CB + Transformer2ACB + Solar2;
  const total = totalConsumption + totalConsumption1;
  


  // console.log(`[CONSUMP] Group sums => TR2:${TR2.toFixed(2)} TR1:${TR1.toFixed(2)} GasLT:${GasLTPanel.toFixed(2)} PH:${PowerHouse.toFixed(2)} | Solar1:${Solar1.toFixed(2)} T1LT1CB:${Transformer1LT1CB.toFixed(2)} T2ACB:${Transformer2ACB.toFixed(2)} Solar2:${Solar2.toFixed(2)}`);
  // console.log(`[CONSUMP] Totals => Import:${totalConsumption.toFixed(2)} Export:${totalConsumption1.toFixed(2)} Overall:${total.toFixed(2)}`);

  return +total.toFixed(2);
}




async getWeeklyGeneration() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const result: { Day: string; [key: string]: number | string }[] = [];

  const now = moment().tz('Asia/Karachi');
  const monday = now.clone().startOf('week').add(1, 'day'); // Monday in PKT

  // console.log(`[WEEKLY] Base week (PKT). Monday: ${monday.format()}`);

  for (let i = 0; i < 7; i++) {
    const thisDayStart = monday.clone()
      .add(i, 'days')
      .hour(6).minute(0).second(0).millisecond(0)
      .toISOString();

    const thisDayEnd = monday.clone()
      .add(i + 1, 'days')
      .hour(6).minute(0).second(0).millisecond(0)
      .toISOString();

    const lastWeekStart = moment(thisDayStart).subtract(7, 'days').toISOString();
    const lastWeekEnd   = moment(thisDayEnd).subtract(7, 'days').toISOString();

    // 🔎 Debug logs
    // console.log(`[WEEKLY] ${days[i]} window:`);
    // console.log(`   This Week => ${thisDayStart} -> ${thisDayEnd}`);
    // console.log(`   Last Week => ${lastWeekStart} -> ${lastWeekEnd}`);

    const [thisWeek, lastWeek] = await Promise.all([
      this.calculateConsumption1({ start: thisDayStart, end: thisDayEnd }),
      this.calculateConsumption1({ start: lastWeekStart, end: lastWeekEnd }),
    ]);

    // console.log(`[WEEKLY] ${days[i]} result => ThisWeek: ${thisWeek}, LastWeek: ${lastWeek}`);

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
    "U7_GW01_Del_ActiveEnergy",
    "U13_GW01_Del_ActiveEnergy",
    "U6_GW02_Del_ActiveEnergy",
    "U13_GW02_Del_ActiveEnergy",
    "U16_GW03_Del_ActiveEnergy",
    "U17_GW03_Del_ActiveEnergy",
  ];
  const projection: Record<string, number> = { timestamp: 1 };
  meterKeys.forEach((key) => (projection[key] = 1));

  const [todayData, yesterdayData] = await Promise.all([
    this.generationModel.aggregate([
      {
        $match: {
          timestamp: { $gte: todayRange.start, $lte: todayRange.end },
        },
      },
      { $project: projection },
      { $sort: { timestamp: 1 } },
    ]),
    this.generationModel.aggregate([
      {
        $match: {
          timestamp: { $gte: yesterdayRange.start, $lte: yesterdayRange.end },
        },
      },
      { $project: projection },
      { $sort: { timestamp: 1 } },
    ]),
  ]);

  console.log("🔹 Today Range:", todayRange);
  console.log("🔹 Yesterday Range:", yesterdayRange);
  console.log("🔹 Today Docs Found:", todayData.length);
  console.log("🔹 Yesterday Docs Found:", yesterdayData.length);

const calculateHourly = (data: any[], hour: number, offset: number): number => {
  // Base 6AM
  const base = moment()
    .tz("Asia/Karachi")
    .startOf("day")
    .add(offset, "days")
    .hour(6);

  const hourStart = base.clone().add(hour, "hours");
  const hourEnd = hourStart.clone().add(1, "hour");

  console.log(`⏰ Checking Hour Slot: ${hourStart.format()} -> ${hourEnd.format()}`);

  const firstValues: Record<string, number | null> = {};
  const lastValues: Record<string, number | null> = {};

  // ✅ First value → current slot ka pehla doc
  for (const doc of data) {
    const time = moment(doc.timestamp).tz("Asia/Karachi");
    if (time.isBetween(hourStart, hourEnd, null, "[)")) {
      meterKeys.forEach((key) => {
        const val = doc[key];
        if (typeof val === "number" && firstValues[key] == null) {
          firstValues[key] = val;
        }
      });
    }
  }

  // ✅ Last value → next slot ka pehla doc
  for (const doc of data) {
    const time = moment(doc.timestamp).tz("Asia/Karachi");
    if (time.isSameOrAfter(hourEnd)) {
      meterKeys.forEach((key) => {
        const val = doc[key];
        if (typeof val === "number" && lastValues[key] == null) {
          lastValues[key] = val;
        }
      });
      break; // sirf pehla doc lena hai
    }
  }

  console.log(`   ➡ First Values:`, firstValues);
  console.log(`   ➡ Last Values :`, lastValues);

  let total = 0;
  meterKeys.forEach((key) => {
    const first = firstValues[key];
    const last = lastValues[key];
    if (
      first !== null &&
      last !== null &&
      first !== undefined &&
      last !== undefined
    ) {
      let diff = last - first;
      if (diff < 0 || diff > 1e12 || diff < 1e-6) diff = 0;
      total += diff;
    }
  });

  console.log(`   ⚡ Total Consumption = ${total.toFixed(2)}`);
  return +total.toFixed(2);
};


  const hourlyData: HourlyData[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const today = calculateHourly(todayData, hour, 0);
    const yesterday = calculateHourly(yesterdayData, hour, -1);

    // Time ko 6AM se shift kar diya
    const displayHour = (hour + 6) % 24;

    console.log(
      `✅ Final Hour: ${displayHour.toString().padStart(2, "0")}:00 | Today=${today} | Yesterday=${yesterday}`
    );

    hourlyData.push({
      Time: `${displayHour.toString().padStart(2, "0")}:00`,
      Today: today,
      Yesterday: yesterday,
    });
  }

  console.log("📊 Final Hourly Data:", hourlyData);

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
      weekEnd.setDate(weekStart.getDate() + 7); // full 7 days complete

      const startISO = new Date(weekStart.setHours(6, 0, 0, 0)).toISOString(); // Start = 6 AM
      const endISO = new Date(weekEnd.setHours(6, 0, 0, 0)).toISOString();     // End = next Monday 6 AM

      weeks.push([startISO, endISO]);
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

  console.log("🟢 Weeks This Month:", weeksThisMonth);
  console.log("🟡 Weeks Last Month:", weeksLastMonth);

  for (let i = 0; i < 4; i++) {
    console.log(`\n📅 ${weekLabels[i]}:`);
    console.log("   🔹 This Month Range:", weeksThisMonth[i][0], "->", weeksThisMonth[i][1]);
    console.log("   🔹 Last Month Range:", weeksLastMonth[i][0], "->", weeksLastMonth[i][1]);

    const thisMonth = await this.calculateConsumption({
      start: weeksThisMonth[i][0],
      end: weeksThisMonth[i][1],
    });

    const lastMonthVal = await this.calculateConsumption({
      start: weeksLastMonth[i][0],
      end: weeksLastMonth[i][1],
    });

    console.log(`   ⚡ This Month Consumption: ${thisMonth.toFixed(2)}`);
    console.log(`   ⚡ Last Month Consumption: ${lastMonthVal.toFixed(2)}`);

    result.push({
      Weeks: weekLabels[i],
      "This Month": +thisMonth.toFixed(2),
      "Last Month": +lastMonthVal.toFixed(2),
    });
  }

  console.log("📊 Final Monthly Data:", result);

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
  
  
  
  
  
  
  
  




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
  
  const DieselICKeys = ["U19_PLC_Del_ActiveEnergy", "U11_GW01_Del_ActiveEnergy"];
  // const WapdaICKeys = ["U21_PLC_Del_ActiveEnergy"];
   const Solar1Keys = ["U6_GW02_Del_ActiveEnergy"];
   const Solar2Keys = ["U17_GW03_Del_ActiveEnergy"];
   const Wapda1Keys = ["U23_GW01_Del_ActiveEnergy", "'U27_PLC_Del_ActiveEnergy'"];
   const HTGenerationKeys = ['U20_GW03_Del_ActiveEnergy','U21_GW03_Del_ActiveEnergy','U23_GW01_Del_ActiveEnergy', 'U7_GW01_Del_ActiveEnergy',
      ];

    
 const allMeterKeys = [...DieselICKeys,  ...Solar1Keys, ...Solar2Keys, ...HTGenerationKeys];
  // console.log(`\n🔍 Calculating Consumption for Range: ${range.start} -> ${range.end}`);
  // console.log(`📌 Meters: ${allMeterKeys.join(", ")}`);

  const meterSuffixMap: Record<string, string> = {};
  allMeterKeys.forEach(fullKey => {
    const [meterId, ...suffixParts] = fullKey.split("_");
    meterSuffixMap[meterId] = suffixParts.join("_");
  });

  const projection: Record<string, number> = { timestamp: 1 };
  Object.entries(meterSuffixMap).forEach(([meterId, suffix]) => {
    projection[`${meterId}_${suffix}`] = 1;
  });

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

  // console.log(`📦 Docs Found: ${data.length}`);
  if (data.length === 0) {
    // console.log("⚠️ No data found for this range!");
    return 0;
  }

  const firstValues: Record<string, number | null> = {};
  const lastValues: Record<string, number | null> = {};
  Object.entries(meterSuffixMap).forEach(([meterId, suffix]) => {
    const key = `${meterId}_${suffix}`;
    firstValues[key] = null;
    lastValues[key] = null;
  });

  // ✅ Step-by-step log
  for (const doc of data) {
    // console.log(`   ⏰ Doc Timestamp: ${doc.timestamp}`);
    Object.entries(meterSuffixMap).forEach(([meterId, suffix]) => {
      const key = `${meterId}_${suffix}`;
      const val = doc[key];

      if (typeof val === "number") {
        if (firstValues[key] === null) {
          firstValues[key] = val;
          // console.log(`      🟢 First Value for ${key}: ${val} (from ${doc.timestamp})`);
        }
        lastValues[key] = val;
        // console.log(`      🔵 Last Value Updated for ${key}: ${val} (from ${doc.timestamp})`);
      }
    });
  }

  const consumption: Record<string, number> = {};
  Object.keys(firstValues).forEach(key => {
    if (firstValues[key] !== null && lastValues[key] !== null) {
      let diff = lastValues[key]! - firstValues[key]!;
      diff = diff >= 0 ? diff : 0; // no negative
      if (diff > 1e12 || diff < 1e-6) diff = 0; // filter invalid
      consumption[key] = diff;
      // console.log(`   ⚡ Consumption for ${key}: ${lastValues[key]} - ${firstValues[key]} = ${diff}`);
    } else {
      consumption[key] = 0;
      // console.log(`   ⚠️ No valid values for ${key}, consumption = 0`);
    }
  });

  const sumByMeterGroup = (meterKeys: string[]) =>
    meterKeys.reduce((sum, fullKey) => {
      const [meterId, ...suffixParts] = fullKey.split("_");
      const key = `${meterId}_${suffixParts.join("_")}`;
      const value = consumption[key];
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

 // ✅ Calculate each group total
 const DieselIC = sumByMeterGroup(DieselICKeys);
  // const WapdaIC = sumByMeterGroup(WapdaICKeys);
  const Solar1 = sumByMeterGroup(Solar1Keys);
  const Solar2 = sumByMeterGroup(Solar2Keys);
  const Wapda1 = sumByMeterGroup(Wapda1Keys);
  const HTGeneration = sumByMeterGroup(HTGenerationKeys);

  

  // ✅ Final totals
 const totalConsumption = DieselIC+  Solar1 + Solar2 + Wapda1 +HTGeneration


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
const LTGenerationKeys = ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'];
    const SolarGenerationKeys = ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];
    const Wapda1Keys = ["U23_GW01_Del_ActiveEnergy", "'U27_PLC_Del_ActiveEnergy'"];
   const HTGenerationKeys = ['U20_GW03_Del_ActiveEnergy','U21_GW03_Del_ActiveEnergy','U23_GW01_Del_ActiveEnergy', 'U7_GW01_Del_ActiveEnergy'];
   const allKeys = [
  ...LTGenerationKeys, ...SolarGenerationKeys, 
    ...HTGenerationKeys, ...Wapda1Keys
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

  const LT_Gen = sum(LTGenerationKeys);
  const Solar = sum(SolarGenerationKeys);
  const HTGeneration = sum(HTGenerationKeys);
  const Wapda1 = sum(Wapda1Keys);

  
  

 // ✅ Final totals
 const totalConsumption = 
LT_Gen+ Solar + Wapda1 +HTGeneration

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

  // ✅ Helper function: Date ko Asia/Karachi ISO string me convert karega
  function toKarachiISO(date: Date): string {
    // Karachi offset = +05:00
    const offset = "+05:00";
    const pad = (n: number) => String(n).padStart(2, "0");

    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes()) +
      ":" +
      pad(date.getSeconds()) +
      offset
    );
  }

  const getWeekRanges = (month: number, year: number) => {
    const weeks: [string, string][] = [];
    const startDate = new Date(year, month - 1, 1); // Month ka pehla din
    const firstMonday = new Date(startDate);

    // ✅ First Monday dhoondo
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }

    // ✅ 4 weeks banao
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + i * 7);
      weekStart.setHours(6, 0, 0, 0); // 6 AM start

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7); // Next Monday
      weekEnd.setHours(6, 0, 0, 0); // 6 AM end

      // ✅ Karachi offset ke sath ISO strings
      const startISO = toKarachiISO(weekStart);
      const endISO = toKarachiISO(weekEnd);

      weeks.push([startISO, endISO]);
    }

    return weeks;
  };

  // ✅ Abhi ka month aur pichla month nikalo
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

  // ✅ Consumption calculate karo
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



  // private getMonthDateRange(year: number, month: number): { start: string; end: string } {
  //   const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  //   const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)); // last day of month
  
  //   return {
  //     start: start.toISOString(),
  //     end: end.toISOString(),
  //   };
  // }
  

async getYearlyGeneration(): Promise<{ Month: string; [key: string]: number | string }[]> {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const result: { Month: string; [key: string]: number | string }[] = [];

  // ✅ Helper: Convert Date to ISO string with +05:00 (Karachi)
  function toKarachiISO(date: Date): string {
    const offset = "+05:00";
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      date.getFullYear() + "-" +
      pad(date.getMonth() + 1) + "-" +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) + ":" +
      pad(date.getMinutes()) + ":" +
      pad(date.getSeconds()) +
      offset
    );
  }

  // ✅ Helper: Get 6 AM - 6 AM range for a month
  function getMonth6to6Range(year: number, month: number) {
    const start = new Date(year, month, 1, 6, 0, 0); // 1st day 6 AM
    const end = new Date(year, month + 1, 1, 6, 0, 0); // 1st day of next month 6 AM
    return { start: toKarachiISO(start), end: toKarachiISO(end) };
  }

  // 🔹 Loop through all months (0 = Jan, 11 = Dec)
  for (let month = 0; month < 12; month++) {
    const currentYearRange = getMonth6to6Range(currentYear, month);
    const previousYearRange = getMonth6to6Range(previousYear, month);

    // console.log(`\n📅 Month: ${months[month]}`);
    // console.log("   🔹 Current Year Range:", currentYearRange.start, "->", currentYearRange.end);
    // console.log("   🔹 Previous Year Range:", previousYearRange.start, "->", previousYearRange.end);

    // ✅ Call calculateConsumption with detailed logs
    const currentYearConsumption = await this.calculateConsumption({
      start: currentYearRange.start,
      end: currentYearRange.end,
    });

    const previousYearConsumption = await this.calculateConsumption({
      start: previousYearRange.start,
      end: previousYearRange.end,
    });

    // console.log(`   ⚡ Current Year Consumption: ${currentYearConsumption.toFixed(2)}`);
    // console.log(`   ⚡ Previous Year Consumption: ${previousYearConsumption.toFixed(2)}`);

    result.push({
      Month: months[month],
      "Current Year": +currentYearConsumption.toFixed(2),
      "Previous Year": +previousYearConsumption.toFixed(2),
    });
  }

  // console.log("\n📊 Full Year Data:", result);
  return result;
}


}
  
  
  
  
  
  
  
  



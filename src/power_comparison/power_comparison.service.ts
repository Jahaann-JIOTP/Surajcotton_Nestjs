import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoClient } from 'mongodb';
// import * as moment from 'moment-timezone';
import * as moment from 'moment';
import { powercomparisonHistoricalDataDocument } from './schemas/power_comparison.schema';
// import * as moment from 'moment-timezone';


@Injectable()
export class powercomparisonService {
  

  constructor(
    @InjectModel('power_comparison', 'surajcotton') private readonly conModel: Model<powercomparisonHistoricalDataDocument>,
  ) {}


async getPowerAverages(startDate: string, endDate: string) {
  const collection = this.conModel.collection;

 const startDateTime = moment.tz(startDate, "YYYY-MM-DD", "Asia/Karachi")
  .hour(6).minute(0).second(0).millisecond(0)
  .toDate();

const endDateTime = moment.tz(endDate, "YYYY-MM-DD", "Asia/Karachi")
  .add(1, "day")
  .hour(6).minute(59).second(59).millisecond(999)
  .toDate();







  // Define tags
  const htTags = ['U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy'];
  const ltTags = ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'];
  const wapdaTags = ['U23_GW01_Del_ActiveEnergy', 'U27_PLC_Del_ActiveEnergy'];
  // const solarTags = ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];
  const solarTags = ['U6_GW02_Del_ActiveEnergy'];

  const unit4Tags = ['U19_PLC_Del_ActiveEnergy', 'U21_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy', 'U13_GW01_Del_ActiveEnergy'];
  const unit5Tags = ['U6_GW02_Del_ActiveEnergy', 'U13_GW02_Del_ActiveEnergy', 'U16_GW03_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];
  const Trafo1IncomingTags = ['U23_GW01_Del_ActiveEnergy'];
  const Trafo2IncomingTags = ['U22_GW01_Del_ActiveEnergy'];
  const Trafo3IncomingTags = ['U20_GW03_Del_ActiveEnergy'];
   const Trafo4IncomingTags = ['U19_GW03_Del_ActiveEnergy'];
    const Trafo1outgoingTags = ['U21_PLC_Del_ActiveEnergy'];
    const Trafo2outgoingTags = ['U13_GW01_Del_ActiveEnergy'];
    const Trafo3outgoingTags = ['U13_GW02_Del_ActiveEnergy'];
    const Trafo4outgoingTags = ['U16_GW03_Del_ActiveEnergy'];
    const Wapda2Tags = ['U27_PLC_Del_ActiveEnergy'];
    const NiigataTags = ['U22_PLC_Del_ActiveEnergy'];
    const JMSTags = ['U26_PLC_Del_ActiveEnergy'];
    const PH_ICTags = ['U23_GW01_Del_ActiveEnergy'];

  // Aggregation pipeline
  const pipeline = [
    {
      $addFields: {
        date: { $toDate: "$timestamp" }
      }
    },
    {
      $match: {
        date: { $gte: startDateTime, $lte: endDateTime }
      }
    },
  
 {
      $addFields: {
        hourStart: {
          $dateTrunc: {
            date: "$date",
            unit: "hour",
            timezone: "Asia/Karachi"
          }
        }
      }
    },

    { $sort: { date: 1 } },
    {
      $group: {
        _id: "$hourStart",
        ...Object.fromEntries(
          [...htTags, ...ltTags, ...wapdaTags, ...solarTags, ...unit4Tags, ...unit5Tags, ...Trafo1IncomingTags, ...Trafo2IncomingTags,
            ...Trafo3IncomingTags, ...Trafo4IncomingTags, ...Trafo1outgoingTags, ...Trafo2outgoingTags, ...Trafo3outgoingTags,
             ...Trafo4outgoingTags, Wapda2Tags, ...NiigataTags, ...JMSTags, ...PH_ICTags].flatMap(tag => [
            [`first_${tag}`, { $first: { $ifNull: [`$${tag}`, 0] } }],
            [`last_${tag}`, { $last: { $ifNull: [`$${tag}`, 0] } }],
          ])
        )
      }
    },
    { $sort: { _id: 1 } }
  ];

  const data = await collection.aggregate(pipeline).toArray();

  return data.map(entry => {
    const formattedDate = moment(entry._id).tz("Asia/Karachi").format("YYYY-MM-DD HH:mm");

    let htTotal = 0;
    for (const tag of htTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      htTotal += diff;
    }

    let ltTotal = 0;
    for (const tag of ltTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      ltTotal += diff;
    }

    let wapdaTotal = 0;
    for (const tag of wapdaTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      wapdaTotal += diff;
    }

    let solarTotal = 0;
    for (const tag of solarTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      solarTotal += diff;
    }

    let unit4Total = 0;
    for (const tag of unit4Tags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      unit4Total += diff;
    }

    let unit5Total = 0;
    for (const tag of unit5Tags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      unit5Total += diff;
    }

    let Trafo1Incoming = 0;
    for (const tag of Trafo1IncomingTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Trafo1Incoming += diff;
    }

      let Trafo2Incoming = 0;
    for (const tag of Trafo2IncomingTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Trafo2Incoming += diff;
    }

    let Trafo3Incoming = 0;
    for (const tag of Trafo3IncomingTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Trafo3Incoming += diff;
    }

    let Trafo4Incoming = 0;
    for (const tag of Trafo4IncomingTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Trafo4Incoming += diff;
    }
        let Trafo1outgoing = 0;
    for (const tag of Trafo1outgoingTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Trafo1outgoing += diff;
    }
        let Trafo2outgoing = 0;
    for (const tag of Trafo2outgoingTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Trafo2outgoing += diff;
    }
        let Trafo3outgoing = 0;
    for (const tag of Trafo3outgoingTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Trafo3outgoing += diff;
    }
        let Trafo4outgoing = 0;
    for (const tag of Trafo4outgoingTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Trafo4outgoing += diff;
    }

    let Wapda2 = 0;
    for (const tag of Wapda2Tags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Wapda2 += diff;
    }

      let Niigata = 0;
    for (const tag of NiigataTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      Niigata += diff;
    }

        let JMS = 0;
    for (const tag of JMSTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      JMS += diff;
    }
           let PH_IC = 0;
    for (const tag of PH_ICTags) {
      const first = entry[`first_${tag}`] || 0;
      const last = entry[`last_${tag}`] || 0;
      let diff = last - first;
      if (Math.abs(diff) > 1e12 || Math.abs(diff) < 1e-6) diff = 0;
      PH_IC += diff;
    }
    const t1andt2incoming =  Trafo1Incoming + Trafo2Incoming;
    const t1andt2outgoing =  Trafo1outgoing + Trafo2outgoing;
    const t1and2losses = t1andt2incoming - t1andt2outgoing;
    const t3losses = Trafo3Incoming - Trafo3outgoing;
    const t4losses = Trafo4Incoming - Trafo4outgoing;
    const transformerlosses = t1and2losses+ t3losses + t4losses;
    const HT_Transmissioin_Losses = (Wapda2+ Niigata + JMS)- (Trafo3Incoming + Trafo4Incoming + PH_IC );
    const losses = transformerlosses + HT_Transmissioin_Losses;
    const totalConsumption = unit4Total + unit5Total;
    const totalGeneration = htTotal + ltTotal + wapdaTotal + solarTotal;


    return {
      date: formattedDate,
      HT: +htTotal.toFixed(2),
      LT: +ltTotal.toFixed(2),
      wapda: +wapdaTotal.toFixed(2),
      solar: +solarTotal.toFixed(2),
      unit4: +unit4Total.toFixed(2),
      unit5: +unit5Total.toFixed(2),
      // t1andt2incoming: +t1andt2incoming.toFixed(2),
      // t1andt2outgoing: +t1andt2outgoing.toFixed(2),
      // t1and2losses: +t1and2losses.toFixed(2),
      losses : +losses.toFixed(2),
      total_consumption: +totalConsumption.toFixed(2),
      total_generation: +totalGeneration.toFixed(2),
      unaccountable_energy: +(totalConsumption - totalGeneration).toFixed(2),
      efficiency: +((totalConsumption / totalGeneration) * 100 || 0).toFixed(2),
    };
  });
}



  async getPowerData(startDate: string, endDate: string, label: string) {
    if (label === 'hourly') {
      return this.getPowerAverages(startDate, endDate);
    } else if (label === 'daily') {
      return this.getDailyPowerAverages(startDate, endDate);
    } else if (label === 'monthly') {
      return this.getMonthlyAverages(startDate, endDate);
    }else {
      return this.getPowerAverages(startDate, endDate);
    }
  }














// Corrected 6AM-6AM daily calculation
async getDailyPowerAverages(startDate: string, endDate: string) {
  const collection = this.conModel.collection;

  const meterGroups = {
    HT: ['U22_PLC', 'U26_PLC'],
    LT: ['U19_PLC', 'U11_GW01'],
    wapda: ['U23_GW01', 'U27_PLC'],
    solar: ['U6_GW02', 'U17_GW03'],
    unit4: ['U19_PLC', 'U21_PLC', 'U11_GW01', 'U13_GW01'],
    unit5: ['U6_GW02', 'U13_GW02', 'U16_GW03', 'U17_GW03'],
    Trafo1Incoming: ['U23_GW01'],
    Trafo2Incoming: ['U22_GW01'],
    Trafo3Incoming: ['U20_GW03'],
    Trafo4Incoming: ['U19_GW03'],
    Trafo1outgoing: ['U21_PLC'],
    Trafo2outgoing: ['U13_GW01'],
    Trafo3outgoing: ['U13_GW02'],
    Trafo4outgoing: ['U16_GW03'],
    Wapda2: ['U27_PLC'],
    Niigata: ['U22_PLC'],
    JMS: ['U26_PLC'],
    PH_IC: ['U23_GW01'],
  };

  const suffix = 'Del_ActiveEnergy';

  // Build unique keys
  const meterGroupKeys: Record<string, string[]> = {};
  const allKeysSet = new Set<string>();
  for (const group in meterGroups) {
    const keys = meterGroups[group].map(id => `${id}_${suffix}`);
    meterGroupKeys[group] = keys;
    keys.forEach(k => allKeysSet.add(k));
  }
  const allKeys = Array.from(allKeysSet);

  const projection = allKeys.reduce((acc, key) => ({ ...acc, [key]: 1 }), { timestamp: 1 });

  // Build ISO strings in +05:00 offset format
  const startISO = `${startDate}T06:00:00.000+05:00`;
  const nextDay = moment(startDate).add(1, "day").format("YYYY-MM-DD");
  const endISO = `${nextDay}T06:00:59.999+05:00`;

  console.log("📌 Query Start:", startISO);
  console.log("📌 Query End  :", endISO);

  // Fetch docs
  const docs = await collection.find({
    timestamp: { $gte: startISO, $lte: endISO }
  }).project(projection).sort({ timestamp: 1 }).toArray();

  console.log("📦 Docs Found:", docs.length);
  if (!docs.length) return [];

  // Start doc: first >= 6AM
  const firstDoc = docs.find(d => d.timestamp >= startISO);
  if (!firstDoc) {
    console.warn(`⚠️ No doc found at/after ${startISO}`);
    return [];
  }

  // End doc: last <= next day 6:00:59
  const lastDoc = [...docs].reverse().find(d => d.timestamp <= endISO);
  if (!lastDoc) {
    console.warn(`⚠️ No doc found at/before ${endISO}`);
    return [];
  }

  console.log(`📅 Date: ${startDate}`);
  console.log(`   🔹 Start Doc Timestamp: ${firstDoc.timestamp}`);
  console.log(`   🔹 End Doc Timestamp  : ${lastDoc.timestamp}`);

  // Debug values
  console.log("🟢 First Doc Values:");
  for (const key of allKeys) console.log(`   ${key}: ${firstDoc[key] ?? 0}`);
  console.log("🔴 Last Doc Values:");
  for (const key of allKeys) console.log(`   ${key}: ${lastDoc[key] ?? 0}`);

  // Compute consumption
  const isInvalid = (val: number) => Math.abs(val) < 1e-5 || Math.abs(val) > 1e28;
  const consumption: Record<string, number> = {};

  for (const key of allKeys) {
    let first = Number(firstDoc[key] ?? 0);
    let last = Number(lastDoc[key] ?? 0);
    if (isInvalid(first)) first = 0;
    if (isInvalid(last)) last = 0;
    consumption[key] = last - first;
  }

  const sum = (keys: string[]) => keys.reduce((t, k) => t + (consumption[k] || 0), 0);

  const ht = sum(meterGroupKeys.HT);
  const lt = sum(meterGroupKeys.LT);
  const wapda = sum(meterGroupKeys.wapda);
  const solar = sum(meterGroupKeys.solar);
  const unit4 = sum(meterGroupKeys.unit4);
  const unit5 = sum(meterGroupKeys.unit5);
  const Trafo1Incoming = sum(meterGroupKeys.Trafo1Incoming);
  const Trafo2Incoming = sum(meterGroupKeys.Trafo2Incoming);
  const Trafo3Incoming = sum(meterGroupKeys.Trafo3Incoming);
  const Trafo4Incoming = sum(meterGroupKeys.Trafo4Incoming);
  const Trafo1outgoing = sum(meterGroupKeys.Trafo1outgoing);
  const Trafo2outgoing = sum(meterGroupKeys.Trafo2outgoing);
  const Trafo3outgoing = sum(meterGroupKeys.Trafo3outgoing);
  const Trafo4outgoing = sum(meterGroupKeys.Trafo4outgoing);
  const Wapda2 = sum(meterGroupKeys.Wapda2);
  const Niigata = sum(meterGroupKeys.Niigata);
  const JMS = sum(meterGroupKeys.JMS);
  const PH_IC = sum(meterGroupKeys.PH_IC);

  const transformerLosses =
    (Trafo1Incoming + Trafo2Incoming - Trafo1outgoing - Trafo2outgoing) +
    (Trafo3Incoming - Trafo3outgoing) +
    (Trafo4Incoming - Trafo4outgoing);

  const HTTransmissionLosses =
    (Wapda2 + Niigata + JMS) - (Trafo3Incoming + Trafo4Incoming + PH_IC);

  const losses = transformerLosses + HTTransmissionLosses;
  const totalConsumption = unit4 + unit5;
  const totalgeneration = ht + lt + wapda + solar;
  const unaccountable_energy = totalConsumption - totalgeneration;
  const efficiency = totalgeneration > 0 ? (totalConsumption / totalgeneration) * 100 : 0;

  const dailyResults = [{
    date: startDate,
    HT: +ht.toFixed(2),
    LT: +lt.toFixed(2),
    wapda: +wapda.toFixed(2),
    solar: +solar.toFixed(2),
    unit4: +unit4.toFixed(2),
    unit5: +unit5.toFixed(2),
    losses: +losses.toFixed(2),
    totalConsumption: +totalConsumption.toFixed(2),
    totalgeneration: +totalgeneration.toFixed(2),
    unaccountable_energy: +unaccountable_energy.toFixed(2),
    efficiency: +efficiency.toFixed(2),
  }];

  console.log("📊 Daily Results:", dailyResults);
  return dailyResults;
}


















async getMonthlyAverages(startDate: string, endDate: string) {
  const collection = this.conModel.collection;

  // ✅ Start aur End ISO log karo
  const startISO = `${startDate}T06:00:00.000+05:00`;

const nextDay = moment(endDate).add(1, "day").format("YYYY-MM-DD");
let endISO = `${nextDay}T06:00:59.999+05:00`; // ✅ tumhari original logic

// 🔍 Ab check karte hain agar last day ka 6AM abhi future me hai
const endMomentPlanned = moment.tz(endISO, "YYYY-MM-DDTHH:mm:ss.SSSZ", "Asia/Karachi");
const now = moment.tz("Asia/Karachi");

if (now.isBefore(endMomentPlanned)) {
  // ✅ Agar abhi tak full 6AM window complete nahi hui,
  // to real-time tak ka data le lo
  endISO = now.toISOString();
}

console.log("📌 Start Window:", startISO);
console.log("📌 End Window  :", endISO);


  type EnergyGroupKey =
    | 'HT' | 'LT' | 'wapda' | 'solar' | 'unit4' | 'unit5'
    | 'Trafo1Incoming' | 'Trafo2Incoming' | 'Trafo3Incoming' | 'Trafo4Incoming'
    | 'Trafo1outgoing' | 'Trafo2outgoing' | 'Trafo3outgoing' | 'Trafo4outgoing'
    | 'Wapda2' | 'Niigata' | 'JMS' | 'PH_IC';

  const meterGroups: Record<EnergyGroupKey, string[]> = {
    HT: ['U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy'],
    LT: ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'],
    wapda: ['U23_GW01_Del_ActiveEnergy', 'U27_PLC_Del_ActiveEnergy'],
    solar: ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'],
    unit4: ['U19_PLC_Del_ActiveEnergy', 'U21_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy', 'U13_GW01_Del_ActiveEnergy'],
    unit5: ['U6_GW02_Del_ActiveEnergy', 'U13_GW02_Del_ActiveEnergy', 'U16_GW03_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'],
    Trafo1Incoming: ['U23_GW01_Del_ActiveEnergy'],
    Trafo2Incoming: ['U22_GW01_Del_ActiveEnergy'],
    Trafo3Incoming: ['U20_GW03_Del_ActiveEnergy'],
    Trafo4Incoming: ['U19_GW03_Del_ActiveEnergy'],
    Trafo1outgoing: ['U21_PLC_Del_ActiveEnergy'],
    Trafo2outgoing: ['U13_GW01_Del_ActiveEnergy'],
    Trafo3outgoing: ['U13_GW02_Del_ActiveEnergy'],
    Trafo4outgoing: ['U16_GW03_Del_ActiveEnergy'],
    Wapda2: ['U27_PLC_Del_ActiveEnergy'],
    Niigata: ['U22_PLC_Del_ActiveEnergy'],
    JMS: ['U26_PLC_Del_ActiveEnergy'],
    PH_IC: ['U23_GW01_Del_ActiveEnergy'],
  };

  const results: Record<string, any> = {};

  for (const [groupName, fields] of Object.entries(meterGroups) as [EnergyGroupKey, string[]][]) {
    const pipeline = [
      {
        $match: {
          $expr: {
            $and: [
              { $gte: [{ $toDate: "$timestamp" }, { $toDate: startISO }] },
              { $lt: [{ $toDate: "$timestamp" }, { $toDate: endISO }] }
            ]
          }
        }
      },
      { $addFields: { date: { $toDate: "$timestamp" } } },
      {
        $addFields: {
          month: {
            $dateTrunc: {
              date: "$date",
              unit: "month",
              timezone: "Asia/Karachi",
            }
          }
        }
      },
      { $sort: { date: 1 } },
      {
        $group: {
          _id: "$month",
          ...fields.reduce((acc, f) => {
            acc[f + "_first"] = { $first: "$" + f };
            acc[f + "_last"] = { $last: "$" + f };
            return acc;
          }, {} as any)
        }
      },
      {
        $project: {
          month: "$_id",
          _id: 0,
          value: {
            $sum: fields.map(f => ({
              $cond: [
                { $gt: [{ $abs: { $subtract: ["$" + f + "_last", "$" + f + "_first"] } }, 1e25] },
                0,
                { $subtract: ["$" + f + "_last", "$" + f + "_first"] }
              ]
            }))
          }
        }
      },
      { $sort: { month: 1 } }
    ];

    console.log(`🚀 Pipeline for ${groupName}:`, JSON.stringify(pipeline, null, 2));

    const data = await collection.aggregate(pipeline).toArray();
    console.log(`📊 Raw Data for ${groupName}:`, data);

    for (const item of data) {
      const monthStr = moment(item.month).tz("Asia/Karachi").format("YYYY-MM");
      const val = Math.round(item.value * 100) / 100;

      if (!results[monthStr]) {
        results[monthStr] = {
          date: monthStr,
          HT: 0, LT: 0, wapda: 0, solar: 0, unit4: 0, unit5: 0,
          Trafo1Incoming: 0, Trafo2Incoming: 0, Trafo3Incoming: 0, Trafo4Incoming: 0,
          Trafo1outgoing: 0, Trafo2outgoing: 0, Trafo3outgoing: 0, Trafo4outgoing: 0,
          Wapda2: 0, Niigata: 0, JMS: 0, PH_IC: 0,
          total_consumption: 0, total_generation: 0, unaccoutable_energy: 0,
          efficiency: 0.00, losses: 0
        };
      }

      results[monthStr][groupName] = val;
    }
  
  }

  // ✅ Final calculations
  for (const month of Object.values(results)) {
    month.total_consumption = +(month.unit4 + month.unit5).toFixed(2);
    month.total_generation = +(month.HT + month.LT + month.wapda + month.solar).toFixed(2);
    month.unaccountable_energy = +(month.total_consumption - month.total_generation).toFixed(2);
    month.efficiency = month.total_generation > 0
      ? +((month.total_consumption / month.total_generation) * 100).toFixed(2)
      : 0;

    const t1andt2incoming = month.Trafo1Incoming + month.Trafo2Incoming;
    const t1andt2outgoing = month.Trafo1outgoing + month.Trafo2outgoing;
    const t1and2losses = t1andt2incoming - t1andt2outgoing;
    const t3losses = month.Trafo3Incoming - month.Trafo3outgoing;
    const t4losses = month.Trafo4Incoming - month.Trafo4outgoing;
    const transformerlosses = t1and2losses + t3losses + t4losses;

    const HT_Transmission_Losses =
      (month.Wapda2 + month.Niigata + month.JMS) -
      (month.Trafo3Incoming + month.Trafo4Incoming + month.PH_IC);

    month.losses = +(transformerlosses + HT_Transmission_Losses).toFixed(2);
  }

  return Object.values(results).sort((a, b) => a.date.localeCompare(b.date));

}


}


  

 


  


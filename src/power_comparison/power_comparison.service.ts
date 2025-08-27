import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoClient } from 'mongodb';
// import * as moment from 'moment-timezone';
import * as moment from 'moment';
import { powercomparisonHistoricalDataDocument } from './schemas/power_comparison.schema';


@Injectable()
export class powercomparisonService {
  

  constructor(
    @InjectModel('power_comparison', 'surajcotton') private readonly conModel: Model<powercomparisonHistoricalDataDocument>,
  ) {}


async getPowerAverages(startDate: string, endDate: string) {
  const collection = this.conModel.collection;

  const startDateTime = moment.tz(startDate, "YYYY-MM-DD", "Asia/Karachi").startOf('day').utc().toDate();
  const endDateTime = moment.tz(endDate, "YYYY-MM-DD", "Asia/Karachi").endOf('day').utc().toDate();

  // Define tags
  const htTags = ['U23_GW01_Del_ActiveEnergy', 'U22_GW01_Del_ActiveEnergy', 'U20_GW03_Del_ActiveEnergy', 'U19_GW03_Del_ActiveEnergy'];
  const ltTags = ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'];
  const wapdaTags = ['U13_GW02_ActiveEnergy_Imp_kWh', 'U16_GW03_ActiveEnergy_Imp_kWh'];
  const solarTags = ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];
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
    const Wapda2Tags = ['U27_PLC_ActiveEnergy_Imp_kWh'];
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
      ht: +htTotal.toFixed(2),
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












async getDailyPowerAverages(start: string, end: string) {
  const collection = this.conModel.collection;

  // Meter groups
  const meterGroups = {
    HT: ['U23_GW01', 'U22_GW01', 'U20_GW03', 'U19_GW03'],
    LT: ['U19_PLC', 'U11_GW01'],
    wapda: ['U13_GW02', 'U16_GW03'],
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

  // Generate all meter keys and categorize them
  const meterGroupKeys: Record<string, string[]> = {};
  const allKeys: string[] = [];

  for (const group in meterGroups) {
    meterGroupKeys[group] = meterGroups[group].map(id => `${id}_${suffix}`);
    allKeys.push(...meterGroupKeys[group]);
  }

  // Projection
  const projection = allKeys.reduce((acc, key) => ({ ...acc, [key]: 1 }), { timestamp: 1 });

  const matchStage = {
    timestamp: {
      $gte: `${start}T00:00:00.000+05:00`,
      $lte: `${end}T23:59:59.999+05:00`,
    },
  };

  const docs = await collection.find(matchStage).project(projection).sort({ timestamp: 1 }).toArray();

  // Group by date
  const groupedByDate = docs.reduce((acc, doc) => {
    const date = doc.timestamp.substring(0, 10);
    if (!acc[date]) acc[date] = [];
    acc[date].push(doc);
    return acc;
  }, {} as Record<string, any[]>);

  type DailyResult = {
    date: string;
    HT: number;
    LT: number;
    wapda: number;
    solar: number;
    unit4: number;
    unit5: number;
    // Trafo1Incoming: number;
    // Trafo2Incoming: number;
    // Trafo3Incoming: number;
    // Trafo4Incoming: number;
    // Trafo1outgoing: number;
    // Trafo2outgoing: number;
    // Trafo3outgoing: number;
    // Trafo4outgoing: number;
    // Wapda2: number;
    // Niigata: number;
    // JMS: number;
    // PH_IC: number;
    losses: number;
    totalConsumption: number;
    totalgeneration: number;
    unaccountable_energy: number;
    efficiency: number;
  };

  const dailyResults: DailyResult[] = [];

  // Helper to check for invalid values
  const isInvalid = (val: number) => Math.abs(val) < 1e-5 || Math.abs(val) > 1e8;

  for (const date in groupedByDate) {
    const [firstDoc, ...rest] = groupedByDate[date];
    const lastDoc = groupedByDate[date][groupedByDate[date].length - 1];

    const consumption: Record<string, number> = {};

    for (const key of allKeys) {
      let first = firstDoc[key] ?? 0;
      let last = lastDoc[key] ?? 0;

      // Skip if data is invalid or missing
      if (isInvalid(first)) first = 0;
      if (isInvalid(last)) last = 0;

      const diff = last - first;
      consumption[key] = isInvalid(diff) ? 0 : diff;
    }

    const sum = (keys: string[]) => keys.reduce((sum, key) => sum + (consumption[key] || 0), 0);

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

    // Losses calculations
    const t1andt2incoming = Trafo1Incoming + Trafo2Incoming;
    const t1andt2outgoing = Trafo1outgoing + Trafo2outgoing;
    const t1and2losses = t1andt2incoming - t1andt2outgoing;
    const t3losses = Trafo3Incoming - Trafo3outgoing;
    const t4losses = Trafo4Incoming - Trafo4outgoing;
    const transformerlosses = t1and2losses + t3losses + t4losses;
    const HT_Transmission_Losses = (Wapda2 + Niigata + JMS) - (Trafo3Incoming + Trafo4Incoming + PH_IC);
    const losses = transformerlosses + HT_Transmission_Losses;

    const totalConsumption = unit4 + unit5;
    const totalgeneration = ht + lt + wapda + solar;
    const unaccountable_energy = totalConsumption - totalgeneration;
    const Efficiency = (totalConsumption / totalgeneration) * 100;

    // Push the result into the dailyResults array
    dailyResults.push({
      date,
      HT: +ht.toFixed(2),
      LT: +lt.toFixed(2),
      wapda: +wapda.toFixed(2),
      solar: +solar.toFixed(2),
      unit4: +unit4.toFixed(2),
      unit5: +unit5.toFixed(2),
      // Trafo1Incoming: +Trafo1Incoming.toFixed(2),
      // Trafo2Incoming: +Trafo2Incoming.toFixed(2),
      // Trafo3Incoming: +Trafo3Incoming.toFixed(2),
      // Trafo4Incoming: +Trafo4Incoming.toFixed(2),
      // Trafo1outgoing: +Trafo1outgoing.toFixed(2),
      // Trafo2outgoing: +Trafo2outgoing.toFixed(2),
      // Trafo3outgoing: +Trafo3outgoing.toFixed(2),
      // Trafo4outgoing: +Trafo4outgoing.toFixed(2),
      // Wapda2: +Wapda2.toFixed(2),
      // Niigata: +Niigata.toFixed(2),
      // JMS: +JMS.toFixed(2),
      // PH_IC: +PH_IC.toFixed(2),
      losses: +losses.toFixed(2),
      totalConsumption: +totalConsumption.toFixed(2),
      totalgeneration: +totalgeneration.toFixed(2),
      unaccountable_energy: +unaccountable_energy.toFixed(2),
      efficiency: +Efficiency.toFixed(2),
    });
  }

  return dailyResults;
}







async getMonthlyAverages(startDate: string, endDate: string) {
  const collection = this.conModel.collection;

  const startISO = new Date(startDate + 'T00:00:00.000Z');
  const endISO = new Date(endDate + 'T23:59:59.999Z');

  type EnergyGroupKey = 'HT' | 'LT' | 'wapda' | 'solar' | 'unit4' | 'unit5' | 'Trafo1Incoming'| 'Trafo2Incoming'
  | 'Trafo3Incoming' | 'Trafo4Incoming' | 'Trafo1outgoing' | 'Trafo2outgoing' | 'Trafo3outgoing' | 'Trafo4outgoing'
  | 'Wapda2' | 'Niigata'| 'JMS'| 'PH_IC';

  const meterGroups: Record<EnergyGroupKey, string[]> = {
    HT: ['U23_GW01_Del_ActiveEnergy', 'U22_GW01_Del_ActiveEnergy', 'U20_GW03_Del_ActiveEnergy', 'U19_GW03_Del_ActiveEnergy'],
    LT: ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'],
    wapda: ['U13_GW02_ActiveEnergy_Imp_kWh', 'U16_GW03_ActiveEnergy_Imp_kWh'],
    solar: ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'],
    unit4: ['U19_PLC_Del_ActiveEnergy', 'U21_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy', 'U13_GW01_Del_ActiveEnergy'],
    unit5: ['U6_GW02_Del_ActiveEnergy', 'U13_GW02_Del_ActiveEnergy', 'U16_GW03_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'],
    Trafo1Incoming:['U23_GW01_Del_ActiveEnergy'],
    Trafo2Incoming: ['U22_GW01_Del_ActiveEnergy'],
    Trafo3Incoming: ['U20_GW03_Del_ActiveEnergy'],
    Trafo4Incoming: ['U19_GW03_Del_ActiveEnergy'],
    Trafo1outgoing: ['U21_PLC_Del_ActiveEnergy'],
    Trafo2outgoing: ['U13_GW01_Del_ActiveEnergy'],
    Trafo3outgoing: ['U13_GW02_Del_ActiveEnergy'],
    Trafo4outgoing: ['U16_GW03_Del_ActiveEnergy'],
    Wapda2: ['U27_PLC_ActiveEnergy_Imp_kWh'],
    Niigata: ['U22_PLC_Del_ActiveEnergy'],
    JMS: ['U26_PLC_Del_ActiveEnergy'],
    PH_IC: ['U23_GW01_Del_ActiveEnergy'],
  
  };

  const results: Record<string, any> = {};

  for (const [groupName, fields] of Object.entries(meterGroups) as [EnergyGroupKey, string[]][]) {
    const projectFields: Record<string, any> = {};
    fields.forEach(f => {
      projectFields[f] = 1;
    });

    const pipeline = [
      {
        $match: {
          $expr: {
            $and: [
              { $gte: [{ $toDate: "$timestamp" }, startISO] },
              { $lte: [{ $toDate: "$timestamp" }, endISO] }
            ]
          }
        }
      },
      {
        $addFields: {
          date: { $toDate: "$timestamp" }
        }
      },
      {
        $addFields: {
          month: {
            $dateTrunc: {
              date: "$date",
              unit: "month"
            }
          }
        }
      },
      {
        $sort: { date: 1 }
      },
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
                {
                  $gt: [
                    { $abs: { $subtract: ["$" + f + "_last", "$" + f + "_first"] } },
                    1e25
                  ]
                },
                0,
                { $subtract: ["$" + f + "_last", "$" + f + "_first"] }
              ]
            }))
          }
        }
      },
      { $sort: { month: 1 } }
    ];

    const data = await collection.aggregate(pipeline).toArray();

    for (const item of data) {
      const monthStr = item.month.toISOString().slice(0, 7);
      const val = Math.round(item.value * 100) / 100;

      if (!results[monthStr]) {
        results[monthStr] = {
          date: monthStr,
          HT: 0,
          LT: 0,
          wapda: 0,
          solar: 0,
          unit4: 0,
          unit5: 0,
          Trafo1Incoming:0,
          Trafo2Incoming:0,
          Trafo3Incoming:0,
          Trafo4Incoming:0,
          Trafo1outgoing:0,
          Trafo2outgoing:0,
          Trafo3outgoing:0,
          Trafo4outgoing:0,
          Wapda2:0,
          Niigata:0,
          JMS:0,
          PH_IC:0,
          total_consumption: 0,
          total_generation: 0,
          unaccoutable_energy: 0,
          efficiency: 0.00
        };
      }

      results[monthStr][groupName] = val;
    }
  }

  // Final calculations
 for (const month of Object.values(results)) {
    // Calculate total consumption and generation
    month.total_consumption = Math.round((month.unit4 + month.unit5) * 100) / 100;
    month.total_generation = Math.round((month.HT + month.LT + month.wapda + month.solar) * 100) / 100;
    month.unaccountable_energy = Math.round((month.total_consumption - month.total_generation) * 100) / 100;
  
    // Calculate efficiency
    month.efficiency = month.total_generation > 0
      ? Math.round((month.total_consumption / month.total_generation) * 100 * 100) / 100
      : 0;
  
    // Add transformer losses and HT transmission losses calculations
    const t1andt2incoming = month.Trafo1Incoming + month.Trafo2Incoming;
    const t1andt2outgoing = month.Trafo1outgoing + month.Trafo2outgoing;
    const t1and2losses = t1andt2incoming - t1andt2outgoing;
    const t3losses = month.Trafo3Incoming - month.Trafo3outgoing;
    const t4losses = month.Trafo4Incoming - month.Trafo4outgoing;
    const transformerlosses = t1and2losses + t3losses + t4losses;

    const HT_Transmission_Losses = (month.Wapda2 + month.Niigata + month.JMS) - (month.Trafo3Incoming + month.Trafo4Incoming + month.PH_IC);
    
    // Calculate total losses
    const losses = transformerlosses + HT_Transmission_Losses;

    // Add the losses to the month object
    month.losses = Math.round(losses * 100) / 100;
}


  return Object.values(results).sort((a, b) => a.date.localeCompare(b.date));
}




}

  


  


  

 


  


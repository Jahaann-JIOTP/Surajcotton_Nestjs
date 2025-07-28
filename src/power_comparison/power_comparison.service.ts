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
  const htTags = ['U21_PLC_Del_ActiveEnergy', 'U13_GW01_Del_ActiveEnergy', 'U16_GW03_Del_ActiveEnergy', 'U13_GW02_Del_ActiveEnergy'];
  const ltTags = ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'];
  const wapdaTags = ['U13_GW02_ActiveEnergy_Imp_kWh', 'U16_GW03_ActiveEnergy_Imp_kWh'];
  const solarTags = ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];
  const unit4Tags = ['U19_PLC_Del_ActiveEnergy', 'U21_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy', 'U13_GW01_Del_ActiveEnergy'];
  const unit5Tags = ['U6_GW02_Del_ActiveEnergy', 'U13_GW02_Del_ActiveEnergy', 'U16_GW03_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];

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
          [...htTags, ...ltTags, ...wapdaTags, ...solarTags, ...unit4Tags, ...unit5Tags].flatMap(tag => [
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
    HT: ['U21_PLC', 'U13_GW01', 'U16_GW03','U13_GW02'],
    LT: ['U19_PLC', 'U11_GW01'],

    wapda: ['U13_GW02', 'U16_GW03'],
    solar: ["U6_GW02", "U17_GW03"],
    unit4: [
      'U19_PLC', 'U21_PLC', 'U11_GW01', 'U13_GW01'
      
    ],
    unit5: [
     'U6_GW02', 'U13_GW02', 'U16_GW03', 'U17_GW03'
    ]
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
    totalConsumption: number;
    totalgeneration: number;
    unaccountable_energy: number;
    Efficiency: number;
  };

  const dailyResults: DailyResult[] = [];

  for (const date in groupedByDate) {
    const [firstDoc, ...rest] = groupedByDate[date];
    const lastDoc = groupedByDate[date][groupedByDate[date].length - 1];

const isInvalid = (val: number) => Math.abs(val) < 1e-5 || Math.abs(val) > 1e8;

const consumption: Record<string, number> = {};
for (const key of allKeys) {
  let first = firstDoc[key] ?? 0;
  let last = lastDoc[key] ?? 0;

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

    const totalConsumption = unit4 + unit5;
    const totalgeneration = ht + lt + wapda + solar;
    const unaccountable_energy = totalConsumption - totalgeneration;
    const Efficiency = (totalConsumption / totalgeneration) * 100;

    dailyResults.push({
      date,
      HT: +ht.toFixed(2),
      LT: +lt.toFixed(2),
      wapda: +wapda.toFixed(2),
      solar: +solar.toFixed(2),
      unit4: +unit4.toFixed(2),
      unit5: +unit5.toFixed(2),
      totalConsumption: +totalConsumption.toFixed(2),
      totalgeneration: +totalgeneration.toFixed(2),
      unaccountable_energy: +unaccountable_energy.toFixed(2),
      Efficiency: +Efficiency.toFixed(2),
    });
  }

  return dailyResults;
}






async getMonthlyAverages(startDate: string, endDate: string) {
  const collection = this.conModel.collection;

  const startISO = new Date(startDate + 'T00:00:00.000Z');
  const endISO = new Date(endDate + 'T23:59:59.999Z');

  type EnergyGroupKey = 'HT' | 'LT' | 'wapda' | 'solar' | 'unit4' | 'unit5';

  const meterGroups: Record<EnergyGroupKey, string[]> = {
    HT: ['U21_PLC_Del_ActiveEnergy', 'U13_GW01_Del_ActiveEnergy', 'U16_GW03_Del_ActiveEnergy', 'U13_GW02_Del_ActiveEnergy'],
    LT: ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'],
    wapda: ['U13_GW02_ActiveEnergy_Imp_kWh', 'U16_GW03_ActiveEnergy_Imp_kWh'],
    solar: ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'],
    unit4: ['U19_PLC_Del_ActiveEnergy', 'U21_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy', 'U13_GW01_Del_ActiveEnergy'],
    unit5: ['U6_GW02_Del_ActiveEnergy', 'U13_GW02_Del_ActiveEnergy', 'U16_GW03_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'],
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
          total_consumption: 0,
          total_generation: 0,
          unaccoutable_energy: 0,
          efficiency: '0.00'
        };
      }

      results[monthStr][groupName] = val;
    }
  }

  // Final calculations
  for (const month of Object.values(results)) {
    month.total_consumption = Math.round((month.unit4 + month.unit5) * 100) / 100;
    month.total_generation = Math.round((month.HT + month.LT + month.wapda + month.solar) * 100) / 100;
    month.unaccoutable_energy = Math.round((month.total_consumption - month.total_generation) * 100) / 100;
    month.efficiency = (
      month.total_generation > 0
        ? ((month.total_consumption / month.total_generation) * 100)
        : 0
    ).toFixed(2);
  }

  return Object.values(results).sort((a, b) => a.date.localeCompare(b.date));
}




}

  


  


  

 


  


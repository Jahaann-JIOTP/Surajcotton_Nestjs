import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment';
import { Unit5LT4 } from './schemas/unit5_LT4.schema';


@Injectable()
export class Unit5LT4Service {
  constructor(
    @InjectModel(Unit5LT4.name, 'surajcotton')
    private readonly unitModel: Model<Unit5LT4>,
  ) {}

  async getSankeyData(startDate: string, endDate: string) {
    // Convert to ISO without timezone issues
   const TZ = 'Asia/Karachi';
      const start = moment.tz(startDate, "YYYY-MM-DD", TZ).startOf("day").toDate();
      const end   = moment.tz(endDate, "YYYY-MM-DD", TZ).endOf("day").toDate();

        const meterMap: Record<string, string> = {
     U1_GW03: 'Ring Frame 7-9',
     U2_GW03: 'Yarn Conditioning M/C',
     U3_GW03: 'MLDB3 Single room quarter',
     U4_GW03: 'Roving transport system',
     U5_GW03: 'ring Frame 10-12',
     U6_GW03: 'Comber MCS 1-14',
     U7_GW03: 'Spare',
     U8_GW03: 'Spare2',
     U9_GW03: 'Ring Frame 13-15',
     U10_GW03: 'Auto Con-linker Conner M/S 10-12',
     U11_GW03: 'Baling Press ',
     U12_GW03: 'Ring Frame 16-18',
     U13_GW03: 'Fiber Deposit Plant',
     U14_GW03: 'MLDB2 Ring Con',
     U15_GW03: 'Deep Valve Turbine',
     U18_GW03: 'PF Panel',
    //  U19_GW03: 'wapda + HFO + Gas Incoming',
    //  U20_GW03: 'WAPDA + HFO + Gas Outgoing T/F 3',
    //  U21_GW03: 'WAPDA + HFO + Gas Outgoing T/F 4',
     U22_GW03: 'PDB 07',
     U23_GW03: 'PDB 10',


    };

    const meterFields = [
      'U16_GW03_Del_ActiveEnergy', // TF3
      'U17_GW03_Del_ActiveEnergy', // solar2
      ...Object.keys(meterMap).map((m) => `${m}_Del_ActiveEnergy`),
    ];

    // ----------------- Aggregation pipeline -----------------
    const projection: any = {};
    meterFields.forEach(field => {
      projection[`first_${field}`] = { $first: `$${field}` };
      projection[`last_${field}`] = { $last: `$${field}` };
    });

       const pipeline: any[] = [
  // 1) Normalize timestamp -> Date (works even if already Date)
  { $addFields: { ts: { $toDate: "$timestamp" } } },

  // 2) Filter on true Date objects (no string compare)
  { $match: { ts: { $gte: start, $lte: end } } },

  // 3) Build day bucket in Asia/Karachi (not UTC)
  { $addFields: {
      day: {
        $dateToString: { format: "%Y-%m-%d", date: "$ts", timezone: TZ }
      }
    }
  },

  // 4) Ensure proper order so $first/$last are correct
  { $sort: { ts: 1 } },

  // 5) Group per local day
  { $group: { _id: "$day", ...projection } },

  // 6) Defensive re-filter by day string range (same format)
  { $match: { _id: { $gte: startDate, $lte: endDate } } },
];

    const results = await this.unitModel.aggregate(pipeline).exec();

    // console.log('📅 Dates returned by aggregation:', results.map(r => r._id));

    // ----------------- Sum consumption for all selected dates -----------------
    const consumptionTotals: Record<string, number> = {};
    meterFields.forEach(field => consumptionTotals[field] = 0);

    for (const entry of results) {
      // console.log(`\n🗓 Processing date: ${entry._id}`);
      for (const field of meterFields) {
        const first = entry[`first_${field}`] || 0;
        const last = entry[`last_${field}`] || 0;
        const consumption = last - first;
        // console.log(`Meter: ${field}, First: ${first}, Last: ${last}, Consumption: ${consumption}`);
        if (!isNaN(consumption) && consumption >= 0) {
          consumptionTotals[field] += parseFloat(consumption.toFixed(2));
        }
      }
    }

    // ----------------- Prepare Sankey Data -----------------
        const tf4 = +consumptionTotals['U16_GW03_Del_ActiveEnergy'].toFixed(2);
    const solar2 = +consumptionTotals['U17_GW03_Del_ActiveEnergy'].toFixed(2);
    const totalLT4 = +(tf4 + solar2).toFixed(2);

    const sankeyData = [
      { from: 'TF4', to: 'TotalLT4', value: tf4 },
      { from: 'Solar2', to: 'TotalLT4', value: solar2 },
      ...Object.entries(meterMap).map(([meter, label]) => {
        const key = `${meter}_Del_ActiveEnergy`;
        return {
          from: 'TotalLT4',
          to: label,
          value: +(consumptionTotals[key] || 0).toFixed(2),
        };
      }),
    ];

    return sankeyData;
  }
}
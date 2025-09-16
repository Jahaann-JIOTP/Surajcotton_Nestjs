import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment';
import { Unit5LT3 } from './schemas/unit5_LT3.schema';

@Injectable()
export class Unit5LT3Service {
  constructor(
    @InjectModel(Unit5LT3.name, 'surajcotton')
    private readonly unitModel: Model<Unit5LT3>,
  ) {}

  async getSankeyData(startDate: string, endDate: string) {
    // Convert to ISO without timezone issues
     const start = new Date(moment(startDate, 'YYYY-MM-DD').startOf('day').toDate());
        const end   = new Date(moment(endDate, 'YYYY-MM-DD').endOf('day').toDate());
        const TZ = 'Asia/Karachi';

    const meterMap: Record<string, string> = {
      U1_GW02: 'PDB CD1',
      U2_GW02: 'PDB CD2',
      U3_GW02: 'Card PDB 01',
      U4_GW02: 'PDB 8',
      U5_GW02: 'PF Panel',
      U7_GW02: 'Ring 1-3',
      U8_GW02: 'A/C Plant spinning',
      U9_GW02: 'Blow Room L1',
      U10_GW02: 'Ring Frames 4-6',
      U11_GW02: 'A/C Plant Blowing',
      U12_GW02: 'MLDB1 Blower room card',
      U14_GW02: 'Spare',
      U15_GW02: 'AC Plant spinning',
      U16_GW02: 'Water Chiller',
      U17_GW02: 'Card M/C 8-14',
      U18_GW02: 'Auto Con-link Conner 1-9',
      U19_GW02: 'Card M/C 1-7',
      U20_GW02: 'AC Plant winding',
      U21_GW02: 'Simplex M/C S1-5',
      U22_GW02: 'Spare',
      U23_GW02: 'Draw Frame Finish',
    };

    const meterFields = [
      'U13_GW02_Del_ActiveEnergy', // TF3
      'U6_GW02_Del_ActiveEnergy',  // Solar
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
    const tf3 = +consumptionTotals['U13_GW02_Del_ActiveEnergy'].toFixed(2);
    const solar = +consumptionTotals['U6_GW02_Del_ActiveEnergy'].toFixed(2);

    const sankeyData = [
      { from: 'TF3', to: 'TotalLT3', value: tf3 },
      { from: 'Solar', to: 'TotalLT3', value: solar },
      ...Object.entries(meterMap).map(([meter, label]) => ({
        from: 'TotalLT3',
        to: label,
        value: +(consumptionTotals[`${meter}_Del_ActiveEnergy`] || 0).toFixed(2),
      }))
    ];

    return sankeyData;
  }
}

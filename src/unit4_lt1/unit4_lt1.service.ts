import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment';
import { Unit4LT1 } from './schemas/unit4_LT1.schema';


@Injectable()
export class Unit4LT1Service {
  constructor(
    @InjectModel(Unit4LT1.name, 'surajcotton')
    private readonly unitModel: Model<Unit4LT1>,
  ) {}

  async getSankeyData(startDate: string, endDate: string) {
    // Convert to ISO without timezone issues
    const start = moment(startDate, 'YYYY-MM-DD').startOf('day').toISOString();
    const end = moment(endDate, 'YYYY-MM-DD').endOf('day').toISOString();

    const meterMap: Record<string, string> = {
      U1_PLC: 'Transport',
      U2_PLC: 'Unit 05 Aux',
      U3_PLC: 'Light External',
      U4_PLC: 'Light Internal',
      U5_PLC: 'Power House 2nd Source',
      U6_PLC: 'Turbine',
      U7_PLC: 'Spare',
      U8_PLC: 'Drawing 01',
      U9_PLC: 'Winding 01',
      U10_PLC: 'Ring 01',
      U11_PLC: 'Ring 5',
      U12_PLC: 'Ring 6(Auto Cone 1-9)',
      U13_PLC: 'Comber 1',
      U14_PLC: 'Compressor',
      U15_PLC: 'Simplex 01',
      U16_PLC: 'Compressor 02 (90kW)',
      U17_PLC: 'Ring AC',
      U18_PLC: 'Ring AC (Bypass)',
      U20_PLC: 'Diesel + Gas Incoming',
    };

    const meterFields = [
      'U21_PLC_Del_ActiveEnergy', // TF1
      'U19_PLC_Del_ActiveEnergy', // LT Gen
      ...Object.keys(meterMap).map((m) => `${m}_Del_ActiveEnergy`),
    ];

    // ----------------- Aggregation pipeline -----------------
    const projection: any = {};
    meterFields.forEach(field => {
      projection[`first_${field}`] = { $first: `$${field}` };
      projection[`last_${field}`] = { $last: `$${field}` };
    });

    const pipeline: any[] = [
      {
        $match: {
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $addFields: {
          dateOnly: { $substr: ['$timestamp', 0, 10] }, // YYYY-MM-DD
        },
      },
      {
        $sort: { timestamp: 1 as 1 }, // TypeScript safe
      },
      {
        $group: { _id: '$dateOnly', ...projection },
      },
      {
        $match: { _id: { $gte: startDate, $lte: endDate } }, // ✅ Only selected dates
      },
    ];

    const results = await this.unitModel.aggregate(pipeline).exec();

    console.log('📅 Dates returned by aggregation:', results.map(r => r._id));

    // ----------------- Sum consumption for all selected dates -----------------
    const consumptionTotals: Record<string, number> = {};
    meterFields.forEach(field => consumptionTotals[field] = 0);

    for (const entry of results) {
      console.log(`\n🗓 Processing date: ${entry._id}`);
      for (const field of meterFields) {
        const first = entry[`first_${field}`] || 0;
        const last = entry[`last_${field}`] || 0;
        const consumption = last - first;
        console.log(`Meter: ${field}, First: ${first}, Last: ${last}, Consumption: ${consumption}`);
        if (!isNaN(consumption) && consumption >= 0) {
          consumptionTotals[field] += parseFloat(consumption.toFixed(2));
        }
      }
    }

    // ----------------- Prepare Sankey Data -----------------
    // Step 4: Create Sankey format
    // Step 4: Create Sankey format
    const tf1 = +consumptionTotals['U21_PLC_Del_ActiveEnergy'].toFixed(2);
    const ltGen = +consumptionTotals['U19_PLC_Del_ActiveEnergy'].toFixed(2);
    const totalLT1 = +(tf1 + ltGen).toFixed(2);

    const sankeyData = [
      { from: 'TF1', to: 'TotalLT1', value: tf1 },
      { from: 'LTGen', to: 'TotalLT1', value: ltGen },
      ...Object.entries(meterMap).map(([meter, label]) => {
        const key = `${meter}_Del_ActiveEnergy`;
        return {
          from: 'TotalLT1',
          to: label,
          value: +(consumptionTotals[key] || 0).toFixed(2),
        };
      }),
    ];

    return sankeyData;
  }
}

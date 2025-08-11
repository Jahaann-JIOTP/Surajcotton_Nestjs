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
    const start = moment(startDate).startOf('day').toISOString();
    const end = moment(endDate).endOf('day').toISOString();

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

    // Step 1: Projection for aggregation
    const projection: any = {};
    meterFields.forEach(field => {
      projection[`first_${field}`] = { $first: `$${field}` };
      projection[`last_${field}`] = { $last: `$${field}` };
    });

    // Step 2: Aggregation pipeline
    const pipeline = [
      {
        $match: {
          timestamp: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $addFields: {
          dateOnly: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $toDate: '$timestamp' },
            },
          },
        },
      },
      {
        $sort: { timestamp: 1 } as const, // ✅ Type-safe sort
      },
      {
        $group: {
          _id: '$dateOnly',
          ...projection,
        },
      },
    ];

    const results = await this.unitModel.aggregate(pipeline).exec();

    // Step 3: Calculate total consumption
    const consumptionTotals: Record<string, number> = {};
    meterFields.forEach(field => consumptionTotals[field] = 0);

    for (const entry of results) {
      for (const field of meterFields) {
        const first = entry[`first_${field}`] || 0;
        const last = entry[`last_${field}`] || 0;
        let consumption = last - first;

        const isExponential =
          Math.abs(consumption) > 1e12 || String(consumption).includes('e');

        if (!isNaN(consumption) && consumption >= 0 && !isExponential) {
          consumptionTotals[field] += parseFloat(consumption.toFixed(2));
        }
      }
    }

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

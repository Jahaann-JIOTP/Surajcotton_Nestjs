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
    const start = moment(startDate).startOf('day').toISOString();
    const end = moment(endDate).endOf('day').toISOString();

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
      'U6_GW02_Del_ActiveEnergy', // solar
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
    const tf3 = +consumptionTotals['U13_GW02_Del_ActiveEnergy'].toFixed(2);
    const solar = +consumptionTotals['U6_GW02_Del_ActiveEnergy'].toFixed(2);
    const totalLT3 = +(tf3 + solar).toFixed(2);

    const sankeyData = [
      { from: 'TF3', to: 'TotalLT3', value: tf3 },
      { from: 'Solar', to: 'TotalLT3', value: solar },
      ...Object.entries(meterMap).map(([meter, label]) => {
        const key = `${meter}_Del_ActiveEnergy`;
        return {
          from: 'TotalLT3',
          to: label,
          value: +(consumptionTotals[key] || 0).toFixed(2),
        };
      }),
    ];

    return sankeyData;
  }
}

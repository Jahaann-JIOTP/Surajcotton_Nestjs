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
    const start = moment(startDate).startOf('day');
    const end = moment(endDate).endOf('day');

    const allDates: string[] = [];
    const current = moment(start);
    while (current <= end) {
      allDates.push(current.format('YYYY-MM-DD'));
      current.add(1, 'day');
    }

    // Meter labels (excluding TF1 and LT Gen)
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

    // All meter fields including TF1 & LT Gen
    const meterFields = [
      'U19_PLC_Del_ActiveEnergy', // TF1
      'U21_PLC_Del_ActiveEnergy', // LT Gen
      ...Object.keys(meterMap).map((m) => `${m}_Del_ActiveEnergy`),
    ];

    // Initialize totals
    const consumptionTotals: Record<string, number> = {};
    meterFields.forEach((field) => (consumptionTotals[field] = 0));

    // 🔁 Loop through each day
    for (const day of allDates) {
      const dayStart = moment(day).startOf('day').toISOString();
      const dayEnd = moment(day).endOf('day').toISOString();

      const dayData = await this.unitModel
        .find({ timestamp: { $gte: dayStart, $lte: dayEnd } })
        .sort({ timestamp: 1 })
        .lean();

      if (!dayData || dayData.length === 0) continue;

      const first = dayData[0];
      const last = dayData[dayData.length - 1];

    for (const field of meterFields) {
  const startVal = first[field] || 0;
  const endVal = last[field] || 0;
  let consumption = endVal - startVal;

  const isExponential = Math.abs(consumption) > 1e12 || String(consumption).includes('e');

  if (!isNaN(consumption) && consumption >= 0 && !isExponential) {
    consumptionTotals[field] += parseFloat(consumption.toFixed(2));
  } else {
    consumptionTotals[field] += 0; // Treat as zero
  }
}

    }

    // Final consumption
    const tf1 = consumptionTotals['U19_PLC_Del_ActiveEnergy'];
    const ltGen = consumptionTotals['U21_PLC_Del_ActiveEnergy'];
    const totalLT1 = parseFloat((tf1 + ltGen).toFixed(2));

    // Format output
    const others = [
      { to: 'totalLT1', value: totalLT1 },
      ...Object.entries(meterMap).map(([meter, label]) => {
        const key = `${meter}_Del_ActiveEnergy`;
        return {
          from: 'totalLT1',
          to: label,
          value: parseFloat((consumptionTotals[key] || 0).toFixed(2)),
        };
      }),
    ];

    return {
      tf1: parseFloat(tf1.toFixed(2)),
      ltGen: parseFloat(ltGen.toFixed(2)),
      totalLT1,
      others,
    };
  }
}

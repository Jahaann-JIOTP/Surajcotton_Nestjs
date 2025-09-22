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

async getSankeyData(payload: { startDate: string; endDate: string; startTime?: string; endTime?: string }) {
  const TZ = 'Asia/Karachi';

  let start: Date;
  let end: Date;

  // If both startTime and endTime are provided, combine them with startDate and endDate
  if (payload.startTime && payload.endTime) {
    // Combine startDate and startTime for the exact start time
    start = moment.tz(`${payload.startDate} ${payload.startTime}`, "YYYY-MM-DD HH:mm", TZ).startOf('minute').toDate();

    // Combine endDate and endTime for the exact end time
    end = moment.tz(`${payload.endDate} ${payload.endTime}`, "YYYY-MM-DD HH:mm", TZ).endOf('minute').toDate();

    // Log the exact start and end times for debugging
    // console.log("📌 Calculated Start Time:", moment(start).tz(TZ).format("YYYY-MM-DD HH:mm:ss"));
    // console.log("📌 Calculated End Time:", moment(end).tz(TZ).format("YYYY-MM-DD HH:mm:ss"));
  } else {
    // Default to 6 AM to 6 AM next day if no startTime/endTime is provided
    start = moment.tz(payload.startDate, "YYYY-MM-DD", TZ).set('hour', 6).set('minute', 0).set('second', 0).set('millisecond', 0).toDate();
    end = moment.tz(payload.endDate, "YYYY-MM-DD", TZ).add(1, 'days').set('hour', 6).set('minute', 0).set('second', 0).set('millisecond', 0).toDate();
  }

  // Log the final calculated start and end times for debugging
  // console.log("📌 Final Start Time (Karachi):", moment(start).tz(TZ).format("YYYY-MM-DD HH:mm:ss"));
  // console.log("📌 Final End Time (Karachi):", moment(end).tz(TZ).format("YYYY-MM-DD HH:mm:ss"));

    // Meter field mapping (unchanged)
    const meterMap: Record<string, string> = {
      U1_PLC: 'Transport',
      U2_PLC: 'Unit 05 Lighting',
      U3_PLC: 'Light Outside',
      U4_PLC: 'Light Inside',
      U5_PLC: 'Power House',
      U6_PLC: 'Turbine',
      // U7_PLC: 'Main Meter',
      U8_PLC: 'Drawing Finisher 1~6+2 Breaker',
      U9_PLC: 'Winding 7~9',
      U10_PLC: 'Ring 1~4',
      U11_PLC: 'Ring 16~20',
      U12_PLC: 'Ring 21~24',
      U13_PLC: 'Comber 1~10+ Uni Lap 1-2',
      U14_PLC: 'Compressor',
      U15_PLC: 'Simplex 1~6',
      U16_PLC: 'Compressor 2',
      U17_PLC: 'Ring AC',
      U18_PLC: 'Ring AC (Bypass)',
      U20_PLC: 'Compressor (Bypass)',
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
      { $addFields: { ts: { $toDate: "$timestamp" } } },
      { $match: { ts: { $gte: start, $lte: end } } },
      { $addFields: {
          day: {
            $dateToString: { format: "%Y-%m-%d", date: "$ts", timezone: TZ }
          }
        }
      },
      { $sort: { ts: 1 } },
      { $group: { _id: "$day", ...projection } },
      { $match: { _id: { $gte: payload.startDate, $lte: payload.endDate } } },
    ];

    const results = await this.unitModel.aggregate(pipeline).exec();

    // ----------------- Sum consumption for all selected dates -----------------
    const consumptionTotals: Record<string, number> = {};
    meterFields.forEach(field => consumptionTotals[field] = 0);

    for (const entry of results) {
      for (const field of meterFields) {
        const first = entry[`first_${field}`] || 0;
        const last = entry[`last_${field}`] || 0;
        const consumption = last - first;
        if (!isNaN(consumption) && consumption >= 0) {
          consumptionTotals[field] += parseFloat(consumption.toFixed(2));
        }
      }
    }

    // ----------------- Prepare Sankey Data -----------------
    const tf1 = +consumptionTotals['U21_PLC_Del_ActiveEnergy'].toFixed(2);
    const ltGen = +consumptionTotals['U19_PLC_Del_ActiveEnergy'].toFixed(2);
    const totalLT1 = +(tf1 + ltGen).toFixed(2);

    const sankeyData = [
      { from: 'Wapda+HFO+JMS Incoming', to: 'TotalLT1', value: tf1 },
      { from: 'Diesel+JGS Incomming', to: 'TotalLT1', value: ltGen },
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

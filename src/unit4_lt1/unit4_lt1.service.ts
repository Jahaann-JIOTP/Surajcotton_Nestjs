import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { Unit4LT1 } from './schemas/unit4_LT1.schema';

@Injectable()
export class Unit4LT1Service {
  constructor(
    @InjectModel(Unit4LT1.name, 'surajcotton')
    private readonly unitModel: Model<Unit4LT1>,
  ) {}

  async getSankeyData(payload: { startDate: string; endDate: string; startTime?: string; endTime?: string }) {
    const TZ = 'Asia/Karachi';

    let startISO: string;
    let endISO: string;

    // ---------------- Determine start & end ISO ----------------
    if (payload.startTime && payload.endTime) {
      // Custom time window
      let startMoment = moment.tz(`${payload.startDate} ${payload.startTime}`, "YYYY-MM-DD HH:mm", TZ)
    .startOf('minute').toDate();
      let endMoment = moment.tz(`${payload.endDate} ${payload.endTime}`, "YYYY-MM-DD HH:mm", TZ)
    .endOf('minute').toDate();
     

      startISO = startMoment.toISOString();
      endISO = endMoment.toISOString();
    } else {
      // Default 6AM → 6AM next day
      startISO = `${payload.startDate}T06:00:00.000+05:00`;
      const nextDay = moment(payload.endDate).add(1, 'day').format('YYYY-MM-DD');
      endISO = `${nextDay}T06:00:59.999+05:00`;
    }

    console.log("📌 Start ISO:", startISO);
    console.log("📌 End ISO:", endISO);

    // ---------------- Meter setup ----------------
    const meterMap: Record<string, string> = {
      U1_PLC: 'Transport', U2_PLC: 'Unit 05 Lighting', U3_PLC: 'Light Outside', U4_PLC: 'Light Inside',
      U5_PLC: 'Power House', U6_PLC: 'Turbine', U8_PLC: 'Drawing Finisher 1~6+2 Breaker',
      U9_PLC: 'Winding 7~9', U10_PLC: 'Ring 1~4', U11_PLC: 'Ring 16~20', U12_PLC: 'Ring 21~24',
      U13_PLC: 'Comber 1~10+ Uni Lap 1-2', U14_PLC: 'Compressor', U15_PLC: 'Simplex 1~6',
      U16_PLC: 'Compressor 2', U17_PLC: 'Ring AC', U18_PLC: 'Ring AC (Bypass)', U20_PLC: 'Compressor (Bypass)',
    };

    const meterFields = [
      'U21_PLC_Del_ActiveEnergy', // TF1
      'U19_PLC_Del_ActiveEnergy', // LT Gen
      ...Object.keys(meterMap).map(m => `${m}_Del_ActiveEnergy`)
    ];

    // ---------------- Aggregation pipeline ----------------
    const projection: any = {};
    meterFields.forEach(field => {
      projection[`first_${field}`] = { $first: `$${field}` };
      projection[`last_${field}`] = { $last: `$${field}` };
    });

    const pipeline: any[] = [
      { $addFields: { ts: { $toDate: "$timestamp" } } },
      { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) } } },
      { $sort: { ts: 1 } }, // ensures $first/$last are correct
      { $group: { _id: null, ...projection } },
    ];

    const results = await this.unitModel.aggregate(pipeline).exec();

    // ---------------- Sum consumption ----------------
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

    // ---------------- Prepare Sankey Data ----------------
    const tf1 = +consumptionTotals['U21_PLC_Del_ActiveEnergy'].toFixed(2);
    const ltGen = +consumptionTotals['U19_PLC_Del_ActiveEnergy'].toFixed(2);
    const sankeyData = [
      { from: 'Wapda+HFO+JMS Incoming', to: 'TotalLT1', value: tf1 },
      { from: 'Diesel+JGS Incomming', to: 'TotalLT1', value: ltGen },
      ...Object.entries(meterMap).map(([meter, label]) => {
        const key = `${meter}_Del_ActiveEnergy`;
        return { from: 'TotalLT1', to: label, value: +(consumptionTotals[key] || 0).toFixed(2) };
      }),
    ];

    return sankeyData;
  }
}

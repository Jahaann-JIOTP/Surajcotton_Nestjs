import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment';
import { Unit4LT2 } from './schemas/unit4_LT2.schema';

@Injectable()
export class Unit4LT2Service {
  constructor(
    @InjectModel(Unit4LT2.name, 'surajcotton')
    private readonly unitModel: Model<Unit4LT2>,
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

    // console.log("📌 Start ISO:", startISO);
    // console.log("📌 End ISO:", endISO);

    // ---------------- Meter setup ----------------
    const meterMap: Record<string, string> = {
      U1_GW01: 'Drying Simplex AC',
      U2_GW01: 'Weikel Cond',
      U3_GW01: 'Winding AC',
      U4_GW01: 'Mills RES-CLNY& Workshop',
      U5_GW01: 'Card 1~8',
      U6_GW01: 'Colony',
      U8_GW01: 'Blow Room',
      U9_GW01: 'Card 9~14+1 Breaker',
      U10_GW01: 'Winding 1~6',
      U11_GW01: 'Power House 2nd Source',
      U12_GW01: 'Card Filter',
      U14_GW01: 'D/R Card Filter',
      U15_GW01: 'Ring 5~8',
      U16_GW01: 'Ring 13~16',
      U17_GW01: 'Ring 9~12',
      U18_GW01: 'Bale Press',
      U19_GW01: 'AC Lab',
      U20_GW01: 'Spare',
      U21_GW01: 'Spare 2',
    };

    const meterFields = [
      'U13_GW01_Del_ActiveEnergy', // TF2
      'U11_GW01_Del_ActiveEnergy',  // Gas Gen
      ...Object.keys(meterMap).map(m => `${m}_Del_ActiveEnergy`),
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
    const tf2 = +(consumptionTotals['U13_GW01_Del_ActiveEnergy'] || 0).toFixed(2);
    const GasGen = +(consumptionTotals['U11_GW01_Del_ActiveEnergy'] || 0).toFixed(2);

    const sankeyData = [
      { from: 'WAPDA+HFO+JMS Incoming', to: 'TotalLT2', value: tf2 },
      { from: 'Diesel+JGS Incoming', to: 'TotalLT2', value: GasGen },
      ...Object.entries(meterMap).map(([meter, label]) => {
        const key = `${meter}_Del_ActiveEnergy`;
        return { from: 'TotalLT2', to: label, value: +(consumptionTotals[key] || 0).toFixed(2) };
      }),
    ];
    return sankeyData;
  }
}

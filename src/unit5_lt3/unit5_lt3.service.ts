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
      // U1_GW02: 'PDB CD1',
      // U2_GW02: 'PDB CD2',
      // U3_GW02: 'Card PDB 01',
      // U4_GW02: 'PDB 8',
      
      U7_GW02: 'Ring 1-3',
      U8_GW02: 'A/C Plant spinning',
      U9_GW02: 'Blow Room L1',
      U10_GW02: 'Ring Frames 4-6',
      U11_GW02: 'A/C Plant Blowing',
      U12_GW02: 'MLDB1 Blower room card',
      U5_GW02: 'PF Panel',
      U14_GW02: 'Comber MCS 1-14',
      U15_GW02: 'AC Plant spinning',
      U16_GW02: 'Water Chiller',
      U17_GW02: 'Card M/C 8-14',
      U18_GW02: 'Auto Con-link Conner 1-9',
      U19_GW02: 'Card M/C 1-7',
      U20_GW02: 'AC Plant winding',
      U21_GW02: 'Simplex M/C S1-5',
      U22_GW02: 'Spare 2',
      U23_GW02: 'Draw Frame Finish',
    };

    const meterFields = [
      'U13_GW02_Del_ActiveEnergy', // TF3
      'U6_GW02_Del_ActiveEnergy',  // Solar
      ...Object.keys(meterMap).map((m) => `${m}_Del_ActiveEnergy`),
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
    const tf3 = +consumptionTotals['U13_GW02_Del_ActiveEnergy'].toFixed(2);
    const solar = +consumptionTotals['U6_GW02_Del_ActiveEnergy'].toFixed(2);

    const sankeyData = [
      { from: 'TF #1', to: 'TotalLT3', value: tf3 },
      { from: 'Solar 1236.39 Kw', to: 'TotalLT3', value: solar },
      ...Object.entries(meterMap).map(([meter, label]) => ({
        from: 'TotalLT3',
        to: label,
        value: +(consumptionTotals[`${meter}_Del_ActiveEnergy`] || 0).toFixed(2),
      }))
    ];

    return sankeyData;
  }
}

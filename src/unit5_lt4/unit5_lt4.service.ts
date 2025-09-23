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
     U1_GW03: 'Ring Frame 7-9',
     U2_GW03: 'Yarn Conditioning M/C',
     U3_GW03: 'MLDB3 Single room quarter',
     U4_GW03: 'Roving transport system',
     U5_GW03: 'ring Frame 10-12',
     U6_GW03: 'Spare 3',
     U7_GW03: 'Spare 1',
     U8_GW03: 'Spare 2',
     U9_GW03: 'Ring Frame 13-15',
     U10_GW03: 'Auto Con-linker Conner M/S 10-12',
     U11_GW03: 'Baling Press',
     U12_GW03: 'Ring Frame 16-18',
     U13_GW03: 'Fiber Deposit Plant',
     U14_GW03: 'MLDB2 Ring Con',
     U15_GW03: 'Deep Valve Turbine',
     U18_GW03: 'PF Panel',
    //  U19_GW03: 'wapda + HFO + Gas Incoming',
    //  U20_GW03: 'WAPDA + HFO + Gas Outgoing T/F 3',
    //  U21_GW03: 'WAPDA + HFO + Gas Outgoing T/F 4',
    //  U22_GW03: 'PDB 07',
    //  U23_GW03: 'PDB 10',


    };

    const meterFields = [
      'U16_GW03_Del_ActiveEnergy', // TF3
      'U17_GW03_Del_ActiveEnergy', // solar2
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
    const tf4 = +consumptionTotals['U16_GW03_Del_ActiveEnergy'].toFixed(2);
    const solar2 = +consumptionTotals['U17_GW03_Del_ActiveEnergy'].toFixed(2);
    const totalLT4 = +(tf4 + solar2).toFixed(2);

    const sankeyData = [
      { from: 'TF #2', to: 'TotalLT4', value: tf4 },
      { from: 'Solar 1017', to: 'TotalLT4', value: solar2 },
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

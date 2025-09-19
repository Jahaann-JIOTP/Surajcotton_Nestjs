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

 


     const meterMap: Record<string, string> = {
     U1_GW01: 'Drying Simplex AC',
     U2_GW01: 'Weikel Conditioning Machine',
     U3_GW01: 'Winding AC',
     U4_GW01: 'Mills RES-CLNY& Workshop',
     U5_GW01: 'Card 1',
     U6_GW01: 'Colony',
     U11_GW01: 'Power House and 2nd Source',
     U8_GW01: 'Blow Room',
     U9_GW01: 'Card 2',
     U10_GW01: 'Winding 01',
     U12_GW01: 'Card  Filter (Bypass)',
     U14_GW01: 'D/R Card Filter',
     U15_GW01: 'Ring 02 (Auto Cone 10-18)',
     U16_GW01: 'Ring 04',
     U17_GW01: 'Ring 03',
     U18_GW01: 'Bale Press',
     U19_GW01: 'AC Lab',
     U20_GW01: 'Spare 01',
     U21_GW01: 'Spare-02',
    //  U22_GW01: 'HFO Incoming',
    //  U23_GW01: 'Wapda 1 Incoming',


    };

    const meterFields = [
      'U13_GW01_Del_ActiveEnergy', // TF2
      'U7_GW01_Del_ActiveEnergy', // Gas Gen
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

    // console.log('📅 Dates returned by aggregation:', results.map(r => r._id));

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
    const tf2 = +consumptionTotals['U13_GW01_Del_ActiveEnergy'].toFixed(2);
    const GasGen = +consumptionTotals['U11_GW01_Del_ActiveEnergy'].toFixed(2);
    const totalLT2 = +(tf2 + GasGen).toFixed(2);

    const sankeyData = [
      { from: 'TF2', to: 'TotalLT2', value: tf2 },
      { from: 'GasGen', to: 'TotalLT2', value: GasGen },
      ...Object.entries(meterMap).map(([meter, label]) => {
        const key = `${meter}_Del_ActiveEnergy`;
        return {
          from: 'TotalLT2',
          to: label,
          value: +(consumptionTotals[key] || 0).toFixed(2),
        };
      }),
    ];

    return sankeyData;
  }
}

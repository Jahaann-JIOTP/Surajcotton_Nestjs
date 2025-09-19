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
      'U6_GW02_Del_ActiveEnergy',  // Solar
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
    const tf3 = +consumptionTotals['U13_GW02_Del_ActiveEnergy'].toFixed(2);
    const solar = +consumptionTotals['U6_GW02_Del_ActiveEnergy'].toFixed(2);

    const sankeyData = [
      { from: 'TF3', to: 'TotalLT3', value: tf3 },
      { from: 'Solar', to: 'TotalLT3', value: solar },
      ...Object.entries(meterMap).map(([meter, label]) => ({
        from: 'TotalLT3',
        to: label,
        value: +(consumptionTotals[`${meter}_Del_ActiveEnergy`] || 0).toFixed(2),
      }))
    ];

    return sankeyData;
  }
}

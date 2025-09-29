import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment';
import { Unit5LT4 } from './schemas/unit5_LT4.schema';
import { MeterService } from 'src/meter/meter.service';


@Injectable()
export class Unit5LT4Service {
  constructor(
    @InjectModel(Unit5LT4.name, 'surajcotton')
    private readonly unitModel: Model<Unit5LT4>,
    private readonly meterService: MeterService,
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

    // -------------------- Call existing daily-consumption function (6am→6am window handled inside it) ---------------------
    const fmCons = await this.meterService.getMeterWiseConsumption(
      payload.startDate,
      payload.endDate,
      { startTime: payload.startTime, endTime: payload.endTime }
    );

    // ----------------- 1- This value will be used to display a new leg in generation side as From U4 LT 2
    const PDB10_U4 = +(Number(fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB10_U4)

    // ----------------- 2- This value will be used to subscrat the value from the U10_GW03: 'Auto Con-linker Conner M/S 10-12',
    const PDB10_U5 = +(Number(fmCons?.U5_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB10_U5)

    // ----------------- 3- This value will be used to display a new leg in consumption side for PDB 10 TOTAL 
    const PDB10_sum = Math.max(0, +(PDB10_U4 + PDB10_U5).toFixed(2));
    // console.log(PDB10_sum)


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
    };

    const meterFields = [
      'U16_GW03_Del_ActiveEnergy', // TF3
      'U17_GW03_Del_ActiveEnergy', // solar
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

    // Which PLC meter should lose what (non-negative math later)
    const minusByMeter: Record<string, number> = {
      U10_GW03: +(Number(PDB10_U5).toFixed(2)),   // Auto Con-linker Conner M/S 10-12
    };

    // ---------------- Prepare Sankey Data ----------------
    const tf4 = +consumptionTotals['U16_GW03_Del_ActiveEnergy'].toFixed(2);
    const solar2 = +consumptionTotals['U17_GW03_Del_ActiveEnergy'].toFixed(2);
    const totalLT4 = +(tf4 + solar2).toFixed(2);


    const plcLegs = Object.entries(meterMap).map(([meter, label]) => {
    const key   = `${meter}_Del_ActiveEnergy`;
    const base  = +(Number(consumptionTotals[key] || 0).toFixed(2));
    const minus = +(Number(minusByMeter[meter] || 0).toFixed(2));
    const raw   = +(base - minus).toFixed(2);
    const value = Math.max(0, Math.abs(raw) < 1e-9 ? 0 : raw);
    return { from: 'TotalLT4', to: label, value };
  });

    const sankeyData = [
      { from: 'TF #2', to: 'TotalLT4', value: tf4 },
      { from: 'Solar 1017', to: 'TotalLT4', value: solar2 },
    // NEW input/generation leg
      { from: 'From U4 LT 2', to: 'TotalLT4', value: PDB10_U4 },

      // Adjusted PLC branches (includes the U10_GW03 subtraction)
      ...plcLegs,

      // NEW bottom/output summary leg
      { from: 'TotalLT4', to: 'PDB 10', value: PDB10_sum },
    ];
    return sankeyData;
  }
}

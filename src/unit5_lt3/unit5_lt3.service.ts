import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment';
import { Unit5LT3 } from './schemas/unit5_LT3.schema';
import { MeterService } from 'src/meter/meter.service';


@Injectable()
export class Unit5LT3Service {
  constructor(
    @InjectModel(Unit5LT3.name, 'surajcotton')
    private readonly unitModel: Model<Unit5LT3>,
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

    // --------------- 1- This value will be added in a new leg in generation side -  as From Unit4 LT 1 (Ring 21- 24)
    const PDB07_U4 = +(Number(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB07_U4)

    // --------------- 2-  This value will be subscrated from U18_GW02: 'Auto Con-link Conner 1-9',
    const PDB07_U5 = +(Number(fmCons?.U5_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB07_U5)

    // --------------- 3-  This value will be subscrated from  U14_GW02: 'Comber MCS 1-14',
    const PDB08_U5 = +(Number(fmCons?.U5_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB08_U5)

    // --------------- 4-  This value will be subscrated from  U17_GW02: 'Card M/C 8-14',
    const CardPDB1_U5 = +(Number(fmCons?.U5_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(CardPDB1_U5)

    // --------------- 5-  This value will be subscrated from U17_GW02: 'Card M/C 8-14',,
    const PDB1CD1_U5 = +(Number(fmCons?.U5_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB1CD1_U5)

    // --------------- 5-  This value will be subscrated from  U14_GW02: 'Comber MCS 1-14',
    const PDB2CD2_U5 = +(Number(fmCons?.U5_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB2CD2_U5)

    // --------------- 6-  This value will be used for full consumption leg CardPDB1
    const CardPDB1_U4 = +(Number(fmCons?.U4_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(CardPDB1_U4)

    // --------------- 7-  This value will be used for full consumption of PDB 08 leg 
    const PDB08_U4 = +(Number(fmCons?.U4_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB08_U4)

        // --------------- 8-  This value will be used to show generation U14_GW02: 'Comber MCS 1-14',
    const PDB2CD2_U4 = +(Number(fmCons?.U4_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB2CD2_U4)

     // --------------- 9-  This value will be used to show generation from U4 LT 2 17_GW02: 'Card M/C 8-14',,
    const PDB1CD1_U4 = +(Number(fmCons?.U4_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB1CD1_U4)


    // ---------- bottom-leg sums (rounded, non-negative) ----------
    const toU4LT2   = Math.max(0, +(PDB1CD1_U5 + PDB2CD2_U5).toFixed(2));
    const PDB07_sum = Math.max(0, +(PDB07_U5 + PDB07_U4).toFixed(2));
    const PDB08_sum = Math.max(0, +(PDB08_U5 + PDB08_U4).toFixed(2));
    const CardPDB1_sum = Math.max(0, +(CardPDB1_U5 + CardPDB1_U4).toFixed(2));
    const U4_LT2_sum = Math.max(0, +(PDB2CD2_U4 + PDB1CD1_U4).toFixed(2));
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
    
    // Build a per-meter subtraction table
    const minusByMeter: Record<string, number> = {
      // U18_GW02: subtract PDB07_U5
      U18_GW02: PDB07_U5,

      // U14_GW02: subtract PDB08_U5 + PDB2CD2_U5
      U14_GW02: (PDB08_U5 + PDB2CD2_U5),

      // U17_GW02: subtract CardPDB1_U5 + PDB1CD1_U5
      U17_GW02: (CardPDB1_U5 + PDB1CD1_U5),
      // others default to 0
    };

    const plcLegs = Object.entries(meterMap).map(([meter, label]) => {
      const key   = `${meter}_Del_ActiveEnergy`;
      const base  = +(Number(consumptionTotals[key] || 0).toFixed(2));
      const minus = +(Number(minusByMeter[meter] || 0).toFixed(2));
      const value = Math.max(0, +(base - minus).toFixed(2));
      return { from: 'TotalLT3', to: label, value };
    });


    const sankeyData = [
      { from: 'TF #1', to: 'TotalLT3', value: tf3 },
      { from: 'Solar 1236.39 Kw', to: 'TotalLT3', value: solar },
       // NEW INPUT LEG (generation side)
      { from: 'From Unit 4 LT 1 (Ring 21-24)', to: 'TotalLT3', value: PDB07_U4 },
      { from: 'From Unit 4 LT 2 (Card 1-8 & Card 9-14 + 1Breaker)', to: 'TotalLT3', value:  U4_LT2_sum },
      // adjusted PLC branches
      ...plcLegs,

       // -------- NEW bottom legs (show transfers/bridges) --------
      { from: 'TotalLT3', to: 'To U4 LT 2', value: toU4LT2 },
      { from: 'TotalLT3', to: 'PDB 07',     value: PDB07_sum },
      { from: 'TotalLT3', to: 'PDB 08',     value: PDB08_sum },
      { from: 'TotalLT3', to: 'Card PDB1',  value: CardPDB1_sum },
    ];
  
    return sankeyData;
  }
}

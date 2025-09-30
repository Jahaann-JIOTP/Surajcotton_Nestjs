import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment';
import { Unit4LT2 } from './schemas/unit4_LT2.schema';
import { MeterService } from 'src/meter/meter.service';

@Injectable()
export class Unit4LT2Service {
  constructor(
    @InjectModel(Unit4LT2.name, 'surajcotton')
    private readonly unitModel: Model<Unit4LT2>,
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

    // ----------------- 1- This value will be used to get the value to sum and dispaly in generation side from U5 LT 1 
    const PDB2CD2_U5 = +(Number(fmCons?.U5_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB2CD2_U5)

    // ----------------- 2- This value will be used to get the value to sum and dispaly in generation side from U5 LT 1 
    const PDB1CD1_U5 = +(Number(fmCons?.U5_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB1CD1_U5)

    // ----------------- 3- Subscrate this value from    U9_GW01: 'Card 9~14+1 Breaker'
    const PDB2CD2_U4 = +(Number(fmCons?.U4_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB2CD2_U4)

    // ----------------- 4- Subscract this value from  U5_GW01: 'Card 1~8',
    const PDB1CD1_U4 = +(Number(fmCons?.U4_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB1CD1_U4)

    // ----------------- 5- Subscract this value from  U5_GW01: 'Card 1~8',
    const CardPDB1_U4 = +(Number(fmCons?.U4_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(CardPDB1_U4)

    // ----------------- 6- Subscract this value from  U9_GW01: 'Card 9~14+1 Breaker'
    const PDB08_U4 = +(Number(fmCons?.U4_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB08_U4)

        // ----------------- 6- Subscract this value from     U15_GW01: 'Ring 5~8',
    const PDB10_U4 = +(Number(fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    // console.log(PDB10_U4)
    



              // ------------------  SANKEY NEW LEGS -----------
    // -----------------1 This value will be used to display a new leg in GENERATION side as From Unit 5 (Comber M/C 1-14 & Card M/C 8-14) 
    const PDB12CD12_sum = Math.max(0, +(PDB2CD2_U5 + PDB1CD1_U5).toFixed(2));
    // console.log(PDB12CD12_sum)

    // -----------------2 This value will be used to display a new leg in generation side as PDB1 CD1 TOTAL 
    const PDB1CD1_sum = Math.max(0, +(PDB1CD1_U5 + PDB1CD1_U4).toFixed(2));
    // console.log(PDB1cd1_sum)


    // -----------------3 This value will be used to display a new leg in generation side as PDB2 CD2 TOTAL 
    const PDB2CD2_sum = Math.max(0, +(PDB2CD2_U4 + PDB2CD2_U5).toFixed(2));
    // console.log(PDB2CD2_sum)


    // -----------------4 This value will be used to display a new leg in generation side as TO U5 LT 1(Card M/C 8-14 & Comber M/C 1-14)
    const ToU5LT1_sum = Math.max(0, +(CardPDB1_U4 + PDB08_U4).toFixed(2));
    // console.log(ToU5LT1_sum)

    // -----------------4 This value will be used to display a new leg in generation side as TO U5 LT 2(Auto Cone 10-12)
    const ToU5LT2_sum = Math.max(0, +(PDB10_U4).toFixed(2));
    // console.log(ToU5LT2_sum)


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
      U7_GW01: 'Power House 2nd Source',
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
    // ---------- apply cross-feed subtractions on LT2 ----------
    const minusByMeter: Record<string, number> = {
      // U9_GW01: Card 9~14+1 Breaker  ← subtract PDB2CD2_U4 + PDB08_U4
      U9_GW01: +(Number(PDB2CD2_U4 + PDB08_U4).toFixed(2)),

      // U5_GW01: Card 1~8              ← subtract PDB1CD1_U4 + CardPDB1_U4
      U5_GW01: +(Number(PDB1CD1_U4 + CardPDB1_U4).toFixed(2)),

      // U15_GW01: Ring 5~8             ← subtract PDB10_U4
      U15_GW01: +(Number(PDB10_U4).toFixed(2)),
    };

      const plcLegs = Object.entries(meterMap).map(([meter, label]) => {
      const key   = `${meter}_Del_ActiveEnergy`;
      const base  = +(Number(consumptionTotals[key] || 0).toFixed(2));
      const minus = +(Number(minusByMeter[meter] || 0).toFixed(2));
      const raw   = +(base - minus).toFixed(2);
      const value = Math.max(0, Math.abs(raw) < 1e-9 ? 0 : raw); // no negatives / -0
      return { from: 'TotalLT2', to: label, value };
    });

    // ---------------- Prepare Sankey Data ----------------
    const tf2 = +(consumptionTotals['U13_GW01_Del_ActiveEnergy'] || 0).toFixed(2);
    const GasGen = +(consumptionTotals['U11_GW01_Del_ActiveEnergy'] || 0).toFixed(2);
// changed id U11 to U7

    const sankeyData = [
       // Generation (inputs)
      { from: 'WAPDA+HFO+JMS Incoming', to: 'TotalLT2', value: tf2 },
      { from: 'Diesel+JGS Incoming',     to: 'TotalLT2', value: GasGen },

      // NEW generation legs
      { from: 'From Unit 5 LT 1 (Comber M/C 1-14 & Card M/C 8-14)', to: 'TotalLT2', value: PDB12CD12_sum },
    

      // Adjusted PLC branches (after subtractions)
      ...plcLegs,

      // NEW bottom/output legs (exports)
      { from: 'TotalLT2', to: 'PDB1 CD1 TOTAL', value: PDB1CD1_sum },
      { from: 'TotalLT2', to: 'PDB2 CD2 TOTAL', value: PDB2CD2_sum },
      { from: 'TotalLT2', to: 'To Unit 5 LT 1 (Card M/C 8-14 & Comber M/C 1-14)', value: ToU5LT1_sum },
      { from: 'TotalLT2', to: 'To Unit 5 LT 2 (Auto Cone 10-12)',                 value: ToU5LT2_sum },
    ];
    return sankeyData;
  }
}

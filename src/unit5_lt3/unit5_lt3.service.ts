import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
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

    // ---------------- Determine start & end ISO ----------------
    let startISO: string;
    let endISO: string;

    if (payload.startTime && payload.endTime) {
      const startMoment = moment
        .tz(`${payload.startDate} ${payload.startTime}`, 'YYYY-MM-DD HH:mm', TZ)
        .startOf('minute')
        .toDate();
      const endMoment = moment
        .tz(`${payload.endDate} ${payload.endTime}`, 'YYYY-MM-DD HH:mm', TZ)
        .endOf('minute')
        .toDate();

      startISO = startMoment.toISOString();
      endISO = endMoment.toISOString();
    } else {
      startISO = `${payload.startDate}T06:00:00.000+05:00`;
      const nextDay = moment(payload.endDate).add(1, 'day').format('YYYY-MM-DD');
      endISO = `${nextDay}T06:00:59.999+05:00`;
    }

    // -------------------- Fetch Meter-wise Consumption ---------------------
    const fmCons = await this.meterService.getMeterWiseConsumption(
      payload.startDate,
      payload.endDate,
      { startTime: payload.startTime, endTime: payload.endTime }
    );

    // ---------- Cross-unit legs ----------
    const PDB07_U4 = +(Number(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB07_U5 = +(Number(fmCons?.U5_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB08_U5 = +(Number(fmCons?.U5_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const CardPDB1_U5 = +(Number(fmCons?.U5_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB1CD1_U5 = +(Number(fmCons?.U5_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB2CD2_U5 = +(Number(fmCons?.U5_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const CardPDB1_U4 = +(Number(fmCons?.U4_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB08_U4 = +(Number(fmCons?.U4_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB2CD2_U4 = +(Number(fmCons?.U4_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB1CD1_U4 = +(Number(fmCons?.U4_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));

    // ---------- bottom-leg sums ----------
    const toU4LT2 = Math.max(0, +(PDB1CD1_U5 + PDB2CD2_U5).toFixed(2));
    const PDB07_sum = Math.max(0, +(PDB07_U5 + PDB07_U4).toFixed(2));
    const PDB08_sum = Math.max(0, +(PDB08_U5 + PDB08_U4).toFixed(2));
    const CardPDB1_sum = Math.max(0, +(CardPDB1_U5 + CardPDB1_U4).toFixed(2));
    const U4_LT2_sum = Math.max(0, +(CardPDB1_U4 + PDB08_U4).toFixed(2));

    // ---------------- Meter setup ----------------
    const meterMap: Record<string, string> = {
      U7_GW02: 'Ring 1-3',
      U8_GW02: 'AC Supply Fan',
      U9_GW02: 'Blow Room L1',
      U10_GW02: 'Ring Frames 4-6',
      U11_GW02: 'A/C Plant Blowing',
      U12_GW02: 'MLDB1 Blower room card',
      U5_GW02: 'PF Panel',
      U14_GW02: 'Comber MCS 1-14',
      U15_GW02: 'AC Return Fan',
      U16_GW02: 'Water Chiller',
      U17_GW02: 'Card M/C 8-14',
      U18_GW02: 'Auto Con 1-9',
      U19_GW02: 'Card M/C 1-7',
      U20_GW02: 'AC Plant winding',
      U21_GW02: 'Simplex M/C 1~6 + 1~5 Breaker Machines',
      U22_GW02: 'Spare 2',
      U23_GW02: 'Draw Frame Finish 1~8',
    };

    const meterFields = [
      'U13_GW02_Del_ActiveEnergy', // TF3
      'U6_GW02_Del_ActiveEnergy',  // Solar
      ...Object.keys(meterMap).map(m => `${m}_Del_ActiveEnergy`),
    ];

    // ---------------- Aggregation pipeline ----------------
    const projection: any = {};
    meterFields.forEach(field => {
      projection[`first_${field}`] = { $first: `$${field}` };
      projection[`last_${field}`] = { $last: `$${field}` };
    });

    const pipeline: any[] = [
      { $addFields: { ts: { $toDate: '$timestamp' } } },
      { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) } } },
      { $sort: { ts: 1 } },
      { $group: { _id: null, ...projection } },
    ];

    const results = await this.unitModel.aggregate(pipeline).exec();

    // ---------------- Calculate consumptions ----------------
    const consumptionTotals: Record<string, number> = {};
    meterFields.forEach(f => (consumptionTotals[f] = 0));

    for (const entry of results) {
      for (const field of meterFields) {
        const first = entry[`first_${field}`] || 0;
        const last = entry[`last_${field}`] || 0;
        const consumption = last - first;
        if (!isNaN(consumption) && consumption >= 0) {
          consumptionTotals[field] += +consumption.toFixed(2);
        }
      }
    }

    const tf3 = +consumptionTotals['U13_GW02_Del_ActiveEnergy'].toFixed(2);
    const solar = +consumptionTotals['U6_GW02_Del_ActiveEnergy'].toFixed(2);
    const totalGeneration = tf3 + solar + PDB07_U4 + U4_LT2_sum; // All incoming sources

    const overrideByMeter: Record<string, number> = {
      U18_GW02: PDB07_sum, // Auto Con-link Conner 1-9
      U17_GW02: CardPDB1_sum, // Card M/C 8-14
      U14_GW02: PDB08_sum, // Comber MCS 1-14
    };

    const plcLegs = Object.entries(meterMap).map(([meter, label]) => {
      const key = `${meter}_Del_ActiveEnergy`;
      const base = +(Number(consumptionTotals[key] || 0).toFixed(2));
      const value = overrideByMeter[meter]
        ? Math.max(0, +overrideByMeter[meter].toFixed(2))
        : Math.max(0, +base.toFixed(2));
      return { from: 'TotalLT3', to: label, value };
    });

    // ---------------- Calculate Total Consumption ----------------
    let totalConsumption = 0;
    Object.keys(meterMap).forEach(m => {
      const key = `${m}_Del_ActiveEnergy`;
      const val = +(Number(consumptionTotals[key] || 0).toFixed(2));
      totalConsumption += overrideByMeter[m] ? overrideByMeter[m] : val;
    });

    const unaccountedEnergy = +(totalGeneration - totalConsumption - toU4LT2).toFixed(2);

    // ---------------- Final Sankey Data ----------------
    const sankeyData = [
      { from: 'TF #1', to: 'TotalLT3', value: tf3 },
      { from: 'Solar 1184.55 Kw', to: 'TotalLT3', value: solar },
      { from: 'From U4LT 1 (Ring 21–24)', to: 'TotalLT3', value: PDB07_U4 },
      { from: 'From U4LT 2 (Card1–8 & Card9–14+1B)', to: 'TotalLT3', value: U4_LT2_sum },
      ...plcLegs,
      { from: 'TotalLT3', to: 'PDBCD1 → U4LT2 (Card1–8)', value: PDB1CD1_U5 },
      { from: 'TotalLT3', to: 'PDBCD2 → U4LT2 (Card9–14+1B)', value: PDB2CD2_U5 },
      { from: 'TotalLT3', to: 'Unaccounted Energy', value: unaccountedEnergy },
    ];

    return sankeyData;
  }
}

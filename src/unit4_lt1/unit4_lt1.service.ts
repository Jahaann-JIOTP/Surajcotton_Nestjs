import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { Unit4LT1 } from './schemas/unit4_LT1.schema';
import { MeterService } from 'src/meter/meter.service';



@Injectable()
export class Unit4LT1Service {
  constructor(
    @InjectModel(Unit4LT1.name, 'surajcotton')
    private readonly unitModel: Model<Unit4LT1>,
    private readonly meterService: MeterService,
  ) {}

  async getSankeyData(payload: { startDate: string; endDate: string; startTime?: string; endTime?: string }) {
    const TZ = 'Asia/Karachi';

    /** ---------------- Date Range Handling ---------------- */
    const startMoment = payload.startTime
      ? moment.tz(`${payload.startDate} ${payload.startTime}`, 'YYYY-MM-DD HH:mm', TZ).startOf('minute')
      : moment.tz(`${payload.startDate} 06:00`, 'YYYY-MM-DD HH:mm', TZ);

    const endMoment = payload.endTime
      ? moment.tz(`${payload.endDate} ${payload.endTime}`, 'YYYY-MM-DD HH:mm', TZ).endOf('minute')
      : moment.tz(payload.endDate, 'YYYY-MM-DD', TZ).add(1, 'day').hour(6).minute(0).second(59);

    const startISO = startMoment.toISOString();
    const endISO = endMoment.toISOString();

    // console.log('📅 Time Range:', startISO, '→', endISO);

    /** ---------------- External Data ---------------- */
    const fmCons = await this.meterService.getMeterWiseConsumption(
      payload.startDate,
      payload.endDate,
      { startTime: payload.startTime, endTime: payload.endTime },
    );
    const PDB07_U4 = this.safeRound(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0);

    /** ---------------- Meter Map ---------------- */
    const meterMap: Record<string, string> = {
      U1_PLC: 'Roving Transport System',
      U3_PLC: 'Lighting Outside',
      U4_PLC: 'Lighting Inside',
      U5_PLC: 'HFO Plant Aux(2nd Source)',
      U6_PLC: 'Deep Valve Turbine',
      U8_PLC: 'Drawing Finisher 1-6 + Breaker 1-4',
      U9_PLC: 'Winding 7-9',
      U10_PLC: 'Ring 1-4',
      U11_PLC: 'Ring 16-20',
      U12_PLC: 'Ring 21-24',
      U13_PLC: 'Comber 1-10 + Lap Former 1-2',
      U14_PLC: 'Compressor 119kW',
      U15_PLC: 'Drawing Simplex 1-6',
      U17_PLC: 'Ring A/C (Supply & Return Fans)',
      U18_PLC: 'Ring A/C (Bypass)',
      U20_PLC: 'Compressor 119kW',
      U2_PLC: 'TO U5LT1 (Lighting internal Unit 5)',
      U16_PLC: 'TO U5LT1 (Compressor 303 kW)',
    };

    const meterKeys = Object.keys(meterMap);
    const meterFields = [
      'U21_PLC_Del_ActiveEnergy', // Wapda+HFO+JMS
      'U19_PLC_Del_ActiveEnergy', // Diesel+JGS
      'U22_GW02_Del_ActiveEnergy', // From Unit 5 LT1
      ...meterKeys.map((m) => `${m}_Del_ActiveEnergy`),
    ];

    /** ---------------- Mongo Aggregation ---------------- */
    const projection = Object.fromEntries(
      meterFields.flatMap((f) => [
        [`first_${f}`, { $first: `$${f}` }],
        [`last_${f}`, { $last: `$${f}` }],
      ]),
    );

    const results = await this.unitModel
      .aggregate([
        { $project: { ts: { $toDate: '$timestamp' }, ...Object.fromEntries(meterFields.map(f => [f, 1])) } },
        { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) } } },
        { $sort: { ts: 1 } },
        { $group: { _id: null, ...projection } },
      ])
      .exec();

    if (!results?.length) {
      console.warn('⚠️ No data found for selected range');
      return [];
    }

    const data = results[0];

    /** ---------------- Compute Consumption ---------------- */
    const consumptionTotals = Object.fromEntries(
      meterFields.map((f) => {
        const first = data[`first_${f}`] ?? 0;
        const last = data[`last_${f}`] ?? 0;
        return [f, Math.max(0, last - first)];
      }),
    );

    /** ---------------- Derived Values ---------------- */
    const safe = (key: string) => this.safeRound(consumptionTotals[key] ?? 0);
    const ring2124Adj = Math.max(0, this.safeRound(safe('U12_PLC_Del_ActiveEnergy') - PDB07_U4));

    const wapdaHFO = safe('U21_PLC_Del_ActiveEnergy');
    const dieselJGS = safe('U19_PLC_Del_ActiveEnergy');
    const u22Spare2 = safe('U22_GW02_Del_ActiveEnergy');

    const totalGeneration = wapdaHFO + dieselJGS;

    const totalConsumption = meterKeys.reduce((sum, key) => {
      if (['U2_PLC', 'U16_PLC'].includes(key)) return sum; // Skip transfers
      const val = key === 'U12_PLC' ? ring2124Adj : safe(`${key}_Del_ActiveEnergy`);
      return sum + val;
    }, 0);

    const totalTransferredToUnit5 =
      PDB07_U4 +
      safe('U16_PLC_Del_ActiveEnergy') +
      safe('U2_PLC_Del_ActiveEnergy') +
      u22Spare2;

    const totalIncomingFromUnit5 = u22Spare2;
    const unaccountedEnergy = this.safeRound(
      (totalGeneration + totalIncomingFromUnit5) - (totalConsumption + totalTransferredToUnit5),
    );

    /** ---------------- Totals Summary ---------------- */
    const totals = {
      Total_Incoming_From_Generation: this.safeRound(totalGeneration),
      Total_Incoming_From_Unit_5:totalIncomingFromUnit5,
      Total_Consumption: this.safeRound(totalConsumption),
      Total_Transferred_To_Unit_5: this.safeRound(totalTransferredToUnit5),
      Total_Unaccountable_Energy: unaccountedEnergy,
    };

    /** ---------------- Sankey Data ---------------- */
    const sankeyData = [
      { from: 'Wapda+HFO+JMS Incoming', to: 'TotalLT1', value: wapdaHFO },
      { from: 'Diesel+JGS Incoming', to: 'TotalLT1', value: dieselJGS },
      { from: 'From U5LT1 (Spare 2)', to: 'TotalLT1', value: u22Spare2 },
      ...meterKeys
        .filter((m) => !['U16_PLC', 'U2_PLC'].includes(m))
        .map((m) => ({
          from: 'TotalLT1',
          to: meterMap[m],
          value: m === 'U12_PLC' ? ring2124Adj : safe(`${m}_Del_ActiveEnergy`),
        })),
      { from: 'TotalLT1', to: meterMap['U2_PLC'], value: safe('U2_PLC_Del_ActiveEnergy') },
      { from: 'TotalLT1', to: meterMap['U16_PLC'], value: safe('U16_PLC_Del_ActiveEnergy') },
      { from: 'TotalLT1', to: 'PDB07->To U5LT1 (AutoCone1-9)', value: PDB07_U4 },
      { from: 'TotalLT1', to: 'From U5LT1 (Spare 2) Consumption', value: u22Spare2 },
      { from: 'TotalLT1', to: 'Unaccounted Energy', value: unaccountedEnergy },
    ];

    // console.table(totals);
   return { sankeyData, totals };
  }

  /** ---------- Helper for consistent rounding ---------- */
  private safeRound(num: number, digits = 2): number {
    return +num.toFixed(digits);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { Unit4LT1 } from './schemas/unit4_LT1.schema';
import { MeterService } from 'src/meter/meter.service';

const TZ = 'Asia/Karachi';

const meterMap: Record<string, string> = {
  U1_PLC: 'Roving Transport System',
  U3_PLC: 'Lighting Outside',
  U4_PLC: 'Lighting Inside',
  U5_PLC: 'HFO Plant Aux(2nd Source)',
  U6_PLC: 'Deep Valve Turbine',
  U8_PLC: 'Drawing Finisher 1-6 + Breaker 1-4',
  U9_PLC: 'Winding 7-9',
  U10_PLC: 'Ring 1-4',
  U11_PLC: 'Ring 17-20',
  U12_PLC: 'Ring 21-24',
  U13_PLC: 'Comber 1-10 + Lap Former 1-2',
  U14_PLC: 'Compressor (119 kW)',
  U15_PLC: 'Drawing Simplex 1-6',
  U17_PLC: 'Ring A/C (Supply & Return Fans)',
  U18_PLC: 'Ring A/C (Bypass)',
  U20_PLC: 'Compressor (119 kW)',
  U2_PLC: 'TO U5LT1 (Lighting Internal Unit 5)',
  U16_PLC: 'TO U5LT1 (Compressor 303 kW)',
};

const meterKeys = Object.keys(meterMap);

const meterFields = [
  'U21_PLC_Del_ActiveEnergy',
  'U19_PLC_Del_ActiveEnergy',
  'U22_GW02_Del_ActiveEnergy',
  ...meterKeys.map((m) => `${m}_Del_ActiveEnergy`),
];

@Injectable()
export class Unit4LT1Service {
  constructor(
    @InjectModel(Unit4LT1.name, 'surajcotton')
    private readonly unitModel: Model<Unit4LT1>,
    private readonly meterService: MeterService,
  ) {}

  async getSankeyData(payload: any) {
    /** ---------------- TIME RANGE (PKT → UTC) ---------------- */
    const startMoment = payload.startTime
      ? moment.tz(`${payload.startDate} ${payload.startTime}`, 'YYYY-MM-DD HH:mm', TZ).startOf('minute')
      : moment.tz(`${payload.startDate} 06:00`, 'YYYY-MM-DD HH:mm', TZ);

    const endMoment = payload.endTime
      ? moment.tz(`${payload.endDate} ${payload.endTime}`, 'YYYY-MM-DD HH:mm', TZ).endOf('minute')
      : moment.tz(payload.endDate, 'YYYY-MM-DD', TZ).add(1, 'day').hour(6).minute(0).second(59);

    const startISO = startMoment.toISOString();
    const endISO = endMoment.toISOString();

    /** ---------------- DEBUG LOGS ---------------- */
    // console.log("=======================================================");
    // console.log("📌 [Unit4LT1] RAW INPUT:", payload);
    // console.log(`Start (PKT): ${startMoment.format('YYYY-MM-DD HH:mm:ss')}`);
    // console.log(`End   (PKT): ${endMoment.format('YYYY-MM-DD HH:mm:ss')}`);
    // console.log(`Start ISO: ${startISO}`);
    // console.log(`End   ISO: ${endISO}`);
    // console.log("=======================================================\n");

    /** ---------------- METER-WISE CONSUMPTION ---------------- */
    const T1 = `U4LT1_meterwise_${Date.now()}`;
    // console.time(T1);

    const fmCons = await this.meterService.getMeterWiseConsumption(
      payload.startDate,
      payload.endDate,
      { startTime: payload.startTime, endTime: payload.endTime },
    );

    // console.timeEnd(T1);

    const PDB07_U4 = this.safeRound(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0);

    /** ---------------- MONGO AGGREGATION ---------------- */
    const projection = Object.fromEntries(
      meterFields.flatMap((f) => [
        [`first_${f}`, { $first: `$${f}` }],
        [`last_${f}`, { $last: `$${f}` }],
      ]),
    );

    const T2 = `U4LT1_mongo_${Date.now()}`;
    // console.time(T2);

    const results = await this.unitModel.aggregate([
      {
        $project: {
          ts: { $toDate: "$timestamp" }, // Convert STRING → DATE
          ...Object.fromEntries(meterFields.map(f => [f, 1])),
        },
      },
      {
        $match: {
          ts: { $gte: new Date(startISO), $lte: new Date(endISO) },
        },
      },
      { $sort: { ts: 1 } },
      { $group: { _id: null, ...projection } },
    ]).exec();

    // console.timeEnd(T2);

    if (!results.length) {
      console.warn("⚠️ No documents found");
      return { sankeyData: [], totals: null };
    }

    const data = results[0];

    /** ---------------- FIRST & LAST TIMESTAMP DEBUG ---------------- */
    const firstDoc = await this.unitModel.findOne({
      timestamp: { $gte: startISO, $lte: endISO },
    }).sort({ timestamp: 1 });

    const lastDoc = await this.unitModel.findOne({
      timestamp: { $gte: startISO, $lte: endISO },
    }).sort({ timestamp: -1 });

//    console.log("FIRST Timestamp:", (firstDoc as any)?.timestamp);
// console.log("LAST  Timestamp:", (lastDoc as any)?.timestamp);

    /** ---------------- COMPUTE CONSUMPTION ---------------- */
    const consumptionTotals: Record<string, number> = Object.fromEntries(
      meterFields.map((f) => {
        const first = data[`first_${f}`] ?? 0;
        const last = data[`last_${f}`] ?? 0;
        const diff = Math.max(0, last - first);

        // console.log(`Meter: ${f} | FIRST: ${first} | LAST: ${last} | DIFF: ${diff}`);

        return [f, diff];
      }),
    );

    const safe = (k: string) => this.safeRound(consumptionTotals[k] ?? 0);

    /** ---------------- DERIVED VALUES ---------------- */
    const wapdaHFO = safe('U21_PLC_Del_ActiveEnergy');
    const dieselJGS = safe('U19_PLC_Del_ActiveEnergy');
    const u22Spare2 = safe('U22_GW02_Del_ActiveEnergy');

    const ring2124Adj = Math.max(0, safe('U12_PLC_Del_ActiveEnergy') - PDB07_U4);

    const totalGeneration = wapdaHFO + dieselJGS;

    const totalConsumption = meterKeys.reduce((sum, key) => {
      if (key === 'U2_PLC' || key === 'U16_PLC') return sum;
      return sum + (key === 'U12_PLC' ? ring2124Adj : safe(`${key}_Del_ActiveEnergy`));
    }, 0);

    const totalTransferredToUnit5 =
      PDB07_U4 +
      safe('U2_PLC_Del_ActiveEnergy') +
      safe('U16_PLC_Del_ActiveEnergy') +
      u22Spare2;

    const unaccountedEnergy =
      this.safeRound((totalGeneration + u22Spare2) - (totalConsumption + totalTransferredToUnit5));

    /** ---------------- S A N K E Y  ---------------- */
    const sankeyData = [
      { from: 'Wapda+HFO+JMS Incoming', to: 'TotalLT1', value: wapdaHFO },
      { from: 'Diesel+JGS Incoming', to: 'TotalLT1', value: dieselJGS },
      { from: 'From U5LT1 (Spare 2)', to: 'TotalLT1', value: u22Spare2 },

      ...meterKeys
        .filter((m) => !['U2_PLC', 'U16_PLC'].includes(m))
        .map((m) => ({
          from: 'TotalLT1',
          to: meterMap[m],
          value: m === 'U12_PLC' ? ring2124Adj : safe(`${m}_Del_ActiveEnergy`),
        })),

      { from: 'TotalLT1', to: meterMap['U2_PLC'], value: safe('U2_PLC_Del_ActiveEnergy') },
      { from: 'TotalLT1', to: meterMap['U16_PLC'], value: safe('U16_PLC_Del_ActiveEnergy') },
      { from: 'TotalLT1', to: 'PDB07->To U5LT1 (AutoCone1-9)', value: PDB07_U4 },
      { from: 'TotalLT1', to: 'Unaccounted Energy', value: unaccountedEnergy },
    ];

    /** ---------------- TOTALS ---------------- */
    const totals = {
      Total_Incoming_From_Generation: this.safeRound(totalGeneration),
      Total_Incoming_From_Unit_5: u22Spare2,
      Total_Consumption: this.safeRound(totalConsumption),
      Total_Transferred_To_Unit_5: this.safeRound(totalTransferredToUnit5),
      Total_Unaccountable_Energy: unaccountedEnergy,
    };

    return { sankeyData, totals };
  }

  private safeRound(num: number, digits = 2) {
    return +Number(num || 0).toFixed(digits);
  }
}

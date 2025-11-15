import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import * as moment from 'moment-timezone';
import { Unit5LT4 } from './schemas/unit5_LT4.schema';
import { MeterService } from 'src/meter/meter.service';

const TZ = 'Asia/Karachi';

/** ---------------- Meter Map (Static for LT4) ---------------- */
const meterMap: Record<string, string> = {
  U1_GW03: 'Ring 7–9',
  U2_GW03: 'Conditioning Machine',
  U3_GW03: 'MLDB3 Single Room Quarter',
  U4_GW03: 'Roving Transport System',
  U5_GW03: 'Ring 10–12',
  U6_GW03: 'Spare 2',
  U7_GW03: 'Spare 1',
  U9_GW03: 'Ring 13–15',
  U10_GW03: 'Winding 10–18',
  U11_GW03: 'Bailing Press',
  U12_GW03: 'Ring 16–18',
  U13_GW03: 'B/Card+Comber filter',
  U14_GW03: 'Lighting Internal',
  U15_GW03: 'Deep Valve Turbine',
  U18_GW03: 'PF Panel',
};

const meterKeys = Object.keys(meterMap);

@Injectable()
export class Unit5LT4Service {
  constructor(
    @InjectModel(Unit5LT4.name, 'surajcotton')
    private readonly unitModel: Model<Unit5LT4>,
    private readonly meterService: MeterService,
  ) {}

  /** ---------------- Helpers ---------------- */
  private safeRound(num: number, digits = 2) {
    return +Number(num || 0).toFixed(digits);
  }

  private getTimeRange(payload: any) {
    const { startDate, endDate, startTime, endTime } = payload;

    const startMoment = startTime
      ? moment.tz(`${startDate} ${startTime}`, 'YYYY-MM-DD HH:mm', TZ).startOf('minute')
      : moment.tz(`${startDate} 06:00`, 'YYYY-MM-DD HH:mm', TZ);

    const endMoment = endTime
      ? moment.tz(`${endDate} ${endTime}`, 'YYYY-MM-DD HH:mm', TZ).endOf('minute')
      : moment.tz(endDate, 'YYYY-MM-DD', TZ).add(1, 'day').hour(6).minute(0).second(59);

    return {
      startMoment,
      endMoment,
      startISO: startMoment.toISOString(),
      endISO: endMoment.toISOString(),
    };
  }

  /** ---------------- MAIN FUNCTION ---------------- */
  async getSankeyData(payload: any) {
    /** ---------------- TIME RANGE ---------------- */
    const { startMoment, endMoment, startISO, endISO } = this.getTimeRange(payload);

    // console.log("=======================================================");
    // console.log("📌 [Unit5LT4] RAW INPUT:", payload);
    // console.log(`Start (PKT): ${startMoment.format('YYYY-MM-DD HH:mm:ss')}`);
    // console.log(`End   (PKT): ${endMoment.format('YYYY-MM-DD HH:mm:ss')}`);
    // console.log(`Start ISO: ${startISO}`);
    // console.log(`End   ISO: ${endISO}`);
    // console.log("=======================================================\n");

    /** ---------------- METERWISE ---------------- */
    const T1 = `U5LT4_meterwise_${Date.now()}`;
    // console.time(T1);

    const fmCons = await this.meterService.getMeterWiseConsumption(
      payload.startDate,
      payload.endDate,
      { startTime: payload.startTime, endTime: payload.endTime }
    );

    // console.timeEnd(T1);

    const getVal = (key: string) => this.safeRound(fmCons?.[key]);

    /** ---------------- CROSS-UNIT LINKS ---------------- */
    const legs = {
      PDB10_U4: getVal("U4_U23_GW03_Del_ActiveEnergy"),
      PDB10_U5: getVal("U5_U23_GW03_Del_ActiveEnergy"),
    };

    const PDB10_sum = this.safeRound(legs.PDB10_U4 + legs.PDB10_U5);

    /** ---------------- MONGO METER FIELDS ---------------- */
    const meterFields = [
      'U16_GW03_Del_ActiveEnergy', // TF4
      'U17_GW03_Del_ActiveEnergy', // Solar
      ...meterKeys.map((m) => `${m}_Del_ActiveEnergy`),
    ];

    const projection = Object.fromEntries(
      meterFields.flatMap((f) => [
        [`first_${f}`, { $first: `$${f}` }],
        [`last_${f}`, { $last: `$${f}` }],
      ])
    );

    /** ---------------- AGGREGATION ---------------- */
    const T2 = `U5LT4_mongo_${Date.now()}`;
    // console.time(T2);

    const pipeline: PipelineStage[] = [
      { $project: { ts: { $toDate: "$timestamp" }, ...Object.fromEntries(meterFields.map(f => [f, 1])) }},
      { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) }}},
      { $sort: { ts: 1 }},
      { $group: { _id: null, ...projection }},
    ];

    const [data] = await this.unitModel.aggregate(pipeline).exec();

    // console.timeEnd(T2);

    /** ---------------- FIRST/LAST TIMESTAMP DEBUG ---------------- */
    const firstDoc = await this.unitModel
      .findOne({ timestamp: { $gte: startISO, $lte: endISO } })
      .sort({ timestamp: 1 });

    const lastDoc = await this.unitModel
      .findOne({ timestamp: { $gte: startISO, $lte: endISO } })
      .sort({ timestamp: -1 });

    // console.log("FIRST Timestamp:", (firstDoc as any)?.timestamp);
    // console.log("LAST  Timestamp:", (lastDoc as any)?.timestamp);

    /** ---------------- CONSUMPTION TOTALS ---------------- */
    const consumptionTotals = Object.fromEntries(
      meterFields.map((f) => {
        const first = data?.[`first_${f}`] ?? 0;
        const last = data?.[`last_${f}`] ?? 0;
        const diff = Math.max(0, last - first);
        // console.log(`Meter: ${f} | FIRST: ${first} | LAST: ${last} | DIFF: ${diff}`);
        return [f, this.safeRound(diff)];
      })
    );

    /** ---------------- VALUES ---------------- */
    const tf4 = consumptionTotals["U16_GW03_Del_ActiveEnergy"];
    const solar = consumptionTotals["U17_GW03_Del_ActiveEnergy"];

    const totalGeneration = this.safeRound(tf4 + solar);
    const totalIncomingFromUnit4 = this.safeRound(legs.PDB10_U4);

    /** ---------------- OVERRIDES ---------------- */
    const overrideByMeter = { U10_GW03: PDB10_sum };

    /** ---------------- TOTAL CONSUMPTION ---------------- */
    const totalConsumption = meterKeys.reduce((sum, m) => {
      const key = `${m}_Del_ActiveEnergy`;
      const val = overrideByMeter[m] ?? consumptionTotals[key];
      return sum + val;
    }, 0);

    /** ---------------- TRANSFERS (LT4 has none) ---------------- */
    const totalTransferredToUnit4 = 0;

    /** ---------------- UNACCOUNTED ENERGY ---------------- */
    const unaccountedEnergy = this.safeRound(
      (totalGeneration + totalIncomingFromUnit4) -
      (totalConsumption + totalTransferredToUnit4)
    );

    /** ---------------- SANKEY LEGS ---------------- */
    const plcLegs = meterKeys.map((m) => ({
      from: 'TotalLT4',
      to: meterMap[m],
      value: overrideByMeter[m] ?? consumptionTotals[`${m}_Del_ActiveEnergy`],
    }));

    const sankeyData = [
      { from: "T/F 2", to: "TotalLT4", value: tf4 },
      { from: "Solar 1067 kW", to: "TotalLT4", value: solar },
      { from: "From U4LT2 (Ring 5–8)", to: "TotalLT4", value: legs.PDB10_U4 },
      ...plcLegs,
      { from: "TotalLT4", to: "Unaccounted Energy", value: unaccountedEnergy },
    ];

    const totals = {
      Total_Incoming_From_Generation: totalGeneration,
      Total_Incoming_From_Unit_4: totalIncomingFromUnit4,
      Total_Consumption: totalConsumption,
      Total_Transferred_To_Unit_4: totalTransferredToUnit4,
      Total_Unaccountable_Energy: unaccountedEnergy,
    };

    return { sankeyData, totals };
  }
}

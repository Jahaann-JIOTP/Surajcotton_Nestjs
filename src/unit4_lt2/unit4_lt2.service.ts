import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import * as moment from 'moment-timezone';
import { Unit4LT2 } from './schemas/unit4_LT2.schema';
import { MeterService } from 'src/meter/meter.service';

const TZ = 'Asia/Karachi';

/** ---------------- Meter Map (Static) ---------------- */
const meterMap: Record<string, string> = {
  U1_GW01: 'Back Process A/C',
  U2_GW01: 'Conditioning Machine',
  U3_GW01: 'Winding A/C',
  U4_GW01: 'Mill Residential Colony Workshop',
  U5_GW01: 'Card 1-4 + 9-12',
  U18_GW01: 'Colony',
  U8_GW01: 'Blow Room',
  U9_GW01: 'Card 5-8 + 13-14 + Breaker 5-6',
  U10_GW01: 'Winding 1-6',
  U7_GW01: 'Gas Plant Aux (2nd Source)',
  U14_GW01: 'B/Card + Comber Filter',
  U12_GW01: 'B/Card + Comber Filter Bypass',
  U15_GW01: 'Ring 5-8',
  U16_GW01: 'Ring 13-16',
  U17_GW01: 'Ring 9-12',
  U20_GW01: 'Bailing Press',
  U19_GW01: 'Lab A/C',
  U6_GW01: 'Spare',
  U21_GW01: 'Spare 2',
};

const meterKeys = Object.keys(meterMap);

@Injectable()
export class Unit4LT2Service {
  constructor(
    @InjectModel(Unit4LT2.name, 'surajcotton')
    private readonly unitModel: Model<Unit4LT2>,
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

    /** ---------------- DEBUG ---------------- */
    // console.log("=======================================================");
    // console.log("📌 [Unit4LT2] RAW INPUT:", payload);
    // console.log(`Start (PKT): ${startMoment.format('YYYY-MM-DD HH:mm:ss')}`);
    // console.log(`End   (PKT): ${endMoment.format('YYYY-MM-DD HH:mm:ss')}`);
    // console.log(`Start ISO: ${startISO}`);
    // console.log(`End   ISO: ${endISO}`);
    // console.log("=======================================================\n");

    /** ---------------- FETCH METERWISE ---------------- */
    const T1 = `U4LT2_meterwise_${Date.now()}`;
    // console.time(T1);

    const fmCons = await this.meterService.getMeterWiseConsumption(
      payload.startDate,
      payload.endDate,
      { startTime: payload.startTime, endTime: payload.endTime },
    );

    // console.timeEnd(T1);

    /** ---------------- VALUES FROM FM ---------------- */
    const getVal = (k: string) => this.safeRound(fmCons?.[k] ?? 0);

    const PDB2CD2_U5 = getVal("U5_U2_GW02_Del_ActiveEnergy");
    const PDB1CD1_U5 = getVal("U5_U1_GW02_Del_ActiveEnergy");
    const PDB2CD2_U4 = getVal("U4_U2_GW02_Del_ActiveEnergy");
    const PDB1CD1_U4 = getVal("U4_U1_GW02_Del_ActiveEnergy");
    const CardPDB1_U4 = getVal("U4_U3_GW02_Del_ActiveEnergy");
    const PDB08_U4 = getVal("U4_U4_GW02_Del_ActiveEnergy");
    const PDB10_U4 = getVal("U4_U23_GW03_Del_ActiveEnergy");

    /** ---------------- DERIVED ---------------- */
    const PDB12CD12_sum = this.safeRound(PDB2CD2_U5 + PDB1CD1_U5);
    const PDB1CD1_sum = this.safeRound(PDB1CD1_U5 + PDB1CD1_U4);
    const PDB2CD2_sum = this.safeRound(PDB2CD2_U4 + PDB2CD2_U5);
    const ToU5LT1_sum = this.safeRound(CardPDB1_U4 + PDB08_U4);
    const ToU5LT2_sum = this.safeRound(PDB10_U4);

    /** ---------------- METER FIELDS ---------------- */
    const meterFields = [
      "U13_GW01_Del_ActiveEnergy", 
      "U11_GW01_Del_ActiveEnergy",
      "U24_GW01_Del_ActiveEnergy",
      "U28_PLC_Del_ActiveEnergy",
      ...meterKeys.map(m => `${m}_Del_ActiveEnergy`)
    ];

    const projection = Object.fromEntries(
      meterFields.flatMap(f => [
        [`first_${f}`, { $first: `$${f}` }],
        [`last_${f}`, { $last: `$${f}` }],
      ])
    );

    /** ---------------- MONGO AGGREGATION ---------------- */
    const T2 = `U4LT2_mongo_${Date.now()}`;
    // console.time(T2);

    const pipeline: PipelineStage[] = [
      { $project: { ts: { $toDate: "$timestamp" }, ...Object.fromEntries(meterFields.map(f => [f, 1])) }},
      { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) }}},
      { $sort: { ts: 1 }},
      { $group: { _id: null, ...projection }}
    ];

    const [data] = await this.unitModel.aggregate(pipeline).exec();

    // console.timeEnd(T2);

    /** ---------------- FIRST/LAST DOC DEBUG ---------------- */
    const firstDoc = await this.unitModel.findOne({ timestamp: { $gte: startISO, $lte: endISO }}).sort({ timestamp: 1 });
    const lastDoc = await this.unitModel.findOne({ timestamp: { $gte: startISO, $lte: endISO }}).sort({ timestamp: -1 });

    // console.log("FIRST Timestamp:", (firstDoc as any)?.timestamp);
    // console.log("LAST  Timestamp:", (lastDoc as any)?.timestamp);

    /** ---------------- CONSUMPTION ---------------- */
    const consumptionTotals: Record<string, number> = {};

    for (const f of meterFields) {
      const first = data?.[`first_${f}`] ?? 0;
      const last = data?.[`last_${f}`] ?? 0;
      const diff = Math.max(0, last - first);
      consumptionTotals[f] = this.safeRound(diff);
      // console.log(`Meter: ${f} | FIRST: ${first} | LAST: ${last} | DIFF: ${diff}`);
    }

    /** ---------------- ENERGY VALUES ---------------- */
    const tf2 = consumptionTotals["U13_GW01_Del_ActiveEnergy"];
    const GasGen = consumptionTotals["U11_GW01_Del_ActiveEnergy"];
    const Solar = consumptionTotals["U24_GW01_Del_ActiveEnergy"];
    const Solar52 = consumptionTotals["U28_PLC_Del_ActiveEnergy"];

    const totalGeneration = this.safeRound(tf2 + GasGen + Solar + Solar52);

    /** ---------------- TOTAL CONSUMPTION ---------------- */
    let totalConsumption = 0;

    for (const m of meterKeys) {
      let val = consumptionTotals[`${m}_Del_ActiveEnergy`] ?? 0;

      if (m === "U5_GW01") val = PDB1CD1_sum;
      if (m === "U9_GW01") val = PDB2CD2_sum;
      if (m === "U15_GW01") val = Math.max(0, val - PDB10_U4);

      totalConsumption += val;
    }

    const totalTransferred = this.safeRound(PDB08_U4 + CardPDB1_U4 + ToU5LT2_sum);
    const unaccountedEnergy = this.safeRound((totalGeneration + PDB12CD12_sum) - (totalConsumption + totalTransferred));

    /** ---------------- TOTALS ---------------- */
    const totals = {
      Total_Incoming_From_Generation: totalGeneration,
      Total_Incoming_From_Unit_5: PDB12CD12_sum,
      Total_Consumption: totalConsumption,
      Total_Transferred_To_Unit_5: totalTransferred,
      Total_Unaccountable_Energy: unaccountedEnergy,
    };

    /** ---------------- SANKEY ---------------- */
    const plcLegs = meterKeys.map((m) => {
      const label = meterMap[m];
      const key = `${m}_Del_ActiveEnergy`;
      let value = consumptionTotals[key] ?? 0;

      if (m === "U9_GW01") value = PDB2CD2_sum;
      if (m === "U5_GW01") value = PDB1CD1_sum;
      if (m === "U15_GW01") value = Math.max(0, value - PDB10_U4);

      return { from: "TotalLT2", to: label, value };
    });

    const sankeyData = [
      { from: "WAPDA+HFO+JMS Incoming", to: "TotalLT2", value: tf2 },
      { from: "Diesel+JGS Incoming", to: "TotalLT2", value: GasGen },
      { from: "Solar 352.50 kW", to: "TotalLT2", value: Solar },
      { from: "Solar 52.17 kW", to: "TotalLT2", value: Solar52 },
      { from: "From U5LT1 (Comber+Card)", to: "TotalLT2", value: PDB12CD12_sum },
      ...plcLegs,
      { from: "TotalLT2", to: "PDB-08 Comber+Lab Former->To U5LT1", value: PDB08_U4 },
      { from: "TotalLT2", to: "CardPDB1->To U5LT1", value: CardPDB1_U4 },
      { from: "TotalLT2", to: "PDB-10 Winding 10-18->To U5LT2", value: ToU5LT2_sum },
      { from: "TotalLT2", to: "Unaccounted Energy", value: unaccountedEnergy },
    ];

    return { sankeyData, totals };
  }

  /** ---------------- Helper ---------------- */
  private safeRound(num: number, digits = 2) {
    return +Number(num || 0).toFixed(digits);
  }
}

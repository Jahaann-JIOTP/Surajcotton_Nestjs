import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import * as moment from 'moment-timezone';
import { Unit5LT3 } from './schemas/unit5_LT3.schema';
import { MeterService } from 'src/meter/meter.service';

const TZ = 'Asia/Karachi';

/** ---------------- Meter Map (Static) ---------------- */
const meterMap: Record<string, string> = {
  U7_GW02: 'Ring 1-3',
  U8_GW02: 'Ring A/C (Supply Fans)',
  U9_GW02: 'Blow Room',
  U10_GW02: 'Ring 4-6',
  U11_GW02: 'Back Process A/C',
  U12_GW02: 'Lighting Internal',
  U14_GW02: 'Comber 1-14 + Lap Former 1-3',
  U15_GW02: 'Ring A/C (Return Fans)',
  U16_GW02: 'PF Panel',
  U17_GW02: 'Card 8-14',
  U18_GW02: 'Winding 1-9',
  U19_GW02: 'Card 1-7',
  U20_GW02: 'Winding A/C',
  U21_GW02: 'Simplex 1-5+Drawing Breaker 1-6',
  U23_GW02: 'Drawing Finisher 1-8',
  U22_GW02: 'To U4LT1 (Ring Unit 4 (17-20))',
};

const meterKeys = Object.keys(meterMap);

@Injectable()
export class Unit5LT3Service {
  constructor(
    @InjectModel(Unit5LT3.name, 'surajcotton')
    private readonly unitModel: Model<Unit5LT3>,
    private readonly meterService: MeterService,
  ) {}

  /** ---------------- Helper ---------------- */
  private safeRound(num: number, digits = 2) {
    return +Number(num || 0).toFixed(digits);
  }

  /** ---------------- TIME RANGE (PKT → UTC) ---------------- */
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
    // console.log("📌 [Unit5LT3] RAW INPUT:", payload);
    // console.log(`Start (PKT): ${startMoment.format('YYYY-MM-DD HH:mm:ss')}`);
    // console.log(`End   (PKT): ${endMoment.format('YYYY-MM-DD HH:mm:ss')}`);
    // console.log(`Start ISO: ${startISO}`);
    // console.log(`End   ISO: ${endISO}`);
    // console.log("=======================================================\n");

    /** ---------------- METERWISE CONSUMPTION ---------------- */
    const T1 = `U5LT3_meterwise_${Date.now()}`;
    // console.time(T1);

    const fmCons = await this.meterService.getMeterWiseConsumption(
      payload.startDate,
      payload.endDate,
      { startTime: payload.startTime, endTime: payload.endTime },
    );

    // console.timeEnd(T1);

    const getVal = (key: string) => this.safeRound(fmCons?.[key]);

    /** ---------------- CROSS-UNIT LEGS ---------------- */
    const legs = {
      PDB07_U4: getVal("U4_U22_GW03_Del_ActiveEnergy"),
      PDB07_U5: getVal("U5_U22_GW03_Del_ActiveEnergy"),
      PDB08_U5: getVal("U5_U4_GW02_Del_ActiveEnergy"),
      CardPDB1_U5: getVal("U5_U3_GW02_Del_ActiveEnergy"),
      PDB1CD1_U5: getVal("U5_U1_GW02_Del_ActiveEnergy"),
      PDB2CD2_U5: getVal("U5_U2_GW02_Del_ActiveEnergy"),

      CardPDB1_U4: getVal("U4_U3_GW02_Del_ActiveEnergy"),
      PDB08_U4: getVal("U4_U4_GW02_Del_ActiveEnergy"),
      PDB2CD2_U4: getVal("U4_U2_GW02_Del_ActiveEnergy"),
      PDB1CD1_U4: getVal("U4_U1_GW02_Del_ActiveEnergy"),
    };

    /** ---------------- DERIVED SUMS ---------------- */
    const PDB07_sum = this.safeRound(legs.PDB07_U4 + legs.PDB07_U5);
    const PDB08_sum = this.safeRound(legs.PDB08_U5 + legs.PDB08_U4);
    const CardPDB1_sum = this.safeRound(legs.CardPDB1_U5 + legs.CardPDB1_U4);
    const U4_LT2_sum = this.safeRound(legs.CardPDB1_U4 + legs.PDB08_U4);

    /** ---------------- MONGO METER KEYS ---------------- */
    const meterFields = [
      "U13_GW02_Del_ActiveEnergy", 
      "U6_GW02_Del_ActiveEnergy", 
      "U16_PLC_Del_ActiveEnergy",
      "U2_PLC_Del_ActiveEnergy",
      ...meterKeys.map(m => `${m}_Del_ActiveEnergy`)
    ];

    const projection = Object.fromEntries(
      meterFields.flatMap(f => [
        [`first_${f}`, { $first: `$${f}` }],
        [`last_${f}`, { $last: `$${f}` }],
      ])
    );

    /** ---------------- AGGREGATION ---------------- */
    const T2 = `U5LT3_mongo_${Date.now()}`;
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

    /** ---------------- CONSUMPTION ---------------- */
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
    const tf3 = consumptionTotals["U13_GW02_Del_ActiveEnergy"];
    const solar = consumptionTotals["U6_GW02_Del_ActiveEnergy"];
    const u16 = consumptionTotals["U16_PLC_Del_ActiveEnergy"];
    const u2 = consumptionTotals["U2_PLC_Del_ActiveEnergy"];
    const u16u2_sum = this.safeRound(u16 + u2);

    const totalGeneration = this.safeRound(tf3 + solar);
    const totalIncomingFromUnit4 = this.safeRound(legs.PDB07_U4 + U4_LT2_sum + u16u2_sum);

    /** ---------------- OVERRIDES ---------------- */
    const overrideByMeter = {
      U18_GW02: PDB07_sum,
      U17_GW02: CardPDB1_sum,
      U14_GW02: PDB08_sum,
    };

    /** ---------------- TOTAL CONSUMPTION ---------------- */
    let totalConsumption = 0;

    for (const m of meterKeys) {
      const key = `${m}_Del_ActiveEnergy`;
      let val = consumptionTotals[key] ?? 0;

      if (overrideByMeter[m]) val = overrideByMeter[m];

      totalConsumption += val;
    }
    totalConsumption += u16;

    /** ---------------- TRANSFERS ---------------- */
    const totalTransferredToUnit4 = this.safeRound(
      
      (consumptionTotals["U22_GW02_Del_ActiveEnergy"] ?? 0) +
      legs.PDB1CD1_U5 +
      legs.PDB2CD2_U5
    );

    /** ---------------- UNACCOUNTED ---------------- */
    const unaccountedEnergy = this.safeRound(
      (totalGeneration + totalIncomingFromUnit4) -
      (totalConsumption + totalTransferredToUnit4)
    );

    /** ---------------- SANKEY ---------------- */
    const plcLegs = meterKeys
      .filter((m) => m !== "U22_GW02")
      .map((m) => ({
        from: "TotalLT3",
        to: meterMap[m],
        value: overrideByMeter[m] ?? consumptionTotals[`${m}_Del_ActiveEnergy`],
      }));

    const sankeyData = [
      { from: "T/F 3", to: "TotalLT3", value: tf3 },
      { from: "Solar 1185 kW", to: "TotalLT3", value: solar },
      { from: "From U4LT1 (Ring 21-24)", to: "TotalLT3", value: legs.PDB07_U4 },
      { from: "From U4LT2 (Card1–14)", to: "TotalLT3", value: U4_LT2_sum },
      { from: "From U4LT1 (Lighting Internal Unit 5)", to: "TotalLT3", value: u2 },
      { from: "From U4LT1 (Compressor 303kW)", to: "TotalLT3", value: u16 },

      ...plcLegs,

      { from: "TotalLT3", to: meterMap["U22_GW02"], value: consumptionTotals["U22_GW02_Del_ActiveEnergy"] },
      { from: "TotalLT3", to: "Compressor 303 kW", value: u16 },
      { from: "TotalLT3", to: "PDBCD1 → U4LT2", value: legs.PDB1CD1_U5 },
      { from: "TotalLT3", to: "PDBCD2 → U4LT2", value: legs.PDB2CD2_U5 },
       // Add compressor on the consumption side
      

      { from: "TotalLT3", to: "Unaccounted Energy", value: unaccountedEnergy },
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

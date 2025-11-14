import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage } from "mongoose";
import * as moment from "moment-timezone";
import { Unit5LT3 } from "./schemas/unit5_LT3.schema";
import { MeterService } from "src/meter/meter.service";

@Injectable()
export class Unit5LT3Service {
  constructor(
    @InjectModel(Unit5LT3.name, "surajcotton")
    private readonly unitModel: Model<Unit5LT3>,
    private readonly meterService: MeterService
  ) {}

  /** ---------------- Helper Functions ---------------- */
  private safeRound(num: number, digits = 2): number {
    return +Number(num || 0).toFixed(digits);
  }

  private getISOTimeRange(startDate: string, endDate: string, startTime?: string, endTime?: string) {
    const TZ = "Asia/Karachi";
    const startISO = startTime
      ? moment.tz(`${startDate} ${startTime}`, "YYYY-MM-DD HH:mm", TZ).startOf("minute").toISOString()
      : `${startDate}T06:00:00.000+05:00`;

    const endISO = endTime
      ? moment.tz(`${endDate} ${endTime}`, "YYYY-MM-DD HH:mm", TZ).endOf("minute").toISOString()
      : `${moment(endDate).add(1, "day").format("YYYY-MM-DD")}T06:00:59.999+05:00`;

    return { startISO, endISO };
  }

  /** ---------------- Main Logic ---------------- */
  async getSankeyData(payload: { startDate: string; endDate: string; startTime?: string; endTime?: string }) {
    const { startDate, endDate, startTime, endTime } = payload;
    const { startISO, endISO } = this.getISOTimeRange(startDate, endDate, startTime, endTime);

    /** ---------------- Fetch Meter Consumption ---------------- */
    const fmCons = await this.meterService.getMeterWiseConsumption(startDate, endDate, { startTime, endTime });
    const getVal = (key: string) => this.safeRound(fmCons?.[key]);

    // Cross-unit legs
    const keys = {
      PDB07_U4: "U4_U22_GW03_Del_ActiveEnergy",
      PDB07_U5: "U5_U22_GW03_Del_ActiveEnergy",
      PDB08_U5: "U5_U4_GW02_Del_ActiveEnergy",
      CardPDB1_U5: "U5_U3_GW02_Del_ActiveEnergy",
      PDB1CD1_U5: "U5_U1_GW02_Del_ActiveEnergy",
      PDB2CD2_U5: "U5_U2_GW02_Del_ActiveEnergy",
      CardPDB1_U4: "U4_U3_GW02_Del_ActiveEnergy",
      PDB08_U4: "U4_U4_GW02_Del_ActiveEnergy",
      PDB2CD2_U4: "U4_U2_GW02_Del_ActiveEnergy",
      PDB1CD1_U4: "U4_U1_GW02_Del_ActiveEnergy",
    };

    const vals = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, getVal(v)]));

    // Derived sums
    const toU4LT2 = this.safeRound(vals.PDB1CD1_U5 + vals.PDB2CD2_U5);
    const PDB07_sum = this.safeRound(vals.PDB07_U5 + vals.PDB07_U4);
    const PDB08_sum = this.safeRound(vals.PDB08_U5 + vals.PDB08_U4);
    const CardPDB1_sum = this.safeRound(vals.CardPDB1_U5 + vals.CardPDB1_U4);
    const U4_LT2_sum = this.safeRound(vals.CardPDB1_U4 + vals.PDB08_U4);

    /** ---------------- Meter Mapping ---------------- */
    const meterMap: Record<string, string> = {
      U7_GW02: "Ring 1-3",
      U8_GW02: "Ring A/C (Supply Fans)",
      U9_GW02: "Blow Room",
      U10_GW02: "Ring 4-6",
      U11_GW02: "A/C Back Process",
      U12_GW02: "Lighting Internal",
      U14_GW02: "Comber 1-14+Lap Former 1-3",
      U15_GW02: "Ring A/C (Return Fans)",
      U16_GW02: "Water Chiller",
      U17_GW02: "Card 8-14",
      U18_GW02: "Winding 1-9",
      U19_GW02: "Card 1-7",
      U20_GW02: "Winding A/C",
      U21_GW02: "Simplex 1-5 + Breaker 1-6",
      U23_GW02: "Drawing Finisher 1-8",
      U22_GW02: "To U4LT1 (Spare 2)",
    };

    /** ---------------- Aggregation ---------------- */
    const meterFields = [
      "U13_GW02_Del_ActiveEnergy", // TF3
      "U6_GW02_Del_ActiveEnergy",  // Solar
      "U16_PLC_Del_ActiveEnergy",  // Compressor
      "U2_PLC_Del_ActiveEnergy",   // Lighting
      ...Object.keys(meterMap).map((m) => `${m}_Del_ActiveEnergy`),
    ];

    const projection = Object.fromEntries(
      meterFields.flatMap((f) => [
        [`first_${f}`, { $first: `$${f}` }],
        [`last_${f}`, { $last: `$${f}` }],
      ])
    );

    const pipeline: PipelineStage[] = [
      { $addFields: { ts: { $toDate: "$timestamp" } } },
      { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) } } },
      { $sort: { ts: 1 } },
      { $group: { _id: null, ...projection } },
    ];

    const [results] = await this.unitModel.aggregate(pipeline).exec();

    /** ---------------- Calculate Consumption Totals ---------------- */
    const consumptionTotals = Object.fromEntries(
      meterFields.map((f) => {
        const first = results?.[`first_${f}`] ?? 0;
        const last = results?.[`last_${f}`] ?? 0;
        return [f, last > first ? this.safeRound(last - first) : 0];
      })
    );

    /** ---------------- Core Calculations ---------------- */
    const tf3 = this.safeRound(consumptionTotals["U13_GW02_Del_ActiveEnergy"]);
    const solar = this.safeRound(consumptionTotals["U6_GW02_Del_ActiveEnergy"]);
    const u16Compressor = this.safeRound(consumptionTotals["U16_PLC_Del_ActiveEnergy"]);
    const u2Lighting = this.safeRound(consumptionTotals["U2_PLC_Del_ActiveEnergy"]);
    const u16u2 = this.safeRound(u16Compressor + u2Lighting);

    const totalGeneration = this.safeRound(tf3 + solar);
    const totalIncomingFromUnit4 = this.safeRound(vals.PDB07_U4 + U4_LT2_sum + u16u2);

    const overrideByMeter = {
      U18_GW02: PDB07_sum,
      U17_GW02: CardPDB1_sum,
      U14_GW02: PDB08_sum,
    };

    /** ---------------- Internal Load ---------------- */
    const totalConsumption = Object.keys(meterMap).reduce((sum, m) => {
      const val = this.safeRound(consumptionTotals[`${m}_Del_ActiveEnergy`]);
      return sum + (overrideByMeter[m] ?? val);
    }, 0);

    /** ---------------- Transfers to Unit 4 ---------------- */
    const totalTransferredToUnit4 = this.safeRound(
      u16Compressor +
      u2Lighting +
      (consumptionTotals["U22_GW02_Del_ActiveEnergy"] || 0) +
      vals.PDB1CD1_U5 +
      vals.PDB2CD2_U5
    );

    /** ---------------- Energy Balance ---------------- */
    const unaccountedEnergy = this.safeRound(
      (totalGeneration + totalIncomingFromUnit4) -
      (totalConsumption + totalTransferredToUnit4)
    );

    /** ---------------- Sankey Data ---------------- */
    const plcLegs = Object.entries(meterMap)
      .filter(([key]) => key !== "U22_GW02")
      .map(([meter, label]) => {
        const key = `${meter}_Del_ActiveEnergy`;
        const value = overrideByMeter[meter] ?? this.safeRound(consumptionTotals[key]);
        return { from: "TotalLT3", to: label, value };
      });

    const sankeyData = [
      { from: "T/F 1", to: "TotalLT3", value: tf3 },
      { from: "Solar 1185 Kw", to: "TotalLT3", value: solar },
      { from: "From U4LT1 (Ring 21–24)", to: "TotalLT3", value: vals.PDB07_U4 },
      { from: "From U4LT2 (Card1–8 & Card9–14+1B)", to: "TotalLT3", value: U4_LT2_sum },
      { from: "From U4LT1 (Lighting Internal Unit 5)", to: "TotalLT3", value: u2Lighting },
      { from: "From U4LT1 (Compressor 303kw)", to: "TotalLT3", value: u16Compressor },
      
      ...plcLegs,
      { from: "TotalLT3", to: meterMap["U22_GW02"], value: this.safeRound(consumptionTotals["U22_GW02_Del_ActiveEnergy"]) },
      {
        from: 'TotalLT3',
        to: 'From U4LT 1 Lighting Internal Unit 5',
        value: u2Lighting, // 👈 sum of both
      },
      {
        from: 'TotalLT3',
        to: 'From U4LT 1 Compressor 303 kW',
        value: u16Compressor, // 👈 sum of both
      },
      { from: "TotalLT3", to: "PDBCD1 → U4LT2 (Card1–8)", value: vals.PDB1CD1_U5 },
      { from: "TotalLT3", to: "PDBCD2 → U4LT2 (Card9–14+1B)", value: vals.PDB2CD2_U5 },
      { from: "TotalLT3", to: "Unaccounted Energy", value: unaccountedEnergy },
    ];

    /** ---------------- Totals Summary ---------------- */
    const totals = {
      Total_Incoming_From_Generation:totalGeneration,
      Total_Incoming_From_Unit_4:totalIncomingFromUnit4,
      Total_Consumption:totalConsumption,
      Total_Transferred_To_Unit_4:totalTransferredToUnit4,
     Total_Unaccountable_Energy :unaccountedEnergy,
    };

    return { sankeyData, totals };
  }
}

import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage } from "mongoose";
import * as moment from "moment-timezone";
import { Unit5LT4 } from "./schemas/unit5_LT4.schema";
import { MeterService } from "src/meter/meter.service";

@Injectable()
export class Unit5LT4Service {
  constructor(
    @InjectModel(Unit5LT4.name, "surajcotton")
    private readonly unitModel: Model<Unit5LT4>,
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

    /** ---------------- Cross-Unit Links ---------------- */
    const keys = {
      PDB10_U4: "U4_U23_GW03_Del_ActiveEnergy",
      PDB10_U5: "U5_U23_GW03_Del_ActiveEnergy",
    };
    const vals = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, getVal(v)]));
    const PDB10_sum = this.safeRound(vals.PDB10_U4 + vals.PDB10_U5);

    /** ---------------- Meter Mapping ---------------- */
    const meterMap: Record<string, string> = {
      U1_GW03: "Ring 7–9",
      U2_GW03: "Conditioning Machine",
      U3_GW03: "MLDB3 Single Room Quarter",
      U4_GW03: "Roving Transport System",
      U5_GW03: "Ring 10–12",
      U6_GW03: "Spare 2",
      U7_GW03: "Spare 1",
      // U8_GW03: "Spare 2",
      U9_GW03: "Ring 13–15",
      U10_GW03: "Winding 10-18",
      U11_GW03: "Bailing Press",
      U12_GW03: "Ring 16–18",
      U13_GW03: "B/Card+Comber filter",
      U14_GW03: "Lighting Internal",
      U15_GW03: "Deep Valve Turbine",
      U18_GW03: "PF Panel",
    };

    /** ---------------- Aggregation ---------------- */
    const meterFields = [
      "U16_GW03_Del_ActiveEnergy", // TF4
      "U17_GW03_Del_ActiveEnergy", // Solar
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

    /** ---------------- Calculate Meter Consumption ---------------- */
    const consumptionTotals = Object.fromEntries(
      meterFields.map((f) => {
        const first = results?.[`first_${f}`] ?? 0;
        const last = results?.[`last_${f}`] ?? 0;
        return [f, last > first ? this.safeRound(last - first) : 0];
      })
    );

    /** ---------------- Core Calculations ---------------- */
    const tf4 = this.safeRound(consumptionTotals["U16_GW03_Del_ActiveEnergy"]);
    const solar = this.safeRound(consumptionTotals["U17_GW03_Del_ActiveEnergy"]);
    const totalGeneration = this.safeRound(tf4 + solar);
    const totalIncomingFromUnit4 = this.safeRound(vals.PDB10_U4);

    const overrideByMeter = { U10_GW03: PDB10_sum };

    /** ---------------- Total Consumption ---------------- */
    const totalConsumption = Object.keys(meterMap).reduce((sum, m) => {
      const val = this.safeRound(consumptionTotals[`${m}_Del_ActiveEnergy`]);
      return sum + (overrideByMeter[m] ?? val);
    }, 0);

    /** ---------------- Transfers (if any future links added) ---------------- */
    const totalTransferredToUnit4 = 0; // currently none in LT4

    /** ---------------- Energy Balance ---------------- */
    const unaccountedEnergy = this.safeRound(
      (totalGeneration + totalIncomingFromUnit4) -
      (totalConsumption + totalTransferredToUnit4)
    );

    /** ---------------- Sankey Data ---------------- */
    const plcLegs = Object.entries(meterMap).map(([meter, label]) => {
      const key = `${meter}_Del_ActiveEnergy`;
      const value = overrideByMeter[meter] ?? this.safeRound(consumptionTotals[key]);
      return { from: "TotalLT4", to: label, value };
    });

    const sankeyData = [
      { from: "T/F 2", to: "TotalLT4", value: tf4 },
      { from: "Solar 1067 kW", to: "TotalLT4", value: solar },
      { from: "From U4LT2 (Ring 5–8)", to: "TotalLT4", value: vals.PDB10_U4 },
      ...plcLegs,
      { from: "TotalLT4", to: "Unaccounted Energy", value: unaccountedEnergy },
    ];

    /** ---------------- Totals Summary ---------------- */
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

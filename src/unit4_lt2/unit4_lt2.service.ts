import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as moment from "moment-timezone";
import { Unit4LT2 } from "./schemas/unit4_LT2.schema";
import { MeterService } from "src/meter/meter.service";
import { PipelineStage } from "mongoose";

@Injectable()
export class Unit4LT2Service {
  constructor(
    @InjectModel(Unit4LT2.name, "surajcotton")
    private readonly unitModel: Model<Unit4LT2>,
    private readonly meterService: MeterService
  ) {}

  async getSankeyData(payload: {
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
  }) {
    const TZ = "Asia/Karachi";

    /** ---------------- Determine Time Window ---------------- */
    const { startDate, endDate, startTime, endTime } = payload;
    const startISO = startTime
      ? moment.tz(`${startDate} ${startTime}`, "YYYY-MM-DD HH:mm", TZ).startOf("minute").toISOString()
      : `${startDate}T06:00:00.000+05:00`;

    const endISO = endTime
      ? moment.tz(`${endDate} ${endTime}`, "YYYY-MM-DD HH:mm", TZ).endOf("minute").toISOString()
      : `${moment(endDate).add(1, "day").format("YYYY-MM-DD")}T06:00:59.999+05:00`;

    /** ---------------- Fetch Meter Consumption ---------------- */
    const fmCons = await this.meterService.getMeterWiseConsumption(startDate, endDate, { startTime, endTime });

    const getVal = (key: string) => this.safeRound(fmCons?.[key] ?? 0);

    const PDB2CD2_U5 = getVal("U5_U2_GW02_Del_ActiveEnergy");
    const PDB1CD1_U5 = getVal("U5_U1_GW02_Del_ActiveEnergy");
    const PDB2CD2_U4 = getVal("U4_U2_GW02_Del_ActiveEnergy");
    const PDB1CD1_U4 = getVal("U4_U1_GW02_Del_ActiveEnergy");
    const CardPDB1_U4 = getVal("U4_U3_GW02_Del_ActiveEnergy");
    const PDB08_U4 = getVal("U4_U4_GW02_Del_ActiveEnergy");
    const PDB10_U4 = getVal("U4_U23_GW03_Del_ActiveEnergy");

    /** ---------------- Derived Totals ---------------- */
    const PDB12CD12_sum = this.safeRound(PDB2CD2_U5 + PDB1CD1_U5);
    const PDB1CD1_sum = this.safeRound(PDB1CD1_U5 + PDB1CD1_U4);
    const PDB2CD2_sum = this.safeRound(PDB2CD2_U4 + PDB2CD2_U5);
    const ToU5LT1_sum = this.safeRound(CardPDB1_U4 + PDB08_U4);
    const ToU5LT2_sum = this.safeRound(PDB10_U4);

    /** ---------------- Meter Mapping ---------------- */
    const meterMap: Record<string, string> = {
      U1_GW01: "Back Process A/C",
      U2_GW01: "Conditioning Machine",
      U3_GW01: "Winding A/C",
      U4_GW01: "Mill Residental Colony Workshop",
      U5_GW01: "Card 1-4+9-12",
      U18_GW01: "Colony",
      U8_GW01: "Blow Room",
      U9_GW01: "Card 5-8+ 13-14 + Breaker 5-6",
      U10_GW01: "Winding 1-6",
      U7_GW01: "Gas Plant Aux(2nd Source)",
      U14_GW01: "B/Card + Comber Filter Bypass",
      U15_GW01: "Ring 5-8",
      U16_GW01: "Ring 13-16",
      U17_GW01: "Ring 9-12",
      U20_GW01: "Bailing Press",
      U19_GW01: "Lab A/C",
      U6_GW01: "Spare",
      U21_GW01: "Spare 2",
    };

    /** ---------------- Mongo Aggregation ---------------- */
    const meterFields = [
      "U13_GW01_Del_ActiveEnergy", // TF2
      "U11_GW01_Del_ActiveEnergy", // Gas Gen
      "U24_GW01_Del_ActiveEnergy", // Solar
      "U28_PLC_Del_ActiveEnergy",  // Solar 52.17
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
  { $sort: { ts: 1 } }, // ascending sort
  { $group: { _id: null, ...projection } },
];


    const [results] = await this.unitModel.aggregate(pipeline).exec();
    const consumptionTotals: Record<string, number> = {};

    for (const field of meterFields) {
      const first = results?.[`first_${field}`] ?? 0;
      const last = results?.[`last_${field}`] ?? 0;
      const diff = last - first;
      consumptionTotals[field] = diff >= 0 ? this.safeRound(diff) : 0;
    }

    /** ---------------- Adjustments ---------------- */
    const minusByMeter = { U15_GW01: PDB10_U4 };
    const overrideByMeter = { U9_GW01: PDB2CD2_sum, U5_GW01: PDB1CD1_sum };

    const plcLegs = Object.entries(meterMap).map(([meter, label]) => {
      const key = `${meter}_Del_ActiveEnergy`;
      const base = this.safeRound(consumptionTotals[key] || 0);

      if (overrideByMeter[meter]) return { from: "TotalLT2", to: label, value: overrideByMeter[meter] };

      const value = Math.max(0, this.safeRound(base - (minusByMeter[meter] ?? 0)));
      return { from: "TotalLT2", to: label, value };
    });

    /** ---------------- Totals & Summary ---------------- */
    const tf2 = this.safeRound(consumptionTotals["U13_GW01_Del_ActiveEnergy"]);
    const GasGen = this.safeRound(consumptionTotals["U11_GW01_Del_ActiveEnergy"]);
    const Solar = this.safeRound(consumptionTotals["U24_GW01_Del_ActiveEnergy"]);
    const Solar52 = this.safeRound(consumptionTotals["U28_PLC_Del_ActiveEnergy"]);

    const totalGeneration = this.safeRound(tf2 + GasGen + Solar + Solar52);

    // Compute total consumption
    const totalConsumption = Object.keys(meterMap).reduce((sum, m) => {
      let cons = this.safeRound(consumptionTotals[`${m}_Del_ActiveEnergy`] || 0);
      if (m === "U5_GW01") cons = PDB1CD1_sum;
      else if (m === "U9_GW01") cons = PDB2CD2_sum;
      else if (m === "U15_GW01") cons = Math.max(0, this.safeRound(cons - PDB10_U4));
      return sum + cons;
    }, 0);

    // Compute unaccounted
    const totalTransferred = this.safeRound(PDB08_U4 + CardPDB1_U4 + ToU5LT2_sum);
    const unaccountedEnergy = this.safeRound((totalGeneration + PDB12CD12_sum) - (totalConsumption + totalTransferred));

    /** ---------------- Output Summary ---------------- */
    const totals = {
      Total_Incoming_From_Generation:totalGeneration,
      Total_Incoming_From_Unit_5: PDB12CD12_sum,
      Total_Consumption:totalConsumption,
      Total_Transferred_To_Unit_5: totalTransferred,
      Total_Unaccountable_Energy: unaccountedEnergy,
    };

    /** ---------------- Sankey Data ---------------- */
    const sankeyData = [
      { from: "WAPDA+HFO+JMS Incoming", to: "TotalLT2", value: tf2 },
      { from: "Diesel+JGS Incoming", to: "TotalLT2", value: GasGen },
      { from: "Solar 352.50 kW", to: "TotalLT2", value: Solar },
      { from: "Solar 52.17 kW", to: "TotalLT2", value: Solar52 },
      { from: "From U5LT1 (ComberM/C1-14 & CardM/C8-14)", to: "TotalLT2", value: PDB12CD12_sum },
      ...plcLegs,
      { from: "TotalLT2", to: "PDB08->To U5LT1(ComberM/C1-14)", value: PDB08_U4 },
      { from: "TotalLT2", to: "CardPDB1->To U5LT1(CardM/C8-14)", value: CardPDB1_U4 },
      { from: "TotalLT2", to: "PDB10->To U5LT2(AutoCone 10-18)", value: ToU5LT2_sum },
      { from: "TotalLT2", to: "Unaccounted Energy", value: unaccountedEnergy },
    ];

    return { sankeyData, totals };
  }

  /** ---------------- Utility ---------------- */
  private safeRound(num: number, digits = 2): number {
    return +num.toFixed(digits);
  }
}

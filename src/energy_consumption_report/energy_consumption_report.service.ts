import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { Energyconsumptionreport } from './schemas/energy-usage_report.schema';
import { DailyProduction } from './schemas/daily-production.schema';
import { FieldMeterProcess } from './schemas/field-meter-process.schema';
import { MeterService } from 'src/meter/meter.service';
// import { EnergySpindleService } from './energy-spindle/energy_spindle.service';
import { EnergySpindleService } from 'src/energy_spindle/energy_spindle.service';


import * as moment from 'moment-timezone';

export interface SummaryByDept {
  date: string;
  startTimestamp: string;
  endTimestamp: string;
  [key: string]: number | string;
}

@Injectable()
export class EnergyconsumptionreportService {
  constructor(
    @InjectModel(Energyconsumptionreport.name, 'surajcotton')
    private costModel: Model<Energyconsumptionreport>,
    @InjectModel(DailyProduction.name, 'surajcotton')
    private dailyModel: Model<DailyProduction>,
    @InjectModel(FieldMeterProcess.name, 'surajcotton')
    private fieldMeterModel: Model<FieldMeterProcess>,
    private readonly meterService: MeterService,
    private readonly energySpindleService: EnergySpindleService, // 👈 add this
    
  ) { }

  private sanitizeValue(value: number): number {
    if (!isFinite(value) || isNaN(value)) return 0;
    const minThreshold = 1e-6;
    const maxThreshold = 1e12;
    if (Math.abs(value) < minThreshold || Math.abs(value) > maxThreshold) return 0;
    return value;
  }
  private round2(value: string | number) {
    const n = Number(value);
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  async getConsumptionData(dto: GetEnergyCostDto) {
    const { start_date, end_date, suffixes, area, start_time, end_time } = dto;
    const suffix = suffixes?.[0] || 'Del_ActiveEnergy';
    const TZ = 'Asia/Karachi';
    const areaKeys = area === 'ALL' ? ['Unit_4', 'Unit_5'] : [area];

    // ------------------------------------------------
    // ⚡ Field Meter / PDB pulls
    // ------------------------------------------------
    const fmCons = await this.meterService.getMeterWiseConsumption(
      start_date,
      end_date,
      { startTime: start_time, endTime: end_time },
    );

    const PDB07_U4 = +(Number(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));

    const PDB1CD1_U5 = +(Number(fmCons?.U5_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB1CD1_U4 = +(Number(fmCons?.U4_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB1CD1_Total = Math.max(0, +(PDB1CD1_U4 + PDB1CD1_U5).toFixed(2));

    const PDB2CD2_U4 = +(Number(fmCons?.U4_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB2CD2_U5 = +(Number(fmCons?.U5_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB2CD2_Total = Math.max(0, +(PDB2CD2_U4 + PDB2CD2_U5).toFixed(2));

    // This is what we treat as "other unit load into U4 LT2"
    const PDB12CD12_sum = Math.max(0, +(PDB2CD2_U5 + PDB1CD1_U5).toFixed(2));

    const PDB10_U4 = +(Number(fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));

    const PDB08_U4 = +(Number(fmCons?.U4_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB08_U5 = +(Number(fmCons?.U5_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB08_Total = Math.max(0, +(PDB08_U4 + PDB08_U5).toFixed(2));

    const CardPDB1_U5 = +(Number(fmCons?.U5_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const CardPDB1_U4 = +(Number(fmCons?.U4_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const CardPDB1_sum = Math.max(0, +(CardPDB1_U5 + CardPDB1_U4).toFixed(2));

    const PDB07_U5 = +(Number(fmCons?.U5_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB07_sum = Math.max(0, +(PDB07_U5 + PDB07_U4).toFixed(2));

    const PDB10_U5 = +(Number(fmCons?.U5_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB10_sum = Math.max(0, +(PDB10_U4 + PDB10_U5).toFixed(2));

    const U4_LT2_sum = Math.max(0, +(CardPDB1_U4 + PDB08_U4).toFixed(2));

    // ------------------------------------------------
    // 🧱 Process Mappings
    // ------------------------------------------------
    const processMappings: Record<string, Record<string, string[]>> = {
      Card_Breaker: { Unit_4: ['U5_GW01', 'U9_GW01'], Unit_5: ['U19_GW02', 'U17_GW02'] },
      BlowRoom: { Unit_4: ['U8_GW01'], Unit_5: ['U9_GW02'] },
      Comberandunilap: { Unit_4: ['U13_PLC'], Unit_5: ['U14_GW02', 'U6_GW03'] },
      DrawingFinisherand2Breaker: { Unit_4: ['U8_PLC'], Unit_5: ['U23_GW02'] },
      DrawingSimplex: { Unit_4: ['U15_PLC'], Unit_5: ['U21_GW02'] },
      RTransportSystem: { Unit_4: ['U1_PLC'], Unit_5: ['U4_GW03'] },
      Ring: {
        Unit_4: [
          'U10_PLC', 'U11_PLC', 'U12_PLC', 'U15_GW01', 'U17_GW01', 'U16_GW01', 'U22_GW02'
        ],
        Unit_5: ['U10_GW02', 'U7_GW02', 'U1_GW03', 'U5_GW03', 'U9_GW03', 'U12_GW03'],
      },
      AutoCone_Winding10to18: { Unit_4: ['U9_PLC', 'U10_GW01'], Unit_5: ['U18_GW02', 'U10_GW03'] },
      B_CardandComberFilter: { Unit_4: ['U14_GW01', 'U12_GW01'], Unit_5: ['U13_GW03'] },
      AC_BackProcess: { Unit_4: ['U1_GW01'], Unit_5: ['U11_GW02'] },
      AC_Ring: { Unit_4: ['U18_PLC', 'U17_PLC'], Unit_5: ['U8_GW02', 'U15_GW02'] },
      AC_AutoCone_Winding: { Unit_4: ['U3_GW01'], Unit_5: ['U20_GW02'] },
      AirCompressor: { Unit_4: ['U14_PLC', 'U20_PLC'], Unit_5: ['U16_PLC'] },
      Deep_Well_Turbine: { Unit_4: ['U6_PLC'], Unit_5: ['U15_GW03'] },
      BailingPress: { Unit_4: ['U20_GW01'], Unit_5: ['U11_GW03'] },
      Mills_Lighting: { Unit_4: ['U4_PLC', 'U3_PLC'], Unit_5: ['U14_GW03', 'U12_GW02', 'U2_PLC'] },
      Residentialcolony: { Unit_4: ['U18_GW01', 'U4_GW01'], Unit_5: ['U3_GW03'] },
      Conditioning_Machine: { Unit_4: ['U2_GW01'], Unit_5: ['U2_GW03'] },
      // Workshop: { Unit_4: ['U4_GW01'] },
      Lab_and_Offices: { Unit_4: ['U19_GW01'] },
      "HFO Plant Aux(2nd Source)": { Unit_4: ['U5_PLC'] },
      "Gas Plant Aux(2nd Source)": { Unit_4: ['U7_GW01'] },//remove u11 to u7
      "Water Chiller": { Unit_5: ['U16_GW02'] },
      "HFO + JMS Auxiliary": { Unit_5: [""] },
      Spare: { Unit_4: ['U6_GW01', 'U21_GW01'], Unit_5: ['U7_GW03', 'U8_GW03', 'U18_GW03'] },
    };

    // ------------------------------------------------
    // 🕓 Date Range
    // ------------------------------------------------
    const startISO = moment.tz(`${start_date} ${start_time}`, 'YYYY-MM-DD HH:mm', TZ)
      .startOf('minute')
      .format('YYYY-MM-DDTHH:mm:ss.SSSZ');

    const endISO = moment.tz(`${end_date} ${end_time}`, 'YYYY-MM-DD HH:mm', TZ)
      .endOf('minute')
      .format('YYYY-MM-DDTHH:mm:ss.SSSZ');

    // ------------------------------------------------
    // 🔍 Fetch First/Last Docs
    // ------------------------------------------------
    const [docs] = await this.costModel.aggregate([
      { $match: { timestamp: { $gte: startISO, $lte: endISO } } },
      { $sort: { timestamp: 1 } },
      { $group: { _id: null, first: { $first: '$$ROOT' }, last: { $last: '$$ROOT' } } },
    ]);

    const firstDoc = docs?.first;
    const lastDoc = docs?.last;
    if (!firstDoc || !lastDoc)
      return { date: start_date, note: 'No data found for this range' };
    // 🧾 Console log: Unit 5 meter readings (first vs last)
// console.log("\n===== 🔍 UNIT 5 METERS — FIRST vs LAST READINGS =====");

// const suffixToUse = suffix; // e.g. Del_ActiveEnergy
// for (const process of Object.keys(processMappings)) {
//   const meters = processMappings[process]?.Unit_5;
//   if (!meters || !meters.length) continue;

//   console.log(`\n📘 Process: ${process}`);
//   for (const meterId of meters) {
//     const key = `${meterId}_${suffixToUse}`;
//     const firstVal = this.sanitizeValue(firstDoc[key]);
//     const lastVal = this.sanitizeValue(lastDoc[key]);
//     const diff = lastVal >= firstVal ? (lastVal - firstVal).toFixed(2) : 0;

//     console.log(
//       `   🔹 ${meterId}: first = ${firstVal.toFixed(2)} | last = ${lastVal.toFixed(2)} | Δ = ${diff}`
//     );
//   }
// }
// console.log("====================================================\n");
// // 🧾 Log Field Meter contributions that feed into UNIT-5 consumption
// console.log("\n===== ⚙️ UNIT-5 FIELD METER CONTRIBUTIONS TO CONSUMPTION =====");
// console.table([
//   { Source: "PDB08_Total (→ U14_GW02)",   Value: PDB08_Total },
//   { Source: "CardPDB1_sum (→ U17_GW02)",  Value: CardPDB1_sum },
//   { Source: "PDB07_sum (→ U18_GW02)",     Value: PDB07_sum },
//   { Source: "PDB10_sum (→ U10_GW03)",     Value: PDB10_sum },
// ]);
// console.log("=============================================================\n");

    // ------------------------------------------------
    // ⚙️ Calculate per-process consumption with PDB adjustments
    // ------------------------------------------------
    const processMaps: Record<string, Record<string, number>> = {};
    for (const processName of Object.keys(processMappings)) {
      processMaps[processName] = { Unit_4: 0, Unit_5: 0 };
    }

    const calculateConsumption = (
      process: string,
      unitKey: string,
      first: any,
      last: any,
      suffix: string,
    ) => {
      const meters = processMappings[process][unitKey] || [];
      for (const meterId of meters) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(first[meterKey]);
        const endVal = this.sanitizeValue(last[meterKey]);
        let consumption = endVal >= startVal ? this.sanitizeValue(endVal - startVal) : 0;

        if (unitKey === 'Unit_4' && meterId === 'U12_PLC') {
          consumption = Math.max(0, +(consumption - PDB07_U4).toFixed(2));
        }
        if (meterId === 'U5_GW01') {
          consumption = PDB1CD1_Total;
        }
        if (meterId === 'U9_GW01') {
          consumption = PDB2CD2_Total;
        }
        if (meterId === 'U15_GW01') {
          consumption = Math.max(0, +(consumption - PDB10_U4).toFixed(2));
        }
        if (meterId === 'U14_GW02') {
          consumption = PDB08_Total;
        }
        if (meterId === 'U17_GW02') {
          consumption = CardPDB1_sum;
        }
        if (meterId === 'U18_GW02') {
          consumption = PDB07_sum;
        }
        if (meterId === 'U10_GW03') {
          consumption = PDB10_sum;
        }

        processMaps[process][unitKey] += consumption;
      }
    };

    for (const unitKey of areaKeys) {
      for (const process of Object.keys(processMappings)) {
        calculateConsumption(process, unitKey, firstDoc, lastDoc, suffix);
      }
    }

    // ------------------------------------------------
    // 🧾 Build Result Summary object
    // ------------------------------------------------
    const result: SummaryByDept = {
      date: start_date,
      startTimestamp: firstDoc.timestamp,
      endTimestamp: lastDoc.timestamp,
    };

    const totalHours = Math.max(moment(endISO).diff(moment(startISO), 'hours'), 1);

    for (const areaKey of areaKeys) {
      for (const process of Object.keys(processMaps)) {
        const baseKey = `${areaKey.toLowerCase()}${process}`;
        const total = processMaps[process][areaKey];
        result[`${baseKey}_consumption`] = +total.toFixed(2);
        result[`${baseKey}_avgconsumption`] = +(total / totalHours).toFixed(2);
      }
    }

    // ------------------------------------------------
    // ✅ Daily LT1/LT2 + Incoming calculation
    // ------------------------------------------------
    const dailyConsumption: { date: string; [key: string]: number | string }[] = [];

    const LT1Mapping = { Unit_4: ['U19_PLC', 'U21_PLC'], Unit_5: ['U6_GW02', 'U13_GW02'] };
    const LT2Mapping = { Unit_4: ['U11_GW01', 'U13_GW01', 'U24_GW01', 'U28_PLC'], Unit_5: ['U16_GW03', 'U17_GW03'] };

    const start = moment(start_date);
    const end = moment(end_date);
    const sameDate = moment(start_date).isSame(end_date, 'day');
    const timeDiff = !moment(start_time, 'HH:mm').isSame(moment(end_time, 'HH:mm'));
    const isSingleDayRun = sameDate && timeDiff;

    for (let m = moment(start); m.isBefore(end) || isSingleDayRun; m.add(1, 'day')) {
      let dayStartISO: string;
      let dayEndISO: string;

      if (isSingleDayRun) {
        dayStartISO = moment.tz(`${start_date} ${start_time}`, 'YYYY-MM-DD HH:mm', TZ).format();
        dayEndISO = moment.tz(`${end_date} ${end_time}`, 'YYYY-MM-DD HH:mm', TZ).format();
      } else {
        dayStartISO = moment.tz(`${m.format('YYYY-MM-DD')} 06:00:00`, TZ).format();
        dayEndISO = moment(dayStartISO).add(24, 'hours').add(2, 'minutes').format();
      }

      const [dayDocs] = await this.costModel.aggregate([
        { $match: { timestamp: { $gte: dayStartISO, $lte: dayEndISO } } },
        { $sort: { timestamp: 1 } },
        { $group: { _id: null, first: { $first: '$$ROOT' }, last: { $last: '$$ROOT' } } },
      ]);

      const firstDayDoc = dayDocs?.first;
      const lastDayDoc = dayDocs?.last;
      if (!firstDayDoc || !lastDayDoc) continue;

      const dayRecord: any = { date: m.format('YYYY-MM-DD') };
      const selectedUnits = area === 'ALL' ? ['Unit_4', 'Unit_5'] : [area];

      for (const unit of selectedUnits) {
        let lt1Total = 0;
        let lt2Total = 0;

        // LT1 SUM
        for (const id of LT1Mapping[unit] || []) {
          const key = `${id}_${suffix}`;
          const diff = this.sanitizeValue(lastDayDoc[key] - firstDayDoc[key]);
          lt1Total += diff > 0 ? diff : 0;
        }

        // LT2 SUM
        for (const id of LT2Mapping[unit] || []) {
          const key = `${id}_${suffix}`;
          const diff = this.sanitizeValue(lastDayDoc[key] - firstDayDoc[key]);
          lt2Total += diff > 0 ? diff : 0;
        }

        // store total incoming from grid into LT panels
        dayRecord[`${unit}_Total_I/C G`] = +(lt1Total + lt2Total).toFixed(2);

        // build "Incoming + Other Unit transfers" field
        if (unit === 'Unit_4') {
          const lt2Incoming = PDB12CD12_sum;
          const totalIncoming = lt2Incoming;
          dayRecord['Unit_4_Total_I/C OU'] = +totalIncoming.toFixed(2);
        }

        if (unit === 'Unit_5') {
          const lt1Incoming = PDB07_U4 + U4_LT2_sum;
          const lt2Incoming = PDB10_U4;
          const totalIncoming = lt1Incoming + lt2Incoming;
          dayRecord['Unit_5_I/C OU'] = +totalIncoming.toFixed(2);
        }
      }

      dailyConsumption.push(dayRecord);
      if (isSingleDayRun) break;
    }

    // ------------------------------------------------
    // 🧾 Department Summary by process
    // ------------------------------------------------
    const departmentInfo = {
      "Blow Room": { u4mcs: 2, u5mcs: 2, u4Lpd: 151, u5Lpd: 144.5 },
      "Card +Breaker": { u4mcs: 16, u5mcs: 14, u4Lpd: 292, u5Lpd: 306.6 },
      "Comber + Lap former": { u4mcs: 12, u5mcs: 17, u4Lpd: 84, u5Lpd: 318.2 },
      "Drawing Finsher+Breaker": { u4mcs: 10, u5mcs: 8, u4Lpd: 94, u5Lpd: 77.6 },
      "Drawing Simplex": { u4mcs: 6, u5mcs: 8, u4Lpd: 108, u5Lpd: 209.3 },
      "R.Transport System": { u4mcs: 1, u5mcs: 1, u4Lpd: 30, u5Lpd: 30 },
      "Ring Dept": { u4mcs: 24, u5mcs: 18, u4Lpd: 1920, u5Lpd: 2554 },
      "Winding": { u4mcs: 9, u5mcs: 18, u4Lpd: 377, u5Lpd: 471.1 },
      "B/Card + Comber Filter": { u4mcs: 3, u5mcs: 3, u4Lpd: 203, u5Lpd: 274 },
      "Back Process A/C": { u4mcs: 2, u5mcs: 2, u4Lpd: 142, u5Lpd: 239.1 },
      "Ring A/C": { u4mcs: 1, u5mcs: 1, u4Lpd: 333, u5Lpd: 476 },
      "Winding A/C": { u4mcs: 1, u5mcs: 1, u4Lpd: 98, u5Lpd: 100.5 },
      "Air Compressor": { u4mcs: 3, u5mcs: 3, u4Lpd: 119, u5Lpd: 303 },
      "Deep Well Turbine": { u4mcs: 1, u5mcs: 1, u4Lpd: 22, u5Lpd: 22 },
      "Bailing Press ": { u4mcs: 1, u5mcs: 1, u4Lpd: 15, u5Lpd: 15 },
      "Mills Lighting ": { u4mcs: 1, u5mcs: 1, u4Lpd: 60, u5Lpd: 30 },
      "Residential Colony": { u4mcs: 1, u5mcs: 1, u4Lpd: 60, u5Lpd: 0 },
      "Conditioning Machine ": { u4mcs: 1, u5mcs: 1, u4Lpd: 72, u5Lpd: 72 },
      "Lab + Offices": { u4mcs: 2, u5mcs: 0, u4Lpd: 8, u5Lpd: 0 },
      "HFO Plant Aux(2nd Source)": { u4mcs: 0, u5mcs: 0, u4Lpd: 0, u5Lpd: 0 },
      "Gas Plant Aux(2nd Source)": { u4mcs: 0, u5mcs: 0, u4Lpd: 0, u5Lpd: 0 },
      "Water Chiller": { u4mcs: 0, u5mcs: 0, u4Lpd: 0, u5Lpd: 0 },
      "HFO + JMS Auxiliary": { u4mcs: 1, u5mcs: 0, u4Lpd: 250, u5Lpd: 0 },
      "Spare/PF panels": { u4mcs: 0, u5mcs: 0, u4Lpd: 0, u5Lpd: 0 },
    };

    const deptProcessKeyMap: Record<string, string> = {
      "Blow Room": "BlowRoom",
      "Card +Breaker": "Card_Breaker",
      "Comber + Lap former": "Comberandunilap",
      "Drawing Finsher+Breaker": "DrawingFinisherand2Breaker",
      "Drawing Simplex": "DrawingSimplex",
      "R.Transport System": "RTransportSystem",
      "Ring Dept": "Ring",
      "Winding": "AutoCone_Winding10to18",
      "B/Card + Comber Filter": "B_CardandComberFilter",
      "Back Process A/C": "AC_BackProcess",
      "Ring A/C": "AC_Ring",
      "Winding A/C": "AC_AutoCone_Winding",
      "Air Compressor": "AirCompressor",
      "Deep Well Turbine": "Deep_Well_Turbine",
      "Bailing Press ": "BailingPress",
      "Mills Lighting ": "Mills_Lighting",
      "Residential Colony": "Residentialcolony",
      "Conditioning Machine ": "Conditioning_Machine",
      "Lab + Offices": "Lab_and_Offices",
      "HFO Plant Aux(2nd Source)": "HFO Plant Aux(2nd Source)",
      "Gas Plant Aux(2nd Source)": "Gas Plant Aux(2nd Source)",
      "Water Chiller": "Water Chiller",
      "HFO + JMS Auxiliary": "HFO + JMS Auxiliary",
      "Spare/PF panels": "Spare",
    };

    const summaryByDept = Object.entries(departmentInfo).map(([name, info]) => {
      
      const processKey = deptProcessKeyMap[name];
      if (!processKey) return { name, note: 'No mapping found' };

      const u4Consumption = Number(result[`unit_4${processKey}_consumption`] || 0);
      const u5Consumption = Number(result[`unit_5${processKey}_consumption`] || 0);
      const u4AvgConsumption = Number(result[`unit_4${processKey}_avgconsumption`] || 0);
      const u5AvgConsumption = Number(result[`unit_5${processKey}_avgconsumption`] || 0);

      const u4ConectedLoadPerMcs = info.u4mcs ? +(info.u4Lpd / info.u4mcs).toFixed(2) : 0;
      const u5ConectedLoadPerMcs = info.u5mcs ? +(info.u5Lpd / info.u5mcs).toFixed(2) : 0;

      const u4RunnigLoad =
        info.u4Lpd && typeof u4AvgConsumption === 'number'
          ? Number((u4AvgConsumption / (info.u4mcs || 1)).toFixed(2))
          : 0;

      const u5RunningLoad =
        info.u5Lpd && typeof u5AvgConsumption === 'number'
          ? Number((u5AvgConsumption / (info.u5mcs || 1)).toFixed(2))
          : 0;

      const dept: any = { name };

      if (area === 'ALL' || area === 'Unit_4') {
        dept.u4Mcs = info.u4mcs;
        dept.u4ConectedLoadPerDept = info.u4Lpd;
        dept.u4ConectedLoadPerMcs = u4ConectedLoadPerMcs;
        dept.u4RunnigLoad = u4RunnigLoad;
        dept.u4AvgConsumption = u4AvgConsumption;
        dept.u4Consumption = u4Consumption;
      }

      if (area === 'ALL' || area === 'Unit_5') {
        dept.u5Mcs = info.u5mcs;
        dept.u5ConectedLoadPerDept = info.u5Lpd;
        dept.u5ConectedLoadPerMcs = u5ConectedLoadPerMcs;
        dept.u5RunningLoad = u5RunningLoad;
        dept.u5AvgConsumption = u5AvgConsumption;
        dept.u5Consumption = u5Consumption;

        if (name === 'Card +Breaker') {
          dept.u5Name = 'Card';
        } else if (name === 'Drawing Finsher+Breaker') {
          dept.u5Name = 'Drawing Finsher';
        } else if (name === 'Drawing Simplex') {
          dept.u5Name = 'Drawing simplex+Breaker';
        } else {
          dept.u5Name = name;
        }
      }

      dept.totalConsumption = Number((u4Consumption + u5Consumption).toFixed(2));
      if (area === 'ALL' || area === 'Unit_4') {
      const u4Utilization =
        info.u4Lpd && info.u4Lpd > 0
          ? +((u4AvgConsumption / info.u4Lpd) * 100).toFixed(2)
          : 0;
      dept.u4UtilizationPercent = u4Utilization;
    }

    if (area === 'ALL' || area === 'Unit_5') {
      const u5Utilization =
        info.u5Lpd && info.u5Lpd > 0
          ? +((u5AvgConsumption / info.u5Lpd) * 100).toFixed(2)
          : 0;
      dept.u5UtilizationPercent = u5Utilization;
    }

    

      return dept;
      
    });
    // 🧾 Console log — Final Unit-5 Department-wise Consumption + Meter IDs
// console.log("\n===== ⚙️ FINAL UNIT-5 DEPARTMENT-WISE CONSUMPTION (with METER IDs) =====");

// summaryByDept.forEach((dept: any) => {
//   const name = dept.name || "Unknown";
//   const processKey = Object.keys(processMappings).find(
//     key => key === deptProcessKeyMap[name]
//   );
//   const meterIds = processKey ? processMappings[processKey]?.Unit_5 || [] : [];
//   const consumption = dept.u5Consumption || 0;
//   const avg = dept.u5AvgConsumption || 0;

//   if (consumption > 0) {
//     console.log(
//       `🏭 ${name.padEnd(28)} | Consumption = ${consumption.toFixed(2)} kWh | Avg = ${avg.toFixed(2)} kWh/h`
//     );
//     console.log(`   ⚙️ Meters: ${meterIds.join(", ") || "—"}`);
//   }
// });

// const totalU5 = summaryByDept.reduce(
//   (sum, d: any) => sum + (d.u5Consumption || 0),
//   0
// );

// console.log("--------------------------------------------------------");
// console.log(`🔹 TOTAL Unit-5 Consumption = ${totalU5.toFixed(2)} kWh`);
// console.log("========================================================\n");

    // ------------------------------------------------
    // 🧾 Consumption Detail (LT1/LT2 breakdown)
    // ------------------------------------------------
   // ------------------------------------------------
// 🧾 Consumption Detail (LT1/LT2 breakdown) — fixed for 6AM→6AM daily windows
// ------------------------------------------------
// ------------------------------------------------
// 🧾 Consumption Detail (LT1/LT2 breakdown) — strict 6:00 AM → 6:00 AM
// ------------------------------------------------
const consumptionDetail: {
  date: string;
  Unit_4_LT1?: number;
  Unit_4_LT2?: number;
  Unit_4_Total?: number;
  Unit_5_LT1?: number;
  Unit_5_LT2?: number;
  Unit_5_Total?: number;
  Grand_Total?: number;
}[] = [];

const U4_LT1_Meters = [
  "U1_PLC","U3_PLC","U4_PLC","U5_PLC","U6_PLC","U8_PLC","U9_PLC",
  "U10_PLC","U11_PLC","U12_PLC","U13_PLC","U14_PLC","U15_PLC","U17_PLC","U18_PLC","U20_PLC","U22_GW02"
];
const U4_LT2_Meters = [
  "U1_GW01","U2_GW01","U3_GW01","U4_GW01","U5_GW01","U6_GW01","U7_GW01","U8_GW01","U9_GW01",
  "U10_GW01","U14_GW01","U15_GW01","U16_GW01","U17_GW01","U18_GW01","U19_GW01","U20_GW01","U21_GW01"
];
const U5_LT1_Meters = [
  "U5_GW02","U7_GW02","U8_GW02","U9_GW02","U10_GW02","U11_GW02","U12_GW02","U14_GW02","U15_GW02",
  "U16_GW02","U17_GW02","U18_GW02","U19_GW02","U20_GW02","U21_GW02","U23_GW02","U16_PLC","U2_PLC",
];
const U5_LT2_Meters = [
  "U1_GW03","U2_GW03","U3_GW03","U4_GW03","U5_GW03","U6_GW03","U7_GW03","U8_GW03","U9_GW03",
  "U10_GW03","U11_GW03","U12_GW03","U13_GW03","U14_GW03","U15_GW03","U18_GW03"
];

// 🔧 Adjust consumption corrections
const getAdjustedValue = (meterId: string, raw: number, unitKey: string): number => {
  let consumption = raw;
  if (unitKey === "Unit_4" && meterId === "U12_PLC")
    consumption = Math.max(0, +(consumption - PDB07_U4).toFixed(2));
  if (meterId === "U5_GW01") consumption = PDB1CD1_Total;
  if (meterId === "U9_GW01") consumption = PDB2CD2_Total;
  if (meterId === "U15_GW01")
    consumption = Math.max(0, +(consumption - PDB10_U4).toFixed(2));
  if (meterId === "U14_GW02") consumption = PDB08_Total;
  if (meterId === "U17_GW02") consumption = CardPDB1_sum;
  if (meterId === "U18_GW02") consumption = PDB07_sum;
  if (meterId === "U10_GW03") consumption = PDB10_sum;
  return this.sanitizeValue(consumption);
};
// ✅ Handle same-date custom time range (e.g., 07:00–15:00)
// const sameDate = moment(start_date).isSame(end_date, 'day');
const hasCustomTime =
  start_time && end_time && !(start_time === '06:00' && end_time === '06:00');

if (sameDate && hasCustomTime) {
  const customStartISO = moment.tz(`${start_date} ${start_time}`, 'YYYY-MM-DD HH:mm', TZ).format();
  const customEndISO = moment
  .tz(`${end_date} ${end_time}`, 'YYYY-MM-DD HH:mm', TZ)
  .add(15, 'minutes') // ✅ gives MongoDB a slightly bigger window
  .format();

  const [detailDocs] = await this.costModel.aggregate([
    { $match: { timestamp: { $gte: customStartISO, $lte: customEndISO } } },
    { $sort: { timestamp: 1 } },
    { $group: { _id: null, first: { $first: '$$ROOT' }, last: { $last: '$$ROOT' } } },
  ]);

  const firstDetailDoc = detailDocs?.first;
  const lastDetailDoc = detailDocs?.last;
  // 🧾 Debug log — check which timestamps DB returns
if (firstDetailDoc && lastDetailDoc) {
  // console.log("🔍 Custom Range Fetch:");
  // console.log("   Start Time (Input):", customStartISO);
  // console.log("   End Time (Input):", customEndISO);
  // console.log("   First Doc Timestamp:", firstDetailDoc.timestamp);
  // console.log("   Last Doc Timestamp:", lastDetailDoc.timestamp);
}

  if (firstDetailDoc && lastDetailDoc) {
    const record: any = { date: start_date };

    const calcSum = (meters: string[], unitKey: string) =>
      meters.reduce((sum, id) => {
        const key = `${id}_${suffix}`;
        const rawDiff = this.sanitizeValue(lastDetailDoc[key] - firstDetailDoc[key]);
        const adjusted = getAdjustedValue(id, rawDiff, unitKey);
        return sum + (adjusted > 0 ? adjusted : 0);
      }, 0);

    if (area === 'ALL' || area === 'Unit_4') {
      const Unit_4_LT1 = +calcSum(U4_LT1_Meters, 'Unit_4').toFixed(2);
      const Unit_4_LT2 = +calcSum(U4_LT2_Meters, 'Unit_4').toFixed(2);
      const Unit_4_Total = +(Unit_4_LT1 + Unit_4_LT2).toFixed(2);
      Object.assign(record, { Unit_4_LT1, Unit_4_LT2, Unit_4_Total });
    }

    if (area === 'ALL' || area === 'Unit_5') {
      const Unit_5_LT1 = +calcSum(U5_LT1_Meters, 'Unit_5').toFixed(2);
      const Unit_5_LT2 = +calcSum(U5_LT2_Meters, 'Unit_5').toFixed(2);
      const Unit_5_Total = +(Unit_5_LT1 + Unit_5_LT2).toFixed(2);
      Object.assign(record, { Unit_5_LT1, Unit_5_LT2, Unit_5_Total });
    }

    record.Grand_Total = +((record.Unit_4_Total || 0) + (record.Unit_5_Total || 0)).toFixed(2);
    consumptionDetail.push(record);
  }

  // 🛑 Skip 6AM→6AM loop and return early for same-day custom range
  // return {
  //   summarybydept: summaryByDept,
  //   dailyConsumption: finalDailyConsumption,
  //   utilization,
  //   consumptionDetail,
  // };
}


// ✅ Correct timezone interpretation — treat "06:00" as local time in Asia/Karachi
// ✅ Set timezone string explicitly
// const TZ = 'Asia/Karachi';

// ✅ Start at 6:00 local time, no UTC shift
let current = moment(`${start_date} 06:00:00`).tz(TZ);
const endLimit = moment(`${end_date} 06:00:00`).tz(TZ);

// Loop while next 6 AM window ≤ endLimit
while (current.clone().add(24, "hours").isSameOrBefore(endLimit)) {
 const dayStartISO = current.clone().format();
const dayEndISO = current.clone().add(24, "hours").add(15, "minutes").format();
// ⚡ fetch fresh field meter data for each daily window
  const fmCons = await this.meterService.getMeterWiseConsumption(
    current.format("YYYY-MM-DD"),
    current.clone().add(1, "day").format("YYYY-MM-DD"),
    { startTime: "06:00", endTime: "06:00" },
  );
  // 🔁 recalculate per-day field meter values
  const PDB07_U4 = +(Number(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB07_U5 = +(Number(fmCons?.U5_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB07_sum = Math.max(0, +(PDB07_U5 + PDB07_U4).toFixed(2));

  const PDB1CD1_U4 = +(Number(fmCons?.U4_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB1CD1_U5 = +(Number(fmCons?.U5_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB1CD1_Total = Math.max(0, +(PDB1CD1_U4 + PDB1CD1_U5).toFixed(2));

  const PDB2CD2_U4 = +(Number(fmCons?.U4_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB2CD2_U5 = +(Number(fmCons?.U5_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB2CD2_Total = Math.max(0, +(PDB2CD2_U4 + PDB2CD2_U5).toFixed(2));

  const PDB10_U4 = +(Number(fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB10_U5 = +(Number(fmCons?.U5_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB10_sum = Math.max(0, +(PDB10_U4 + PDB10_U5).toFixed(2));

  const PDB08_U4 = +(Number(fmCons?.U4_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB08_U5 = +(Number(fmCons?.U5_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB08_Total = Math.max(0, +(PDB08_U4 + PDB08_U5).toFixed(2));

  const CardPDB1_U4 = +(Number(fmCons?.U4_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const CardPDB1_U5 = +(Number(fmCons?.U5_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const CardPDB1_sum = Math.max(0, +(CardPDB1_U5 + CardPDB1_U4).toFixed(2));

  const U4_LT2_sum = Math.max(0, +(CardPDB1_U4 + PDB08_U4).toFixed(2));

  // 👇 dynamically updated getAdjustedValue using current-day values
  const getAdjustedValue = (meterId: string, raw: number, unitKey: string): number => {
    let consumption = raw;
    if (unitKey === "Unit_4" && meterId === "U12_PLC")
      consumption = Math.max(0, +(consumption - PDB07_U4).toFixed(2));
    if (meterId === "U5_GW01") consumption = PDB1CD1_Total;
    if (meterId === "U9_GW01") consumption = PDB2CD2_Total;
    if (meterId === "U15_GW01")
      consumption = Math.max(0, +(consumption - PDB10_U4).toFixed(2));
    if (meterId === "U14_GW02") consumption = PDB08_Total;
    if (meterId === "U17_GW02") consumption = CardPDB1_sum;
    if (meterId === "U18_GW02") consumption = PDB07_sum;
    if (meterId === "U10_GW03") consumption = PDB10_sum;
    return this.sanitizeValue(consumption);
  };
  // console.log(dayStartISO);
  // console.log(dayEndISO);

  const [detailDocs] = await this.costModel.aggregate([
    { $match: { timestamp: { $gte: dayStartISO, $lte: dayEndISO } } },
    { $sort: { timestamp: 1 } },
    { $group: { _id: null, first: { $first: "$$ROOT" }, last: { $last: "$$ROOT" } } },
  ]);

  const firstDetailDoc = detailDocs?.first;
  const lastDetailDoc = detailDocs?.last;
  if (!firstDetailDoc || !lastDetailDoc) {
    current.add(1, "day");
    continue;
  }
  // ✅ Console timestamps + sample values
// console.log("🕓 Window:", current.format("YYYY-MM-DD"));
// console.log("  Start ISO:", dayStartISO);
// console.log("  End ISO:", dayEndISO);
// console.log("  First Doc Time:", firstDetailDoc.timestamp);
// console.log("  Last Doc Time:", lastDetailDoc.timestamp);
// // example: print one or two key values to verify readings
// const testKey = `${U4_LT1_Meters[0]}_${suffix}`; // e.g. U1_PLC_Del_ActiveEnergy
// console.log(
//   `  ➜ First[${testKey}] =`, firstDetailDoc[testKey],
//   "| Last =", lastDetailDoc[testKey],
//   "| Δ =", (lastDetailDoc[testKey] - firstDetailDoc[testKey]).toFixed(2)
// );

  const record: any = { date: current.format("YYYY-MM-DD") };

  const calcSum = (meters: string[], unitKey: string) =>
    meters.reduce((sum, id) => {
      const key = `${id}_${suffix}`;
      const rawDiff = this.sanitizeValue(lastDetailDoc[key] - firstDetailDoc[key]);
      const adjusted = getAdjustedValue(id, rawDiff, unitKey);
      return sum + (adjusted > 0 ? adjusted : 0);
    }, 0);

  if (area === "ALL" || area === "Unit_4") {
    const Unit_4_LT1 = +calcSum(U4_LT1_Meters, "Unit_4").toFixed(2);
    const Unit_4_LT2 = +calcSum(U4_LT2_Meters, "Unit_4").toFixed(2);
    const Unit_4_Total = +(Unit_4_LT1 + Unit_4_LT2).toFixed(2);
    Object.assign(record, { Unit_4_LT1, Unit_4_LT2, Unit_4_Total });
  }

  if (area === "ALL" || area === "Unit_5") {
    const Unit_5_LT1 = +calcSum(U5_LT1_Meters, "Unit_5").toFixed(2);
    const Unit_5_LT2 = +calcSum(U5_LT2_Meters, "Unit_5").toFixed(2);
    const Unit_5_Total = +(Unit_5_LT1 + Unit_5_LT2).toFixed(2);
    Object.assign(record, { Unit_5_LT1, Unit_5_LT2, Unit_5_Total });
  }

  record.Grand_Total = +((record.Unit_4_Total || 0) + (record.Unit_5_Total || 0)).toFixed(2);
  consumptionDetail.push(record);

  current.add(1, "day"); // next 6 AM window
}

//  else {
//       consumptionDetail.push({ date: start_date });
//     }

    // ------------------------------------------------
    // 🔢 Aggregate total consumption per unit from summaryByDept
   // 🏷 Aggregate all-day dailyConsumption like summaryByDept
// ------------------------------------------------

// 🧮 Field Meter Totals per unit
const ToU5LT2_sum = +(Number(fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
// 🧮 Include U16_PLC and U2_PLC in Unit_4 transferred-to-OU calculation
const U16_PLC = this.sanitizeValue(lastDoc?.U16_PLC_Del_ActiveEnergy - firstDoc?.U16_PLC_Del_ActiveEnergy);
const U2_PLC = this.sanitizeValue(lastDoc?.U2_PLC_Del_ActiveEnergy - firstDoc?.U2_PLC_Del_ActiveEnergy);
const U22_GW02 = this.sanitizeValue(lastDoc?.U22_GW02_Del_ActiveEnergy - firstDoc?.U22_GW02_Del_ActiveEnergy);
const Unit_4_Field_Total = +(PDB07_U4 + PDB08_U4 + CardPDB1_U4 + ToU5LT2_sum + U16_PLC + U2_PLC).toFixed(2);
const Unit_5_Field_Total = +(PDB1CD1_U5 + PDB2CD2_U5+U22_GW02 ).toFixed(2);
const Unit_4_Total_Tranferred_to_OU = +(Unit_4_Field_Total).toFixed(2);
const Unit_5_Total_Tranferred_to_OU = +(Unit_5_Field_Total).toFixed(2);

// ------------------------------------------------
// 🔢 Aggregate department totals for Total_Consumption
// ------------------------------------------------
let Unit_4_Total_Consumption = 0;
let Unit_5_Total_Consumption = 0;
for (const dept of summaryByDept) {
  Unit_4_Total_Consumption += Number((dept as any).u4Consumption || 0);
  Unit_5_Total_Consumption += Number((dept as any).u5Consumption || 0);
}
Unit_4_Total_Consumption = +Unit_4_Total_Consumption.toFixed(2);
Unit_5_Total_Consumption = +Unit_5_Total_Consumption.toFixed(2);
// console.log(Unit_5_Total_Consumption);

// ------------------------------------------------
// 🧮 Aggregate Total_I_C_G and I_C_OU from all dailyConsumption rows
// ------------------------------------------------
let Unit_4_Total_I_C_G = 0, Unit_4_I_C_OU = 0;
let Unit_5_Total_I_C_G = 0, Unit_5_I_C_OU = 0;

for (const record of dailyConsumption) {
  Unit_4_Total_I_C_G += Number(record['Unit_4_Total_I/C G'] || 0);
  Unit_4_I_C_OU += Number(record['Unit_4_Total_I/C OU'] || 0);
  Unit_5_Total_I_C_G += Number(record['Unit_5_Total_I/C G'] || 0);
  Unit_5_I_C_OU += Number(record['Unit_5_I/C OU'] || 0);
}
Unit_5_I_C_OU += U16_PLC + U2_PLC;
Unit_4_I_C_OU += U22_GW02;
Unit_4_Total_I_C_G = +Unit_4_Total_I_C_G.toFixed(2);
Unit_5_Total_I_C_G = +Unit_5_Total_I_C_G.toFixed(2);
Unit_4_I_C_OU = +Unit_4_I_C_OU.toFixed(2);
Unit_5_I_C_OU = +Unit_5_I_C_OU.toFixed(2);

// ------------------------------------------------
// 🧮 Compute Unaccounted Energy for each Unit
// ------------------------------------------------
const Unit_4_Unaccounted_Energy = +(
  (Unit_4_Total_I_C_G + Unit_4_I_C_OU) -
  (Unit_4_Total_Consumption + Unit_4_Total_Tranferred_to_OU)
).toFixed(2);

const Unit_5_Unaccounted_Energy = +(
  (Unit_5_Total_I_C_G + Unit_5_I_C_OU) -
  (Unit_5_Total_Consumption + Unit_5_Total_Tranferred_to_OU)
).toFixed(2);

// ------------------------------------------------
// 🧾 Final Aggregated Daily Summary (like summaryByDept)
// ------------------------------------------------
const finalDailyConsumption: any[] = [];

if (area === 'ALL' || area === 'Unit_4') {
  finalDailyConsumption.push({
    Unit: 4,
    Total_I_C_G: Unit_4_Total_I_C_G,
    I_C_OU: Unit_4_I_C_OU,
    Total_Consumption: Unit_4_Total_Consumption,
    Total_Tranferred_to_OU: Unit_4_Total_Tranferred_to_OU,
    Unaccounted_Energy: Unit_4_Unaccounted_Energy,
  });
}

if (area === 'ALL' || area === 'Unit_5') {
  finalDailyConsumption.push({
    Unit: 5,
    Total_I_C_G: Unit_5_Total_I_C_G,
    I_C_OU: Unit_5_I_C_OU,
    Total_Consumption: Unit_5_Total_Consumption,
    Total_Tranferred_to_OU: Unit_5_Total_Tranferred_to_OU,
    Unaccounted_Energy: Unit_5_Unaccounted_Energy,
  });
}
// ------------------------------------------------
// 🧾 Console log: Department-wise individual meter consumptions
// ------------------------------------------------
// console.log("\n===== Department-wise Individual Meter Consumption =====");

// for (const [deptName, unitsMap] of Object.entries(processMappings)) {
//   console.log(`\n📍 Department: ${deptName}`);
//   for (const unitKey of ['Unit_4', 'Unit_5']) {
//     const meters = unitsMap[unitKey];
//     if (!meters) continue;

//     console.log(`  ${unitKey}:`);
//     for (const meterId of meters) {
//       const key = `${meterId}_${suffix}`;
//       const startVal = this.sanitizeValue(firstDoc[key]);
//       const endVal = this.sanitizeValue(lastDoc[key]);
//       let diff = endVal >= startVal ? this.sanitizeValue(endVal - startVal) : 0;

//       // Apply same adjustments as used in your logic
//       if (unitKey === "Unit_4" && meterId === "U12_PLC")
//         diff = Math.max(0, +(diff - PDB07_U4).toFixed(2));
//       if (meterId === "U5_GW01") diff = PDB1CD1_Total;
//       if (meterId === "U9_GW01") diff = PDB2CD2_Total;
//       if (meterId === "U15_GW01") diff = Math.max(0, +(diff - PDB10_U4).toFixed(2));
//       if (meterId === "U14_GW02") diff = PDB08_Total;
//       if (meterId === "U17_GW02") diff = CardPDB1_sum;
//       if (meterId === "U18_GW02") diff = PDB07_sum;
//       if (meterId === "U10_GW03") diff = PDB10_sum;

//       console.log(`     🔹 ${meterId}: ${diff.toFixed(2)} kWh`);
//     }
//   }
// }
    // ------------------------------------------------
    // ✅ Final Return
    // ------------------------------------------------
    // ------------------------------------------------
// 🧾 Utilization Summary (Unit 4 & Unit 5)
// ------------------------------------------------
const utilization: any[] = [];

let totalConnectedLoad_U4 = 0;
let totalAvgConsumption_U4 = 0;
let totalConnectedLoad_U5 = 0;
let totalAvgConsumption_U5 = 0;

for (const dept of summaryByDept) {
  totalConnectedLoad_U4 += Number(dept.u4ConectedLoadPerDept || 0);
  totalAvgConsumption_U4 += Number(dept.u4AvgConsumption || 0);
  totalConnectedLoad_U5 += Number(dept.u5ConectedLoadPerDept || 0);
  totalAvgConsumption_U5 += Number(dept.u5AvgConsumption || 0);
}

// 🧮 Add area-wise logic
if (area === 'ALL' || area === 'Unit_4') {
  utilization.push({
    Unit: 4,
    TotalConnectedLoadPerDept: +totalConnectedLoad_U4.toFixed(2),
    TotalAvgConsumption: +totalAvgConsumption_U4.toFixed(2),
    UtilizationPercent: totalConnectedLoad_U4
      ? +((totalAvgConsumption_U4 / totalConnectedLoad_U4) * 100).toFixed(2)
      : 0,
  });
}

if (area === 'ALL' || area === 'Unit_5') {
  utilization.push({
    Unit: 5,
    TotalConnectedLoadPerDept: +totalConnectedLoad_U5.toFixed(2),
    TotalAvgConsumption: +totalAvgConsumption_U5.toFixed(2),
    UtilizationPercent: totalConnectedLoad_U5
      ? +((totalAvgConsumption_U5 / totalConnectedLoad_U5) * 100).toFixed(2)
      : 0,
  });
}
// ------------------------------------------------
// ⚡ HT Side (Total Incoming from Grid)
// ------------------------------------------------
// ⚡ HT Side (Total Incoming from Grid) — common for entire plant
const HTMeters: Record<string, string> = {
  "U23_GW01": "WAPDA 1",
  "U27_PLC": "WAPDA 2",
  "U22_PLC": "HFO",
  "U26_PLC": "JMS 620",
  "U6_GW02": "Solar 1185 Kw",
  "U17_GW03": "Solar 1070 Kw",
  "U24_GW01": "Solar 352.50kW", 
  "U28_PLC": "Solar 52.17 kw",
};
const dieselMeters = ["U19_PLC", "U11_GW01"];

let totalHTIncoming = 0;
const HTside: Record<string, number> = {};

for (const [id, name] of Object.entries(HTMeters)) {
  const key = `${id}_${suffix}`;
  const firstVal = this.sanitizeValue(firstDoc[key]);
  const lastVal = this.sanitizeValue(lastDoc[key]);
  const diff = lastVal >= firstVal ? +(lastVal - firstVal).toFixed(2) : 0;
  HTside[name] = diff;
  totalHTIncoming += diff;
}
// ⚙️ Diesel Genset calculation
let dieselSum = 0;
for (const id of dieselMeters) {
  const key = `${id}_${suffix}`;
  const firstVal = this.sanitizeValue(firstDoc[key]);
  const lastVal = this.sanitizeValue(lastDoc[key]);
  const diff = lastVal >= firstVal ? +(lastVal - firstVal).toFixed(2) : 0;
  dieselSum += diff;
}
HTside["Diesel and Gas Genset"] = +dieselSum.toFixed(2);
totalHTIncoming += dieselSum;

HTside["Total"] = +totalHTIncoming.toFixed(2);
// ------------------------------------------------
// ⚡ LOSSES SUMMARY (Transformer + HT + Unaccounted)
// ------------------------------------------------

// ------------------------------------------------
// ⚡ LOSSES SUMMARY (Unit-wise Transformer + HT + Unaccounted)
// ------------------------------------------------

 // Transformer and HT losses (unchanged)
    const Trafo1Incoming = this.sanitizeValue((lastDoc?.U23_GW01_Del_ActiveEnergy ?? 0) - (firstDoc?.U23_GW01_Del_ActiveEnergy ?? 0));
    const Trafo2Incoming = this.sanitizeValue((lastDoc?.U22_GW01_Del_ActiveEnergy ?? 0) - (firstDoc?.U22_GW01_Del_ActiveEnergy ?? 0));
    const trafo12 = Trafo1Incoming + Trafo2Incoming;

    const Trafo3Incoming = this.sanitizeValue((lastDoc?.U20_GW03_Del_ActiveEnergy ?? 0) - (firstDoc?.U20_GW03_Del_ActiveEnergy ?? 0));
    const Trafo4Incoming = this.sanitizeValue((lastDoc?.U19_GW03_Del_ActiveEnergy ?? 0) - (firstDoc?.U19_GW03_Del_ActiveEnergy ?? 0));
    const trafo34 = Trafo3Incoming + Trafo4Incoming;

    const Trafo1Outgoing = this.sanitizeValue((lastDoc?.U21_PLC_Del_ActiveEnergy ?? 0) - (firstDoc?.U21_PLC_Del_ActiveEnergy ?? 0));
    const Trafo2Outgoing = this.sanitizeValue((lastDoc?.U13_GW01_Del_ActiveEnergy ?? 0) - (firstDoc?.U13_GW01_Del_ActiveEnergy ?? 0));
    const trafo12out = Trafo1Outgoing + Trafo2Outgoing;

    const Trafo3Outgoing = this.sanitizeValue((lastDoc?.U13_GW02_Del_ActiveEnergy ?? 0) - (firstDoc?.U13_GW02_Del_ActiveEnergy ?? 0));
    const Trafo4Outgoing = this.sanitizeValue((lastDoc?.U16_GW03_Del_ActiveEnergy ?? 0) - (firstDoc?.U16_GW03_Del_ActiveEnergy ?? 0));
    const trafo34out = Trafo3Outgoing + Trafo4Outgoing;

    const unit4losses = trafo12 - trafo12out;
    const unit5losses = trafo34 - trafo34out;

    const Wapda = this.sanitizeValue((lastDoc?.U27_PLC_Del_ActiveEnergy ?? 0) - (firstDoc?.U27_PLC_Del_ActiveEnergy ?? 0));
    const Niigata = this.sanitizeValue((lastDoc?.U22_PLC_Del_ActiveEnergy ?? 0) - (firstDoc?.U22_PLC_Del_ActiveEnergy ?? 0));
    const JMS = this.sanitizeValue((lastDoc?.U26_PLC_Del_ActiveEnergy ?? 0) - (firstDoc?.U26_PLC_Del_ActiveEnergy ?? 0));
    const PH_IC = this.sanitizeValue((lastDoc?.U22_GW01_Del_ActiveEnergy ?? 0) - (firstDoc?.U22_GW01_Del_ActiveEnergy ?? 0));
    const mainincomingunit5 = this.sanitizeValue((lastDoc?.U21_GW03_Del_ActiveEnergy ?? 0) - (firstDoc?.U21_GW03_Del_ActiveEnergy ?? 0));
    const hfoaux = this.sanitizeValue((lastDoc?.U25_PLC_Del_ActiveEnergy ?? 0) - (firstDoc?.U25_PLC_Del_ActiveEnergy ?? 0));
    // console.log(Wapda,"wapda2");
    // console.log(Niigata,"hfo1");
    // console.log(JMS,"igg");
    // console.log(PH_IC,"phic");
    // console.log(mainincomingunit5,"main");
    // console.log(hfoaux,"hfoaux");

    const HT_Transmission_Losses1 = Math.max(0, (Wapda + Niigata + JMS) - (mainincomingunit5 + PH_IC));
    const HT_Transmission_Losses = HT_Transmission_Losses1 - hfoaux;


// --- Total Losses ---

// 🧾 Build losses summary object
const lossesSummary = {
      HT_Transmission_Losses: this.round2(HT_Transmission_Losses),
      Unit_4_TrafoLosses: this.round2(unit4losses),
      Unit_5_TrafoLosses: this.round2(unit5losses),
      Total_Losses: this.round2(unit4losses + unit5losses + HT_Transmission_Losses),
    };
// 🏭 PRODUCTION SUMMARY (from EnergySpindleService)
const productionSummaryDaily: any[] = [];
const productionSummary: any[] = [];

let totalProd_U4 = 0;
let totalAvgCount_U4 = 0;
let totalProd_U5 = 0;
let totalAvgCount_U5 = 0;
let daysCount = 0;

try {
  const TZ = 'Asia/Karachi';
  const isSingleLogicalDay =
    start_time === '06:00' &&
    end_time === '06:00' &&
    moment(end_date).diff(moment(start_date), 'days') === 1;

  if (isSingleLogicalDay) {
    const unit4Production = await this.energySpindleService.getProductionByDate({
      start_date,
      end_date: start_date,
      unit: 'U4',
    });

    const unit5Production = await this.energySpindleService.getProductionByDate({
      start_date,
      end_date: start_date,
      unit: 'U5',
    });

    totalProd_U4 = +(unit4Production?.[0]?.totalProduction || 0);
    totalAvgCount_U4 = +(unit4Production?.[0]?.avgcount || 0);
    totalProd_U5 = +(unit5Production?.[0]?.totalProduction || 0);
    totalAvgCount_U5 = +(unit5Production?.[0]?.avgcount || 0);

    productionSummaryDaily.push({
      date: start_date,
      Unit_4_Production: totalProd_U4,
      Unit_5_Production: totalProd_U5,
      Unit_4_AvgCount: totalAvgCount_U4,
      Unit_5_AvgCount: totalAvgCount_U5,
    });
  } else {
    const start = moment(start_date);
    const end = moment(end_date);

    for (let m = start.clone(); m.isSameOrBefore(end, 'day'); m.add(1, 'day')) {
      const dayStr = m.format('YYYY-MM-DD');

      const unit4Production = await this.energySpindleService.getProductionByDate({
        start_date: dayStr,
        end_date: dayStr,
        unit: 'U4',
      });

      const unit5Production = await this.energySpindleService.getProductionByDate({
        start_date: dayStr,
        end_date: dayStr,
        unit: 'U5',
      });

      const u4Prod = +(unit4Production?.[0]?.totalProduction || 0);
      const u5Prod = +(unit5Production?.[0]?.totalProduction || 0);
      const u4Avg = +(unit4Production?.[0]?.avgcount || 0);
      const u5Avg = +(unit5Production?.[0]?.avgcount || 0);

      if (u4Prod > 0 || u5Prod > 0) {
        productionSummaryDaily.push({
          date: dayStr,
          Unit_4_Production: u4Prod,
          Unit_5_Production: u5Prod,
          Unit_4_AvgCount: u4Avg,
          Unit_5_AvgCount: u5Avg,
        });
      }

      totalProd_U4 += u4Prod;
      totalAvgCount_U4 += u4Avg;
      totalProd_U5 += u5Prod;
      totalAvgCount_U5 += u5Avg;
      daysCount++;
    }

    totalAvgCount_U4 = daysCount > 0 ? +(totalAvgCount_U4).toFixed(2) : 0;
    totalAvgCount_U5 = daysCount > 0 ? +(totalAvgCount_U5).toFixed(2) : 0;
  }

  // ✅ Calculate specific consumption for totals
  const consumptionperbag_U4 =
    totalProd_U4 > 0 ? +(Unit_4_Total_Consumption / totalProd_U4).toFixed(4) : 0;
  const consumptionperbag_U5 =
    totalProd_U5 > 0 ? +(Unit_5_Total_Consumption / totalProd_U5).toFixed(4) : 0;

  // ✅ Merge daily consumption with production
  for (const prod of productionSummaryDaily) {
    const match = consumptionDetail.find((c) => c.date === prod.date);

    if (match) {
      prod.Unit_4_Consumption = +(match.Unit_4_Total || 0).toFixed(2);
      prod.Unit_5_Consumption = +(match.Unit_5_Total || 0).toFixed(2);
    } else {
      prod.Unit_4_Consumption = 0;
      prod.Unit_5_Consumption = 0;
    }

    // ✅ Calculate per-day specific consumption
    prod.Unit_4_consumptionperbag =
      prod.Unit_4_Production > 0
        ? +(prod.Unit_4_Consumption / prod.Unit_4_Production).toFixed(4)
        : 0;

    prod.Unit_5_consumptionperbag =
      prod.Unit_5_Production > 0
        ? +(prod.Unit_5_Consumption / prod.Unit_5_Production).toFixed(4)
        : 0;
  }

  // 🧮 Push total summary
  if (area === 'ALL' || area === 'Unit_4') {
    productionSummary.push({
      Unit: 4,
      TotalProduction: +totalProd_U4.toFixed(2),
      TotalAvgCount: +totalAvgCount_U4.toFixed(2),
      TotalConsumption: +Unit_4_Total_Consumption.toFixed(2),
      consumptionperbag: consumptionperbag_U4,
    });
  }

  if (area === 'ALL' || area === 'Unit_5') {
    productionSummary.push({
      Unit: 5,
      TotalProduction: +totalProd_U5.toFixed(2),
      TotalAvgCount: +totalAvgCount_U5.toFixed(2),
      TotalConsumption: +Unit_5_Total_Consumption.toFixed(2),
      consumptionperbag: consumptionperbag_U5,
    });
  }

} catch (error) {
  console.error('⚠️ Error fetching production summary:', error.message);

  if (area === 'ALL' || area === 'Unit_4') {
    const spec_U4 =
      totalProd_U4 > 0 ? +(Unit_4_Total_Consumption / totalProd_U4).toFixed(4) : 0;
    productionSummary.push({
      Unit: 4,
      TotalProduction: 0,
      TotalAvgCount: 0,
      TotalConsumption: +Unit_4_Total_Consumption.toFixed(2),
      consumptionperbag: spec_U4,
    });
  }

  if (area === 'ALL' || area === 'Unit_5') {
    const spec_U5 =
      totalProd_U5 > 0 ? +(Unit_5_Total_Consumption / totalProd_U5).toFixed(4) : 0;
    productionSummary.push({
      Unit: 5,
      TotalProduction: 0,
      TotalAvgCount: 0,
      TotalConsumption: +Unit_5_Total_Consumption.toFixed(2),
      consumptionperbag: spec_U5,
    });
  }
}

// ------------------------------------------------
// ✅ Apply Custom Formula for HFO + JMS Auxiliary (Safe placement)
// ------------------------------------------------
// ------------------------------------------------
// ✅ Apply Custom Formula for HFO + JMS Auxiliary (Unit-4 & Unit-5)
// ------------------------------------------------
try {
  const hfoAuxDept = summaryByDept.find(
    (d: any) => d.name === "HFO + JMS Auxiliary"
  );

  if (hfoAuxDept) {
    const u25Key = "U25_PLC_Del_ActiveEnergy";

    // 🔹 Actual total consumption (U25 meter)
    const u25Consumption = this.sanitizeValue(
      (lastDoc?.[u25Key] ?? 0) - (firstDoc?.[u25Key] ?? 0)
    );

    // 🔹 Ratio = energy transferred from Unit-4 to OU / total incoming of Unit-4
    const ratio =
      Unit_4_Total_Tranferred_to_OU > 0
        ? +(Unit_4_Total_Tranferred_to_OU / Unit_4_Total_I_C_G).toFixed(4)
        : 0;

    // 🔹 Calculate custom Unit-5 consumption (share)
    const unit5Calculated = +(ratio * u25Consumption).toFixed(2);

    // 🔹 Calculate custom Unit-4 consumption (remaining share)
    const unit4Calculated = +(u25Consumption - unit5Calculated).toFixed(2);

    // 🚫 Reset any old values to avoid double counting
    hfoAuxDept.u4Consumption = 0;
    hfoAuxDept.u5Consumption = 0;

    // 🧾 Update Unit-5 values
    hfoAuxDept.u5Consumption = unit5Calculated;
    hfoAuxDept.u5AvgConsumption = +(
      unit5Calculated / (totalHours || 1)
    ).toFixed(2);

    // 🧾 Update Unit-4 values
    hfoAuxDept.u4Consumption = unit4Calculated;
    hfoAuxDept.u4AvgConsumption = +(
      unit4Calculated / (totalHours || 1)
    ).toFixed(2);

    // 🧾 Total for this department = both units
    hfoAuxDept.totalConsumption = +(unit4Calculated + unit5Calculated).toFixed(2);

    // ⚙️ Utilization recalculations
    const u4ConnectedLoad = hfoAuxDept.u4ConectedLoadPerDept || 0;
    const u5ConnectedLoad = hfoAuxDept.u5ConectedLoadPerDept || 0;

    hfoAuxDept.u4UtilizationPercent =
      u4ConnectedLoad > 0
        ? +((hfoAuxDept.u4AvgConsumption / u4ConnectedLoad) * 100).toFixed(2)
        : 0;

    hfoAuxDept.u5UtilizationPercent =
      u5ConnectedLoad > 0
        ? +((hfoAuxDept.u5AvgConsumption / u5ConnectedLoad) * 100).toFixed(2)
        : 0;

    // 🧾 Debug
    // console.log("🔍 HFO AUX CALC:", {
    //   U25_PLC_start: firstDoc?.U25_PLC_Del_ActiveEnergy,
    //   U25_PLC_end: lastDoc?.U25_PLC_Del_ActiveEnergy,
    //   u25Consumption,
    //   ratio,
    //   unit5Calculated,
    //   unit4Calculated,
    //   Unit_4_Total_I_C_G,
    //   Unit_4_Total_Tranferred_to_OU,
    // });
  }
} catch (err) {
  // console.error("⚠️ Error applying HFO Aux formula:", err.message);
}
// ------------------------------------------------
// ✅ Recalculate Unit totals after HFO AUX adjustment
// ------------------------------------------------
let New_Unit_4_Total_Consumption = 0;
let New_Unit_5_Total_Consumption = 0;

for (const dept of summaryByDept) {
  New_Unit_4_Total_Consumption += Number(dept.u4Consumption || 0);
  New_Unit_5_Total_Consumption += Number(dept.u5Consumption || 0);
}

New_Unit_4_Total_Consumption = +New_Unit_4_Total_Consumption.toFixed(2);
New_Unit_5_Total_Consumption = +New_Unit_5_Total_Consumption.toFixed(2);

// ✅ Update finalDailyConsumption array
// for (const row of finalDailyConsumption) {
//   if (row.Unit === 4) row.Total_Consumption = New_Unit_4_Total_Consumption;
//   if (row.Unit === 5) row.Total_Consumption = New_Unit_5_Total_Consumption;
// }

// ✅ Update productionSummary totals & specific consumption
// for (const row of productionSummary) {
//   if (row.Unit === 4) {
//     row.TotalConsumption = New_Unit_4_Total_Consumption;
//     row.consumptionperbag =
//       row.TotalProduction && row.TotalProduction > 0
//         ? +(New_Unit_4_Total_Consumption / row.TotalProduction).toFixed(4)
//         : 0;
//   }
//   if (row.Unit === 5) {
//     row.TotalConsumption = New_Unit_5_Total_Consumption;
//     row.consumptionperbag =
//       row.TotalProduction && row.TotalProduction > 0
//         ? +(New_Unit_5_Total_Consumption / row.TotalProduction).toFixed(4)
//         : 0;
//   }
// }

// console.log("✅ Recalculated Totals after HFO AUX split:", {
//   New_Unit_4_Total_Consumption,
//   New_Unit_5_Total_Consumption,
// });






    return {
      summarybydept: summaryByDept,
      dailyConsumption: finalDailyConsumption,
      utilization,
      consumptionDetail,
      HTside, // 👈 add this line
      lossesSummary,   // 👈 ADD HERE
      productionSummary,
       productionSummaryDaily, // 👈 Add this line
    };
  }
}
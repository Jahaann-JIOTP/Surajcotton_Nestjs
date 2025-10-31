import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { Energyconsumptionreport } from './schemas/energy-usage_report.schema';
import { DailyProduction } from './schemas/daily-production.schema';
import { FieldMeterProcess } from './schemas/field-meter-process.schema';
import { MeterService } from 'src/meter/meter.service';
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
  ) { }

  private sanitizeValue(value: number): number {
    if (!isFinite(value) || isNaN(value)) return 0;
    const minThreshold = 1e-6;
    const maxThreshold = 1e12;
    if (Math.abs(value) < minThreshold || Math.abs(value) > maxThreshold) return 0;
    return value;
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
      "Power_House 2nd Source Gas": { Unit_4: ['U5_PLC'] },
      "Power_House 2nd Source HFO": { Unit_4: ['U7_GW01'] },//remove u11 to u7
      "Water Chiller": { Unit_5: ['U16_GW02'] },
      "HFO + JMS Auxiliary": { Unit_4: ['U25_PLC'] },
      Spare: { Unit_4: ['U6_GW01', 'U21_GW01'], Unit_5: ['U7_GW03', 'U8_GW03'] },
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
      "Card +Breaker": { u4mcs: 15, u5mcs: 14, u4Lpd: 292, u5Lpd: 306.6 },
      "Comber + Lap former": { u4mcs: 12, u5mcs: 17, u4Lpd: 84, u5Lpd: 318.2 },
      "Drawing Finsher+Breaker": { u4mcs: 8, u5mcs: 8, u4Lpd: 94, u5Lpd: 77.6 },
      "Drawing Simplex": { u4mcs: 6, u5mcs: 8, u4Lpd: 108, u5Lpd: 209.3 },
      "R.Transport System": { u4mcs: 1, u5mcs: 1, u4Lpd: 30, u5Lpd: 30 },
      "Ring Dept": { u4mcs: 24, u5mcs: 18, u4Lpd: 1920, u5Lpd: 2554 },
      "Winding": { u4mcs: 9, u5mcs: 18, u4Lpd: 377, u5Lpd: 471.1 },
      "B/Card + Comber Filter": { u4mcs: 3, u5mcs: 3, u4Lpd: 203, u5Lpd: 274 },
      "Back Process A/C": { u4mcs: 1, u5mcs: 1, u4Lpd: 142, u5Lpd: 239.1 },
      "Ring A/C": { u4mcs: 1, u5mcs: 1, u4Lpd: 333, u5Lpd: 476 },
      "Winding A/C": { u4mcs: 1, u5mcs: 1, u4Lpd: 98, u5Lpd: 100.5 },
      "Air Compressor": { u4mcs: 1, u5mcs: 1, u4Lpd: 119, u5Lpd: 303 },
      "Deep Well Turbine": { u4mcs: 1, u5mcs: 1, u4Lpd: 22, u5Lpd: 22 },
      "Bailing Press ": { u4mcs: 1, u5mcs: 1, u4Lpd: 15, u5Lpd: 15 },
      "Mills Lighting ": { u4mcs: 1, u5mcs: 1, u4Lpd: 60, u5Lpd: 30 },
      "Residential Colony": { u4mcs: 1, u5mcs: 1, u4Lpd: 60, u5Lpd: 0 },
      "Conditioning Machine ": { u4mcs: 1, u5mcs: 1, u4Lpd: 72, u5Lpd: 72 },
      "Lab + Offices": { u4mcs: 2, u5mcs: 0, u4Lpd: 8, u5Lpd: 0 },
      "Power_House 2nd Source Gas": { u4mcs: 0, u5mcs: 0, u4Lpd: 0, u5Lpd: 0 },
      "Power_House 2nd Source HFO": { u4mcs: 0, u5mcs: 0, u4Lpd: 0, u5Lpd: 0 },
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
      "Power_House 2nd Source Gas": "Power_House 2nd Source Gas",
      "Power_House 2nd Source HFO": "Power_House 2nd Source HFO",
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

      return dept;
    });

    // ------------------------------------------------
    // 🧾 Consumption Detail (LT1/LT2 breakdown)
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
      "U1_PLC", "U3_PLC", "U4_PLC", "U5_PLC", "U6_PLC", "U8_PLC", "U9_PLC",
      "U10_PLC", "U11_PLC", "U12_PLC", "U13_PLC", "U14_PLC", "U15_PLC", "U17_PLC", "U18_PLC",
      "U20_PLC",
    ];

    const U4_LT2_Meters = [
      "U1_GW01", "U2_GW01", "U3_GW01", "U4_GW01", "U5_GW01", "U6_GW01", "U7_GW01", "U8_GW01", "U9_GW01",
      "U10_GW01", "U14_GW01", "U15_GW01", "U16_GW01", "U17_GW01", "U18_GW01",
      "U19_GW01", "U20_GW01", "U21_GW01",
    ];

    const U5_LT1_Meters = [
      "U5_GW02", "U7_GW02", "U8_GW02", "U9_GW02",
      "U10_GW02", "U11_GW02", "U12_GW02", "U14_GW02", "U15_GW02", "U16_GW02", "U17_GW02", "U18_GW02",
      "U19_GW02", "U20_GW02", "U21_GW02", "U22_GW02", "U23_GW02", "U16_PLC", "U2_PLC"
    ];

    const U5_LT2_Meters = [
      "U1_GW03", "U2_GW03", "U3_GW03", "U4_GW03", "U5_GW03", "U6_GW03", "U7_GW03", "U8_GW03", "U9_GW03",
      "U10_GW03", "U11_GW03", "U12_GW03", "U13_GW03", "U14_GW03", "U15_GW03", "U18_GW03",
    ];

    const [detailDocs] = await this.costModel.aggregate([
      { $match: { timestamp: { $gte: startISO, $lte: endISO } } },
      { $sort: { timestamp: 1 } },
      { $group: { _id: null, first: { $first: "$$ROOT" }, last: { $last: "$$ROOT" } } },
    ]);

    const firstDetailDoc = detailDocs?.first;
    const lastDetailDoc = detailDocs?.last;

    if (firstDetailDoc && lastDetailDoc) {

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

      const calcSum = (meters: string[], unitKey: string) =>
        meters.reduce((sum, id) => {
          const key = `${id}_${suffix}`;
          const rawDiff = this.sanitizeValue(lastDetailDoc[key] - firstDetailDoc[key]);
          const adjusted = getAdjustedValue(id, rawDiff, unitKey);
          return sum + (adjusted > 0 ? adjusted : 0);
        }, 0);

      const record: any = { date: start_date };

      if (area === "ALL" || area === "Unit_4") {
        const Unit_4_LT1 = +calcSum(U4_LT1_Meters, "Unit_4").toFixed(2);
        const Unit_4_LT2 = +calcSum(U4_LT2_Meters, "Unit_4").toFixed(2);
        const Unit_4_Total = +(Unit_4_LT1 + Unit_4_LT2).toFixed(2);

        record.Unit_4_LT1 = Unit_4_LT1;
        record.Unit_4_LT2 = Unit_4_LT2;
        record.Unit_4_Total = Unit_4_Total;
      }

      if (area === "ALL" || area === "Unit_5") {
        const Unit_5_LT1 = +calcSum(U5_LT1_Meters, "Unit_5").toFixed(2);
        const Unit_5_LT2 = +calcSum(U5_LT2_Meters, "Unit_5").toFixed(2);
        const Unit_5_Total = +(Unit_5_LT1 + Unit_5_LT2).toFixed(2);

        record.Unit_5_LT1 = Unit_5_LT1;
        record.Unit_5_LT2 = Unit_5_LT2;
        record.Unit_5_Total = Unit_5_Total;
      }

      record.Grand_Total = +((record.Unit_4_Total || 0) + (record.Unit_5_Total || 0)).toFixed(2);
      consumptionDetail.push(record);
    } else {
      consumptionDetail.push({ date: start_date });
    }

    // ------------------------------------------------
    // 🔢 Aggregate total consumption per unit from summaryByDept
    // ------------------------------------------------
    let Unit_4_Total_Consumption = 0;
    let Unit_5_Total_Consumption = 0;

    for (const dept of summaryByDept) {
      Unit_4_Total_Consumption += Number((dept as any).u4Consumption || 0);
      Unit_5_Total_Consumption += Number((dept as any).u5Consumption || 0);
    }

    Unit_4_Total_Consumption = +Unit_4_Total_Consumption.toFixed(2);
    Unit_5_Total_Consumption = +Unit_5_Total_Consumption.toFixed(2);

    // ------------------------------------------------
    // 🧮 Field Meter Totals per unit
    // ------------------------------------------------
    const ToU5LT2_sum = +(Number(fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));

    const Unit_4_Field_Total = +(
      PDB07_U4 + PDB08_U4 + CardPDB1_U4 + ToU5LT2_sum
    ).toFixed(2);

    const Unit_5_Field_Total = +(PDB1CD1_U5 + PDB2CD2_U5).toFixed(2);

    // ------------------------------------------------
    // 🧾 Combine Dept Consumption + Field Totals
    // ------------------------------------------------
    const Unit_4_Total_Tranferred_to_OU = +(
     Unit_4_Field_Total
    ).toFixed(2);

    const Unit_5_Total_Tranferred_to_OU = +(
      Unit_5_Field_Total
    ).toFixed(2);

     // ------------------------------------------------
    // 🏷 Enrich last dailyConsumption entry (unaccounted energy etc.)
    // and then reshape to final frontend format:
    // [
    //   { date, Unit: 4, Total_I_C_G, I_C_OU, Total_Consumption, Total_Tranferred_to_OU, Unaccounted_Energy },
    //   { date, Unit: 5, ... }
    // ]
    // ------------------------------------------------
    let finalDailyConsumption: any[] = [];

    if (dailyConsumption.length > 0) {
      const lastRecord = dailyConsumption[dailyConsumption.length - 1];

      // ---------- UNIT 4 CALCULATIONS ----------
      if (area === 'ALL' || area === 'Unit_4') {
        (lastRecord as any).Unit_4_Total_Consumption = Unit_4_Total_Consumption;
        (lastRecord as any).Unit_4_Total_Tranferred_to_OU = Unit_4_Total_Tranferred_to_OU;

        const u4_icg = Number((lastRecord as any)['Unit_4_Total_I/C G'] || 0);
        const u4_icu = Number((lastRecord as any)['Unit_4_Total_I/C OU'] || 0);
        const u4_totalCons = Number((lastRecord as any)['Unit_4_Total_Consumption'] || 0);
        const u4_transferred = Number((lastRecord as any)['Unit_4_Total_Tranferred_to_OU'] || 0);

        (lastRecord as any).Unit_4_Unaccounted_Energy = +(
          (u4_icg + u4_icu) - (u4_totalCons + u4_transferred)
        ).toFixed(2);
      }

      // ---------- UNIT 5 CALCULATIONS ----------
      if (area === 'ALL' || area === 'Unit_5') {
        (lastRecord as any).Unit_5_Total_Consumption = Unit_5_Total_Consumption;
        (lastRecord as any).Unit_5_Total_Tranferred_to_OU = Unit_5_Total_Tranferred_to_OU;

        const u5_icg = Number((lastRecord as any)['Unit_5_Total_I/C G'] || 0);
        const u5_icu = Number((lastRecord as any)['Unit_5_I/C OU'] || 0);
        const u5_totalCons = Number((lastRecord as any)['Unit_5_Total_Consumption'] || 0);
        const u5_transferred = Number((lastRecord as any)['Unit_5_Total_Tranferred_to_OU'] || 0);

        (lastRecord as any).Unit_5_Unaccounted_Energy = +(
          (u5_icg + u5_icu) - (u5_totalCons + u5_transferred)
        ).toFixed(2);
      }

      // ---------- BUILD FINAL OUTPUT ROWS ----------
      // We'll push one object per unit into finalDailyConsumption.

      if (area === 'ALL' || area === 'Unit_4') {
        const unit4Row = {
          // date: (lastRecord as any).date,
          Unit: 4,
          Total_I_C_G: Number((lastRecord as any)['Unit_4_Total_I/C G'] || 0),
          I_C_OU: Number((lastRecord as any)['Unit_4_Total_I/C OU'] || 0),
          Total_Consumption: Number((lastRecord as any)['Unit_4_Total_Consumption'] || 0),
          Total_Tranferred_to_OU: Number((lastRecord as any)['Unit_4_Total_Tranferred_to_OU'] || 0),
          Unaccounted_Energy: Number((lastRecord as any)['Unit_4_Unaccounted_Energy'] || 0),
        };

        finalDailyConsumption.push(unit4Row);
      }

      if (area === 'ALL' || area === 'Unit_5') {
        const unit5Row = {
          // date: (lastRecord as any).date,
          Unit: 5,
          Total_I_C_G: Number((lastRecord as any)['Unit_5_Total_I/C G'] || 0),
          I_C_OU: Number((lastRecord as any)['Unit_5_I/C OU'] || 0),
          Total_Consumption: Number((lastRecord as any)['Unit_5_Total_Consumption'] || 0),
          Total_Tranferred_to_OU: Number((lastRecord as any)['Unit_5_Total_Tranferred_to_OU'] || 0),
          Unaccounted_Energy: Number((lastRecord as any)['Unit_5_Unaccounted_Energy'] || 0),
        };

        finalDailyConsumption.push(unit5Row);
      }

    } else {
      finalDailyConsumption = [];
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
    return {
      summarybydept: summaryByDept,
      dailyConsumption: finalDailyConsumption,
      consumptionDetail,
    };
  }
}
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
    private readonly meterService: MeterService, // ✅ Added for PDB07 data
  ) {}

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
    // ⚡ Fetch PDB07_U4 consumption (for Ring 21–24 adjustment)
    // ------------------------------------------------
    const fmCons = await this.meterService.getMeterWiseConsumption(
      start_date,
      end_date,
      { startTime: start_time, endTime: end_time },
    );
    const PDB07_U4 = +(Number(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    // ---------------- PDB CD1 Total (U4 + U5)
    const PDB1CD1_U5 = +(Number(fmCons?.U5_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB1CD1_U4 = +(Number(fmCons?.U4_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB1CD1_Total = Math.max(0, +(PDB1CD1_U4 + PDB1CD1_U5).toFixed(2));


     // ---------------- PDB2 CD2 Total = U4 + U5
    const PDB2CD2_U4 = +(Number(fmCons?.U4_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB2CD2_U5 = +(Number(fmCons?.U5_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB2CD2_Total = Math.max(0, +(PDB2CD2_U4 + PDB2CD2_U5).toFixed(2));

     // --- U4_PDB10 (for Ring 5–8 subtraction)
    const PDB10_U4 = +(Number(fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));

    // --- 🆕 PDB08 (U4 + U5)
    const PDB08_U4 = +(Number(fmCons?.U4_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB08_U5 = +(Number(fmCons?.U5_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB08_Total = Math.max(0, +(PDB08_U4 + PDB08_U5).toFixed(2));

    const CardPDB1_U5 = +(Number(fmCons?.U5_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const CardPDB1_U4 = +(Number(fmCons?.U4_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
    const CardPDB1_sum = Math.max(0, +(CardPDB1_U5 + CardPDB1_U4).toFixed(2));

    // const PDB07_U4 = +(Number(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB07_U5 = +(Number(fmCons?.U5_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB07_sum = Math.max(0, +(PDB07_U5 + PDB07_U4).toFixed(2));

    //  const PDB10_U4 = +(Number(fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB10_U5 = +(Number(fmCons?.U5_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
    const PDB10_sum = Math.max(0, +(PDB10_U4 + PDB10_U5).toFixed(2));

    console.log('📊 PDB07_U4:', PDB07_U4);
    console.log(`📊 PDB CD1 Total = ${PDB1CD1_U4} + ${PDB1CD1_U5} = ${PDB1CD1_Total}`);
    console.log(`📊 PDB CD2 Total = ${PDB2CD2_U4} + ${PDB2CD2_U5} = ${PDB2CD2_Total}`);
     console.log(`📊 U4_PDB10 Consumption = ${PDB10_U4}`);
     console.log(`📊 🆕 PDB08 Total (U4 + U5) = ${PDB08_U4} + ${PDB08_U5} = ${PDB08_Total}`);

     console.log(`📊 🆕 PDB08 Total (U4 + U5) = ${CardPDB1_U5} + ${CardPDB1_U4} = ${CardPDB1_sum}`);
      console.log(`📊 🆕 PDB07_sum  (U4 + U5) = ${PDB07_U4} + ${PDB07_U5} = ${PDB07_sum}`);

      console.log(`📊 🆕 PDB10_sum  (U4 + U5) = ${PDB10_U4} + ${PDB10_U5} = ${PDB10_sum}`);
     

    // ------------------------------------------------
    // 🧱 Process Mappings
    // ------------------------------------------------
    const processMappings: Record<string, Record<string, string[]>> = {
      Card_Breaker: { Unit_4: ['U5_GW01', 'U9_GW01'] },
      BlowRoom: { Unit_4: ['U8_GW01'], Unit_5: ['U9_GW02'] },
      Card: { Unit_5: ['U19_GW02', 'U17_GW02'] },
      Comberandunilap: { Unit_4: ['U13_PLC'], Unit_5: ['U14_GW02', 'U6_GW03'] },
      DrawingFinisherand2Breaker: { Unit_4: ['U8_PLC'] },
      DrawingFinisher1to8Breaker: { Unit_5: ['U23_GW02'] },
      DrawingSimplex: { Unit_4: ['U15_PLC'] },
      DrawingSimplex_Breaker: { Unit_5: ['U21_GW02'] },
      RTransportSystem: { Unit_4: ['U1_PLC'], Unit_5: ['U4_GW03'] },
      Ring: {
        Unit_4: [
          'U10_PLC', 'U11_PLC', 'U12_PLC', 'U15_GW01', 'U17_GW01', 'U16_GW01',
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
      Workshop: { Unit_4: ['U4_GW01'] },
      Lab_and_Offices: { Unit_4: ['U19_GW01'] },
      "Power_House 2nd Source Gas": { Unit_4: ['U5_PLC'] },
      "Power_House 2nd Source HFO": { Unit_4: ['U11_GW01'] },
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
      return [{ date: start_date, note: 'No data found for this range' }];

    // ------------------------------------------------
    // ⚙️ Calculate Consumption (with U12_PLC adjustment)
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

        // ✅ Adjust Ring 21–24 (U12_PLC) consumption in Unit 4
        if (unitKey === 'Unit_4' && meterId === 'U12_PLC') {
          const adjusted = Math.max(0, +(consumption - PDB07_U4).toFixed(2));
          console.log(`Adjusted Ring21–24 (U12_PLC): ${consumption} - ${PDB07_U4} = ${adjusted}`);
          consumption = adjusted;
        }
        // ✅ Replace U5_GW01 with combined PDB CD1 Total (U4 + U5)
        if (meterId === 'U5_GW01') {
          console.log(`Replaced U5_GW01 with PDB CD1 Total: ${PDB1CD1_Total}`);
          consumption = PDB1CD1_Total;
        }
         // ✅ Replace U9_GW01 → PDB2 CD2 (U4+U5)
        if (meterId === 'U9_GW01') {
          console.log(`Replaced U9_GW01 with PDB2 CD2 Total: ${PDB2CD2_Total}`);
          consumption = PDB2CD2_Total;
        }
         if (meterId === 'U15_GW01') {
          const adjusted = Math.max(0, +(consumption - PDB10_U4).toFixed(2));
          console.log(`Adjusted U15_GW01: ${consumption}-${PDB10_U4}=${adjusted}`);
          consumption = adjusted;
        }
        if (meterId === 'U14_GW02') {
          console.log(`Replaced U14_GW02 with PDB08 Total: ${PDB08_Total}`);
          consumption = PDB08_Total;
        }

         if (meterId === 'U17_GW02') {
      console.log(`Replaced U17_GW02 with PDB01 (CD1) Total: ${CardPDB1_sum}`);
      consumption = CardPDB1_sum;
    }
    if (meterId === 'U18_GW02') {
      console.log(`Replaced U18_GW02 with PDB07_sum: ${PDB07_sum}`);
      consumption = PDB07_sum;
    }
     if (meterId === 'U10_GW03') {
      console.log(`Replaced U10_GW03 with PDB10_sum: ${PDB10_sum}`);
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
    // 🧾 Build Result Summary
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
    // ✅ Daily LT1/LT2 Logic (unchanged)
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

        for (const id of LT1Mapping[unit] || []) {
          const key = `${id}_${suffix}`;
          const diff = this.sanitizeValue(lastDayDoc[key] - firstDayDoc[key]);
          lt1Total += diff > 0 ? diff : 0;
        }

        for (const id of LT2Mapping[unit] || []) {
          const key = `${id}_${suffix}`;
          const diff = this.sanitizeValue(lastDayDoc[key] - firstDayDoc[key]);
          lt2Total += diff > 0 ? diff : 0;
        }

        dayRecord[`${unit}_LT1`] = +lt1Total.toFixed(2);
        dayRecord[`${unit}_LT2`] = +lt2Total.toFixed(2);
        dayRecord[`${unit}_Total`] = +(lt1Total + lt2Total).toFixed(2);
      }

      dayRecord['Grand_Total'] = +(
        (dayRecord['Unit_4_Total'] || 0) + (dayRecord['Unit_5_Total'] || 0)
      ).toFixed(2);

      dailyConsumption.push(dayRecord);
      if (isSingleDayRun) break;
    }

    // ------------------------------------------------
    // 🧾 Department Summary (unchanged)
    // ------------------------------------------------
    const departmentInfo = {
      "Blow Room": { u4mcs: 2, u5mcs: 2, u4Lpd: 151, u5Lpd: 144.5 },
      "Card +Breaker": { u4mcs: 15, u5mcs: 0, u4Lpd: 292, u5Lpd: 0 },
      "Card": { u4mcs: 0, u5mcs: 14, u4Lpd: 0, u5Lpd: 306.6 },
      "Comber + Lap former": { u4mcs: 12, u5mcs: 17, u4Lpd: 84, u5Lpd: 318.2 },
      "Drawing Finsher+Breaker": { u4mcs: 8, u5mcs: 0, u4Lpd: 94, u5Lpd: 0 },
      "Drawing Finsher": { u4mcs: 0, u5mcs: 8, u4Lpd: 0, u5Lpd: 77.6 },
      "Drawing Simplex ": { u4mcs: 6, u5mcs: 0, u4Lpd: 108, u5Lpd: 0 },
      "Drawing simplex+Breaker": { u4mcs: 0, u5mcs: 8, u4Lpd: 0, u5Lpd: 209.3 },
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
      "Card": "Card",
      "Comber + Lap former": "Comberandunilap",
      "Drawing Finsher+Breaker": "DrawingFinisherand2Breaker",
      "Drawing Finsher": "DrawingFinisher1to8Breaker",
      "Drawing Simplex ": "DrawingSimplex",
      "Drawing simplex+Breaker": "DrawingSimplex_Breaker",
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

      const u4Consumption = result[`unit_4${processKey}_consumption`] || 0;
      const u5Consumption = result[`unit_5${processKey}_consumption`] || 0;
      const u4AvgConsumption = result[`unit_4${processKey}_avgconsumption`] || 0;
      const u5AvgConsumption = result[`unit_5${processKey}_avgconsumption`] || 0;

      const u4ConectedLoadPerMcs = info.u4mcs ? +(info.u4Lpd / info.u4mcs).toFixed(2) : 0;
      const u5ConectedLoadPerMcs = info.u5mcs ? +(info.u5Lpd / info.u5mcs).toFixed(2) : 0;

      const u4RunnigLoad =
        info.u4Lpd && typeof u4AvgConsumption === 'number'
          ? Number((u4AvgConsumption / info.u4mcs).toFixed(2))
          : 0;

      const u5RunningLoad =
        info.u5Lpd && typeof u5AvgConsumption === 'number'
          ? Number((u5AvgConsumption / info.u5mcs).toFixed(2))
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
      }

      return dept;
    });

    // ------------------------------------------------
    // ✅ Final Return
    // ------------------------------------------------
    return {
      summarybydept: summaryByDept,
      dailyConsumption,
    };
  }
}

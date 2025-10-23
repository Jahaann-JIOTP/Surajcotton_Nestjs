import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { Energyconsumptionreport } from './schemas/energy-usage_report.schema';
import { DailyProduction } from './schemas/daily-production.schema';
import { FieldMeterProcess } from './schemas/field-meter-process.schema';
import * as moment from 'moment-timezone';

// -------------------------------
// Type Definitions
// -------------------------------
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
  ) {}

  // ✅ Sanitize to prevent NaN, Infinity, or extreme values
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

    // -------------------------------
    // 🧱 Unified process mapping
    // -------------------------------
    const processMappings: Record<string, Record<string, string[]>> = {
      Card_Breaker: { Unit_4: ['U5_GW01', 'U9_GW01'] },
      BlowRoom: { Unit_4: ['U8_GW01'], Unit_5: ['U12_GW02', 'U9_GW02'] },
      Carding: { Unit_5: ['U19_GW02', 'U17_GW02'] },
      Comberandunilap: { Unit_4: ['U13_PLC'], Unit_5: ['U14_GW02', 'U6_GW03'] },
      DrawingFinisherand2Breaker: { Unit_4: ['U8_PLC'] },
      DrawingFinisher1to8Breaker: { Unit_5: ['U23_GW02'] },
      DrawingSimplex: { Unit_4: ['U15_PLC'] },
      DrawingSimplex_Breaker: { Unit_5: ['U21_GW02'] },
      RTransportSystem: { Unit_4: ['U1_PLC'], Unit_5: ['U4_GW03'] },
      Ring: {
        Unit_4: [
          'U10_PLC', 'U11_PLC', 'U12_PLC', 'U15_GW01', 'U17_GW01', 'U16_GW01', 'U22_GW02',
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
      Mills_Lighting: { Unit_4: ['U4_PLC', 'U3_PLC'], Unit_5: ['U14_GW03', 'U2_PLC'] },
      Residentialcolony: { Unit_4: ['U18_GW01'], Unit_5: ['U3_GW03'] },
      Conditioning_Machine: { Unit_4: ['U2_GW01'], Unit_5: ['U2_GW03'] },
      Workshop: { Unit_4: ['U4_GW01'] },
      Lab_and_Offices: { Unit_4: ['U19_GW01'] },
      Power_House2ndSourceGas: { Unit_4: ['U5_PLC'] },
      Power_House2ndSourceHFO: { Unit_4: ['U11_GW01'] },
      WaterChiller: { Unit_5: ['U16_GW02'] },
      Spare: { Unit_4: ['U6_GW01', 'U21_GW01'], Unit_5: ['U7_GW03', 'U8_GW03'] },
    };

    // -------------------------------
    // 🕓 Build Full Date Range (6AM → 6AM)
    // -------------------------------
    const startISO = moment.tz(`${start_date} ${start_time}`, 'YYYY-MM-DD HH:mm', TZ)
      .startOf('minute')
      .format('YYYY-MM-DDTHH:mm:ss.SSSZ');

    const endISO = moment.tz(`${end_date} ${end_time}`, 'YYYY-MM-DD HH:mm', TZ)
      .endOf('minute')
      .format('YYYY-MM-DDTHH:mm:ss.SSSZ');

    // -------------------------------
    // 🔍 Get First and Last Doc for Entire Range
    // -------------------------------
    const [docs] = await this.costModel.aggregate([
      { $match: { timestamp: { $gte: startISO, $lte: endISO } } },
      { $sort: { timestamp: 1 } },
      { $group: { _id: null, first: { $first: '$$ROOT' }, last: { $last: '$$ROOT' } } },
    ]);

    const firstDoc = docs?.first;
    const lastDoc = docs?.last;
    if (!firstDoc || !lastDoc)
      return [{ date: start_date, note: 'No data found for this range' }];

    // -------------------------------
    // ⚙️ Calculate Process Consumption
    // -------------------------------
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
        // ✅ Prevent negative differences due to meter reset
        const consumption = endVal >= startVal
          ? this.sanitizeValue(endVal - startVal)
          : 0;
        processMaps[process][unitKey] += consumption;
      }
    };

    for (const unitKey of areaKeys) {
      for (const process of Object.keys(processMappings)) {
        calculateConsumption(process, unitKey, firstDoc, lastDoc, suffix);
      }
    }

    // -------------------------------
    // 🧾 Build Summary Result
    // -------------------------------
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

    // -------------------------------
    // ✅ Daily LT1/LT2 Logic
    // -------------------------------
    const dailyConsumption: { date: string; [key: string]: number | string }[] = [];

    const LT1Mapping = {
      Unit_4: [
        'U1_PLC', 'U2_PLC', 'U3_PLC', 'U4_PLC', 'U5_PLC', 'U6_PLC', 'U7_PLC',
        'U8_PLC', 'U9_PLC', 'U10_PLC', 'U11_PLC', 'U12_PLC', 'U13_PLC', 'U14_PLC',
        'U15_PLC', 'U16_PLC', 'U17_PLC', 'U18_PLC', 'U20_PLC',
      ],
      Unit_5: [
        'U7_GW02', 'U8_GW02', 'U9_GW02', 'U10_GW02', 'U11_GW02', 'U12_GW02',
        'U14_GW02', 'U15_GW02', 'U16_GW02', 'U17_GW02', 'U18_GW02', 'U19_GW02',
        'U20_GW02', 'U21_GW02', 'U22_GW02', 'U23_GW02',
      ],
    };

    const LT2Mapping = {
      Unit_4: [
        'U1_GW01', 'U2_GW01', 'U3_GW01', 'U4_GW01', 'U5_GW01', 'U6_GW01', 'U7_GW01',
        'U8_GW01', 'U9_GW01', 'U10_GW01', 'U14_GW01', 'U15_GW01', 'U16_GW01',
        'U17_GW01', 'U18_GW01', 'U19_GW01', 'U20_GW01', 'U21_GW01',
      ],
      Unit_5: [
        'U1_GW03', 'U2_GW03', 'U3_GW03', 'U4_GW03', 'U5_GW03', 'U6_GW03', 'U7_GW03',
        'U8_GW03', 'U9_GW03', 'U10_GW03', 'U11_GW03', 'U12_GW03', 'U13_GW03',
        'U14_GW03', 'U15_GW03', 'U18_GW03',
      ],
    };

    const start = moment(start_date);
    const end = moment(end_date);

    for (let m = moment(start); m.isSameOrBefore(end); m.add(1, 'day')) {
      const dayStartISO = moment.tz(`${m.format('YYYY-MM-DD')} 06:00:00`, TZ)
        .format('YYYY-MM-DDTHH:mm:ss.SSSZ');
      const dayEndISO = moment(dayStartISO)
        .add(1, 'day')
        .endOf('minute')
        .format('YYYY-MM-DDTHH:mm:ss.SSSZ');

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
              // ✅ Grand Total (after both units processed)
        dayRecord['Grand_Total'] = +(
          (dayRecord['Unit_4_Total'] || 0) + (dayRecord['Unit_5_Total'] || 0)
        ).toFixed(2);


      dailyConsumption.push(dayRecord);
    }

    // -------------------------------
    // ✅ Final Return
    // -------------------------------
    return {
      summarybydept: [result],
      dailyConsumption,
    };
  }
}

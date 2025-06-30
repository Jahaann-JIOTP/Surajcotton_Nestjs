import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { Energyusagereport } from './schemas/energy-usage_report.schema';
import { DailyProduction } from './schemas/daily-production.schema';
import * as moment from 'moment-timezone';

@Injectable()
export class EnergyUsageReportService {
  constructor(
    @InjectModel(Energyusagereport.name, 'surajcotton') private costModel: Model<Energyusagereport>,
    @InjectModel(DailyProduction.name, 'surajcotton') private dailyModel: Model<DailyProduction>,
  ) {}

  // 🔹 Mapping function for area to meterIds
  private getMeterIdsForArea(area: string): string[] {
    const areaMapping: Record<string, string[]> = {
      Unit_4: [
        'U1_PLC', 'U2_PLC', 'U3_PLC', 'U4_PLC', 'U5_PLC', 'U6_PLC', 'U7_PLC', 'U8_PLC',
        'U9_PLC', 'U10_PLC', 'U11_PLC', 'U12_PLC', 'U13_PLC', 'U14_PLC', 'U15_PLC', 'U16_PLC',
        'U17_PLC', 'U18_PLC', 'U19_PLC', 'U20_PLC', 'U21_PLC', 'U1_GW01', 'U2_GW01', 'U3_GW01',
        'U4_GW01', 'U5_GW01', 'U6_GW01', 'U7_GW01', 'U8_GW01', 'U9_GW01', 'U10_GW01',
        'U11_GW01', 'U12_GW01', 'U13_GW01', 'U14_GW01', 'U15_GW01', 'U16_GW01', 'U17_GW01',
        'U18_GW01', 'U19_GW01', 'U20_GW01', 'U21_GW01', 'U22_GW01', 'U23_GW01'],
      Unit_5: [
        'U1_GW02', 'U2_GW02', 'U3_GW02', 'U4_GW02', 'U5_GW02', 'U6_GW02', 'U7_GW02',
        'U8_GW02', 'U9_GW02', 'U10_GW02', 'U11_GW02', 'U12_GW02', 'U13_GW02', 'U14_GW02',
        'U15_GW02', 'U16_GW02', 'U17_GW02', 'U18_GW02', 'U19_GW02', 'U20_GW02', 'U21_GW02',
        'U22_GW02', 'U23_GW02', 'U1_GW03', 'U2_GW03', 'U3_GW03', 'U4_GW03', 'U5_GW03', 'U6_GW03', 'U7_GW03',
        'U8_GW03', 'U9_GW03', 'U10_GW03', 'U11_GW03', 'U12_GW03', 'U13_GW03', 'U14_GW03',
        'U15_GW03', 'U16_GW03', 'U17_GW03', 'U18_GW03', 'U19_GW03', 'U20_GW03', 'U21_GW03',
        'U22_GW03', 'U23_GW03'],

        ALL:['U1_PLC', 'U2_PLC', 'U3_PLC', 'U4_PLC', 'U5_PLC', 'U6_PLC', 'U7_PLC', 'U8_PLC',
        'U9_PLC', 'U10_PLC', 'U11_PLC', 'U12_PLC', 'U13_PLC', 'U14_PLC', 'U15_PLC', 'U16_PLC',
        'U17_PLC', 'U18_PLC', 'U19_PLC', 'U20_PLC', 'U21_PLC', 'U1_GW01', 'U2_GW01', 'U3_GW01',
        'U4_GW01', 'U5_GW01', 'U6_GW01', 'U7_GW01', 'U8_GW01', 'U9_GW01', 'U10_GW01',
        'U11_GW01', 'U12_GW01', 'U13_GW01', 'U14_GW01', 'U15_GW01', 'U16_GW01', 'U17_GW01',
        'U18_GW01', 'U19_GW01', 'U20_GW01', 'U21_GW01', 'U22_GW01', 'U23_GW01',
        'U1_GW02', 'U2_GW02', 'U3_GW02', 'U4_GW02', 'U5_GW02', 'U6_GW02', 'U7_GW02',
        'U8_GW02', 'U9_GW02', 'U10_GW02', 'U11_GW02', 'U12_GW02', 'U13_GW02', 'U14_GW02',
        'U15_GW02', 'U16_GW02', 'U17_GW02', 'U18_GW02', 'U19_GW02', 'U20_GW02', 'U21_GW02',
        'U22_GW02', 'U23_GW02', 'U1_GW03', 'U2_GW03', 'U3_GW03', 'U4_GW03', 'U5_GW03', 'U6_GW03', 'U7_GW03',
        'U8_GW03', 'U9_GW03', 'U10_GW03', 'U11_GW03', 'U12_GW03', 'U13_GW03', 'U14_GW03',
        'U15_GW03', 'U16_GW03', 'U17_GW03', 'U18_GW03', 'U19_GW03', 'U20_GW03', 'U21_GW03',
        'U22_GW03', 'U23_GW03']
    };

    return areaMapping[area] || [];
  }

  // 🔹 Main method
  async getConsumptionData(dto: GetEnergyCostDto) {
    const { start_date, end_date, suffixes, area } = dto;
    let { meterIds } = dto;

    // 🔸 Convert area to unit name like 'Unit_4' → 'U4'
    const unit = area?.replace('Unit_', 'U');

    // 🔹 Resolve meterIds from area if not provided
    if ((!meterIds || meterIds.length === 0) && area) {
      meterIds = this.getMeterIdsForArea(area);
    }

    if (!meterIds || meterIds.length === 0 || !suffixes || suffixes.length === 0) {
      throw new Error('Missing meterIds or suffixes');
    }

    const suffixArray = suffixes;

    const startOfRange = moment.tz(start_date, 'YYYY-MM-DD', 'Asia/Karachi').startOf('day').toISOString(true);
    const endOfRange = moment.tz(end_date, 'YYYY-MM-DD', 'Asia/Karachi').endOf('day').toISOString(true);

    // 🔸 Get production value from daily_production for the unit and start_date
  let productionValue: number | null = null;

if (area === 'ALL') {
  // Sum production for Unit_4 and Unit_5
  const [unit4, unit5] = await Promise.all([
    this.dailyModel.findOne({ unit: 'U4', date: start_date }).select('value').lean(),
    this.dailyModel.findOne({ unit: 'U5', date: start_date }).select('value').lean(),
  ]);

  const prod4 = unit4?.value || 0;
  const prod5 = unit5?.value || 0;

  productionValue = prod4 + prod5;
} else if (unit) {
  // Single unit (Unit_4 → U4, Unit_5 → U5)
  const productionDoc = await this.dailyModel.findOne({
    unit,
    date: start_date,
  }).select('value').lean();

  productionValue = productionDoc?.value || 0;
}


    const result: {
      meterId: string;
      suffix: string;
      startValue: number;
      endValue: number;
      consumption: number;
      startTimestamp: string;
      endTimestamp: string;
      production: number;
    }[] = [];

    for (let i = 0; i < meterIds.length; i++) {
      const meterId = meterIds[i];
      const suffix = suffixArray[i] || suffixArray[0]; // Default to first suffix if missing

      const key = `${meterId}_${suffix}`;
      const projection = { [key]: 1, timestamp: 1 };

      const firstDoc = await this.costModel
        .findOne({ timestamp: { $gte: startOfRange, $lte: endOfRange } })
        .select(projection)
        .sort({ timestamp: 1 })
        .lean();

      const lastDoc = await this.costModel
        .findOne({ timestamp: { $gte: startOfRange, $lte: endOfRange } })
        .select(projection)
        .sort({ timestamp: -1 })
        .lean();

      if (!firstDoc || !lastDoc || firstDoc[key] === undefined || lastDoc[key] === undefined) {
        continue;
      }

      const startValue = firstDoc[key];
      const endValue = lastDoc[key];
      const consumption = endValue - startValue;

      result.push({
        meterId,
        suffix,
        startValue,
        endValue,
        consumption,
        startTimestamp: firstDoc.timestamp,
        endTimestamp: lastDoc.timestamp,
        production: productionValue || 0,
      });
    }

    return result;
  }
}

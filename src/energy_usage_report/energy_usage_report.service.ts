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
  private sanitizeValue(value: number): number {
  if (!isFinite(value) || isNaN(value)) return 0;

  const minThreshold = 1e-6;
  const maxThreshold = 1e+12;

  if (Math.abs(value) < minThreshold || Math.abs(value) > maxThreshold) {
    return 0;
  }

  return value;
}


  // 🔹 Main method
  async getConsumptionData(dto: GetEnergyCostDto) {
  const { start_date, end_date, suffixes, area } = dto;
  let { meterIds } = dto;

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

  // 🔸 Prepare unit-based production only for 'ALL' case
  let unit4TotalProduction = 0;
  let unit5TotalProduction = 0;

  if (area === 'ALL') {
    const [unit4Production, unit5Production] = await Promise.all([
      this.dailyModel.aggregate([
        {
          $match: {
            unit: 'U4',
            date: { $gte: start_date, $lte: end_date }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$value' }
          }
        }
      ]),
      this.dailyModel.aggregate([
        {
          $match: {
            unit: 'U5',
            date: { $gte: start_date, $lte: end_date }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$value' }
          }
        }
      ])
    ]);

    unit4TotalProduction = unit4Production[0]?.total || 0;
    unit5TotalProduction = unit5Production[0]?.total || 0;
  }

  // 🔸 Default production value if area is NOT 'ALL'
  let productionValue = 0;

  if (area !== 'ALL' && unit) {
    const productionAgg = await this.dailyModel.aggregate([
      {
        $match: {
          unit,
          date: { $gte: start_date, $lte: end_date }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$value' }
        }
      }
    ]);

    productionValue = productionAgg[0]?.total || 0;
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
    const suffix = suffixArray[i] || suffixArray[0]; // Default to first suffix if not mapped

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

   let startValue = this.sanitizeValue(firstDoc[key]);
let endValue = this.sanitizeValue(lastDoc[key]);
let consumption = this.sanitizeValue(endValue - startValue);


    // 🔸 Correct production logic based on meterId suffix when area is ALL
    let meterProduction = 0;
    if (area === 'ALL') {
      if (meterId.endsWith('PLC') || meterId.endsWith('GW01')) {
        meterProduction = unit4TotalProduction;
      } else if (meterId.endsWith('GW02') || meterId.endsWith('GW03')) {
        meterProduction = unit5TotalProduction;
      } else {
        meterProduction = 0;
      }
    } else {
      meterProduction = productionValue;
    }

  result.push({
  meterId,
  suffix,
  startValue,
  endValue,
  consumption,
  startTimestamp: firstDoc.timestamp,
  endTimestamp: lastDoc.timestamp,
  production: meterProduction,
});

  }

  return result;
}

}

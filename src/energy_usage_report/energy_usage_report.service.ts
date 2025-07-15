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

  if ((!meterIds || meterIds.length === 0) && area) {
    meterIds = this.getMeterIdsForArea(area);
  }

  if (!meterIds || meterIds.length === 0 || !suffixes || suffixes.length === 0) {
    throw new Error('Missing meterIds or suffixes');
  }

  const suffixArray = suffixes;
  const results: any[] = [];

  let unit4TotalProduction = 0;
  let unit5TotalProduction = 0;
  let productionMap: Record<string, number> = {};

  // Pre-fetch production by date
  if (area === 'ALL') {
    const productions = await this.dailyModel.aggregate([
      {
        $match: {
          date: { $gte: start_date, $lte: end_date },
          unit: { $in: ['U4', 'U5'] }
        }
      },
      {
        $group: {
          _id: { unit: '$unit', date: '$date' },
          total: { $sum: '$value' }
        }
      }
    ]);

    for (const row of productions) {
      const key = `${row._id.unit}_${row._id.date}`;
      productionMap[key] = row.total;
    }

  } else if (unit) {
    const productions = await this.dailyModel.aggregate([
      {
        $match: {
          date: { $gte: start_date, $lte: end_date },
          unit
        }
      },
      {
        $group: {
          _id: '$date',
          total: { $sum: '$value' }
        }
      }
    ]);
    for (const row of productions) {
      productionMap[row._id] = row.total;
    }
  }

  // Loop through each date
  const current = moment.tz(start_date, 'YYYY-MM-DD', 'Asia/Karachi');
  const endMoment = moment.tz(end_date, 'YYYY-MM-DD', 'Asia/Karachi');

  while (current.isSameOrBefore(endMoment, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');
    const startOfDay = current.clone().startOf('day').toISOString(true);
    const endOfDay = current.clone().endOf('day').toISOString(true);

    const docs = await this.costModel.aggregate([
      {
        $match: {
          timestamp: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $sort: { timestamp: 1 as const }
      },
      {
        $group: {
          _id: null,
          first: { $first: '$$ROOT' },
          last: { $last: '$$ROOT' },
        }
      }
    ]);

    const firstDoc = docs[0]?.first;
    const lastDoc = docs[0]?.last;

    if (!firstDoc || !lastDoc) {
      current.add(1, 'day');
      continue;
    }

    meterIds.forEach((meterId, index) => {
      const suffix = suffixArray[index] || suffixArray[0];
      const key = `${meterId}_${suffix}`;

      if (firstDoc[key] === undefined || lastDoc[key] === undefined) return;

      const startVal = this.sanitizeValue(firstDoc[key]);
      const endVal = this.sanitizeValue(lastDoc[key]);
      const consumption = this.sanitizeValue(endVal - startVal);

      let meterProduction = 0;

      if (area === 'ALL') {
        if (meterId.endsWith('PLC') || meterId.endsWith('GW01')) {
          meterProduction = productionMap[`U4_${dateStr}`] || 0;
        } else if (meterId.endsWith('GW02') || meterId.endsWith('GW03')) {
          meterProduction = productionMap[`U5_${dateStr}`] || 0;
        }
      } else {
        meterProduction = productionMap[dateStr] || 0;
      }

      results.push({
        date: dateStr,
        meterId,
        suffix,
        startValue: startVal,
        endValue: endVal,
        consumption,
        startTimestamp: firstDoc.timestamp,
        endTimestamp: lastDoc.timestamp,
        production: meterProduction,
      });
    });

    current.add(1, 'day');
  }

  return results;
}



}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { Energyusagereport } from './schemas/energy-usage_report.schema';
import { DailyProduction } from './schemas/daily-production.schema';
import { FieldMeterProcess } from './schemas/field-meter-process.schema';
import * as moment from 'moment-timezone';

@Injectable()
export class EnergyUsageReportService {
  constructor(
    @InjectModel(Energyusagereport.name, 'surajcotton') private costModel: Model<Energyusagereport>,
    @InjectModel(DailyProduction.name, 'surajcotton') private dailyModel: Model<DailyProduction>,
    @InjectModel(FieldMeterProcess.name, 'surajcotton') private fieldMeterModel: Model<FieldMeterProcess>,
  ) {}

  private sanitizeValue(value: number): number {
    if (!isFinite(value) || isNaN(value)) return 0;
    const minThreshold = 1e-6;
    const maxThreshold = 1e12;
    if (Math.abs(value) < minThreshold || Math.abs(value) > maxThreshold) return 0;
    return value;
  }

  async getConsumptionData(dto: GetEnergyCostDto) {
    const { start_date, end_date, suffixes, area } = dto;
    const suffix = suffixes?.[0] || 'Del_ActiveEnergy';

    // 🔹 Mappings
    const blowRoomMapping = { Unit_4: ['U8_GW01','U14_GW01'], Unit_5: ['U12_GW02','U9_GW02'] };
    const cardMapping = { Unit_4: ['U5_GW01','U9_GW01','U1_GW02','U2_GW02'], Unit_5: ['U3_GW02','U19_GW02','U17_GW02','U11_GW02'] };

    const fieldMeterGroups = {
      autocone1to9: { Unit_4: ['U23_GW03'], Unit_5: ['U23_GW03'] },
      autocone10to18: { Unit_4: ['U22_GW03'], Unit_5: ['U22_GW03'] },
      comber1to14: { Unit_4: ['U4_GW02'], Unit_5: ['U4_GW02'] },
      cardingdb1to14: { Unit_4: ['U3_GW02'], Unit_5: ['U3_GW02'] },
      carddb1: { Unit_4: ['U1_GW02'], Unit_5: ['U1_GW02'] },
      carddb2: { Unit_4: ['U2_GW02'], Unit_5: ['U2_GW02'] },
    };

    const startISO = moment.tz(start_date, 'YYYY-MM-DD', 'Asia/Karachi').startOf('day').toISOString(true);
    const endISO = moment.tz(end_date, 'YYYY-MM-DD', 'Asia/Karachi').endOf('day').toISOString(true);
    const areaKeys = area === 'ALL' ? ['Unit_4', 'Unit_5'] : [area];

    // accumulators
    const blowRoomMap = { Unit_4: 0, Unit_5: 0 };
    const cardMap = { Unit_4: 0, Unit_5: 0 };
    const fieldMeterMaps = Object.keys(fieldMeterGroups).reduce((acc, k) => {
      acc[k] = { Unit_4: 0, Unit_5: 0 };
      return acc;
    }, {} as Record<string, { Unit_4: number; Unit_5: number }>);

    // 🔹 Main docs (BlowRoom + Card)
    const [docs] = await this.costModel.aggregate([
      { $match: { timestamp: { $gte: startISO, $lte: endISO } } },
      { $sort: { timestamp: 1 } },
      { $group: { _id: null, first: { $first: '$$ROOT' }, last: { $last: '$$ROOT' } } },
    ]);

    const firstDoc = docs?.first;
    const lastDoc = docs?.last;
    if (!firstDoc || !lastDoc) {
      return [{ date: start_date, startTimestamp: null, endTimestamp: null }];
    }

    for (const key of areaKeys) {
      for (const meterId of blowRoomMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        blowRoomMap[key] += this.sanitizeValue(lastDoc[meterKey] - firstDoc[meterKey]);
      }
      for (const meterId of cardMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        cardMap[key] += this.sanitizeValue(lastDoc[meterKey] - firstDoc[meterKey]);
      }
    }

    // 🔹 FieldMeter consumption (sum of `meters[meterId][Unit_x].consumption` from DB)
// 🔹 FieldMeter consumption (sum of `meters[meterId_suffix][Unit_x].consumption` from DB)
// 🔹 FieldMeter consumption (sum of `meters[meterId_suffix][Unit_x].consumption` from DB)
for (const [groupKey, mapping] of Object.entries(fieldMeterGroups)) {
  console.log('🔹 groupKey:', groupKey, 'mapping:', mapping);

  for (const key of areaKeys) {
    console.log('  🔹 key (area):', key);

    for (const meterId of mapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      console.log('    🔹 meterKey:', meterKey);

      // ✅ Query in UTC range
      const docs = await this.fieldMeterModel.find({
        [`meters.${meterKey}`]: { $exists: true },
        timestamp: {
          $gte: moment.tz(start_date, "Asia/Karachi").startOf("day").toDate(), // UTC auto ban jayega
          $lte: moment.tz(end_date, "Asia/Karachi").endOf("day").toDate(),
        },
      });

      console.log(
        '    🔍 Query:',
        {
          [`meters.${meterKey}`]: { $exists: true },
          timestamp: {
            $gte: moment.tz(start_date, "Asia/Karachi").startOf("day").toDate(),
            $lte: moment.tz(end_date, "Asia/Karachi").endOf("day").toDate(),
          },
        }
      );
      console.log('    📄 Docs found:', docs.length);

      let totalConsumption = 0;

      for (const doc of docs) {
        const metersObj = (doc.toObject() as any).meters;
        const val = metersObj?.[meterKey]?.[key]?.consumption || 0;

        console.log(`       ➡ ${key} consumption value:`, val);
        totalConsumption += this.sanitizeValue(val);
      }

      console.log(`    ✅ Total consumption for ${meterKey}:`, totalConsumption);

      fieldMeterMaps[groupKey][key] += totalConsumption;
    }
  }
}





    // 🔹 Prepare result
    const result: any = {
      date: start_date,
      startTimestamp: firstDoc.timestamp,
      endTimestamp: lastDoc.timestamp,
    };

    if (area === 'ALL') {
      result.unit_4blowroom_consumption = +blowRoomMap.Unit_4.toFixed(2);
      result.unit_5blowroom_consumption = +blowRoomMap.Unit_5.toFixed(2);
      result.unit_4card_consumption = +cardMap.Unit_4.toFixed(2);
      result.unit_5card_consumption = +cardMap.Unit_5.toFixed(2);

      for (const [groupKey, map] of Object.entries(fieldMeterMaps)) {
        result[`unit_4fieldmeter_${groupKey}`] = +map.Unit_4.toFixed(2);
        result[`unit_5fieldmeter_${groupKey}`] = +map.Unit_5.toFixed(2);
      }
    } else {
      result[`${area.toLowerCase()}blowroom_consumption`] = +blowRoomMap[area].toFixed(2);
      result[`${area.toLowerCase()}card_consumption`] = +cardMap[area].toFixed(2);

      for (const [groupKey, map] of Object.entries(fieldMeterMaps)) {
        result[`${area.toLowerCase()}fieldmeter_${groupKey}`] = +map[area].toFixed(2);
      }
    }

    return [result];
  }
}

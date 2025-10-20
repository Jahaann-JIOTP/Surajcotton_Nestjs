// src/trends/trends.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CSNew } from './schemas/CS-new.schema';
import * as moment from 'moment-timezone';


@Injectable()
export class TrendsService {
  constructor(
    @InjectModel(CSNew.name, 'surajcotton')
    private readonly csNewModel: Model<CSNew>,
  ) {}

  // 🔹 Area-to-meters mapping
  private readonly METER_MAPPING: Record<string, Record<string, string[]> | string[]> = {
    'Unit 4': {
      LT_1: [
        'U1_PLC', 'U2_PLC', 'U3_PLC', 'U4_PLC', 'U5_PLC', 'U6_PLC', 'U7_PLC', 'U8_PLC',
        'U9_PLC', 'U10_PLC', 'U11_PLC', 'U12_PLC', 'U13_PLC', 'U14_PLC', 'U15_PLC', 'U16_PLC',
        'U17_PLC', 'U18_PLC', 'U19_PLC', 'U20_PLC', 'U21_PLC',
      ],
      LT_2: [
        'U1_GW01', 'U2_GW01', 'U3_GW01', 'U4_GW01', 'U5_GW01', 'U6_GW01', 'U7_GW01',
        'U8_GW01', 'U9_GW01', 'U10_GW01', 'U11_GW01', 'U12_GW01', 'U13_GW01', 'U14_GW01',
        'U15_GW01', 'U16_GW01', 'U17_GW01', 'U18_GW01', 'U19_GW01', 'U20_GW01', 'U21_GW01',
        'U22_GW01', 'U23_GW01','U24_GW01','U28_PLC',
      ],
    },
    'Unit 5': {
      LT_1: [
        'U1_GW02', 'U2_GW02', 'U3_GW02', 'U4_GW02', 'U5_GW02', 'U6_GW02', 'U7_GW02',
        'U8_GW02', 'U9_GW02', 'U10_GW02', 'U11_GW02', 'U12_GW02', 'U13_GW02', 'U14_GW02',
        'U15_GW02', 'U16_GW02', 'U17_GW02', 'U18_GW02', 'U19_GW02', 'U20_GW02', 'U21_GW02',
        'U22_GW02', 'U23_GW02',
      ],
      LT_2: [
        'U1_GW03', 'U2_GW03', 'U3_GW03', 'U4_GW03', 'U5_GW03', 'U6_GW03', 'U7_GW03',
        'U8_GW03', 'U9_GW03', 'U10_GW03', 'U11_GW03', 'U12_GW03', 'U13_GW03', 'U14_GW03',
        'U15_GW03', 'U16_GW03', 'U17_GW03', 'U18_GW03', 'U19_GW03', 'U20_GW03',
        'U22_GW03', 'U23_GW03',
      ],
    },
    'HFO': [
      'U22_PLC', 'U23_PLC', 'U24_PLC', 'U25_PLC', 'U26_PLC', 'U27_PLC',
    ],
    'HT_Room1': ['U22_GW01', 'U23_GW01'],
    'HT_Room2': ['U19_GW03', 'U20_GW03', 'U21_GW03'],
  };

  // 🔹 Parse "Unit 5 LT_3" or just "HFO"
  private parseArea(areaStr: string): { unit: string; lt?: string } {
    const parts = areaStr.split(' ');
    if (parts.length === 1) {
      // HFO, HT Room 1, HT Room 2
      return { unit: parts[0] };
    } else if (parts.length >= 3) {
      return { unit: parts[0] + ' ' + parts[1], lt: parts[2] };
    }
    return { unit: areaStr };
  }

 async getTrendData(
  startDate: string,
  endDate: string,
  meterIdsStr: string,
  suffixesStr: string,
  area: string,
  timezone = 'Asia/Karachi',
) {
  const startISO = `${startDate}T06:00:00.000+05:00`;

const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');

// 👇 end ko thoda extend kar diya (59.999)
const endISO = `${nextDay}T06:00:59.999+05:00`;

  const { unit, lt } = this.parseArea(area);

  // 🔹 Determine allowed meters
  let allowedMeterIds: string[] = [];
  const mapping = this.METER_MAPPING[unit];
  if (Array.isArray(mapping)) {
    allowedMeterIds = mapping;
  } else if (lt && mapping) {
    allowedMeterIds = mapping[lt] || [];
  }

  const meterIds = meterIdsStr.split(',').map(m => m.trim());
  const suffixes = suffixesStr.split(',').map(s => s.trim());

  const projection: any = { timestamp: 1 };
  meterIds.forEach(meterId => {
    if (allowedMeterIds.includes(meterId)) {
      suffixes.forEach(suffix => {
        projection[`${meterId}_${suffix}`] = 1;
      });
    }
  });

  const rawData = await this.csNewModel.find(
    { timestamp: { $gte: startISO, $lte: endISO } },
    projection,
  ).lean();

  const formatted = rawData.map(doc => {
    const flat: any = { timestamp: doc.timestamp };
    meterIds.forEach(meterId => {
      if (allowedMeterIds.includes(meterId)) {
        suffixes.forEach(suffix => {
          const key = `${meterId}_${suffix}`;
          if (doc[key] !== undefined) {
            let value = doc[key];
            // scientific notation check
            if (value.toString().includes('e')) value = 0;
            // round to 2 decimal places
            flat[key] = Math.round(value * 100) / 100;
          } else {
            flat[key] = 0;
          }
        });
      }
    });
    return flat;
  });

  formatted.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return formatted;
}

}

// src/trends/trends.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CSNew } from './schemas/CS-new.schema';

@Injectable()
export class TrendsService {
  constructor(
    @InjectModel(CSNew.name, 'surajcotton')
    private readonly csNewModel: Model<CSNew>,
  ) {}

private getMeterPrefixes(area: string, LT_selections: string): string[] {
  const mapping: Record<string, Record<string, string[]>> = {
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
        'U22_GW01', 'U23_GW01',
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
        'U15_GW03', 'U16_GW03', 'U17_GW03', 'U18_GW03', 'U19_GW03', 'U20_GW03', 'U21_GW03',
        'U22_GW03', 'U23_GW03',
      ],
    },
  };

  const areaMapping = mapping[area];

  if (!areaMapping) return [];

  // Return both LT_1 and LT_2 if "ALL" is selected
  if (LT_selections === 'ALL') {
    return [...(areaMapping['LT_1'] || []), ...(areaMapping['LT_2'] || [])];
  }

  return areaMapping[LT_selections] || [];
}



 async getTrendData(
  startDate: string,
  endDate: string,
  meterIds: string[],
  suffixes: string[],
  area: string,
  LT_selections: string
) {
  const start = `${startDate}T00:00:00.000+05:00`;
  const end = `${endDate}T23:59:59.999+05:00`;

  const allowedMeterIds = this.getMeterPrefixes(area, LT_selections);
  const projection: any = { timestamp: 1 };

  meterIds.forEach(meterId => {
    if (allowedMeterIds.includes(meterId)) {
      suffixes.forEach(suffix => {
        projection[`${meterId}_${suffix}`] = 1;
      });
    }
  });

  const rawData = await this.csNewModel.find({ timestamp: { $gte: start, $lte: end } }, projection).lean();

const formatted = rawData.map(doc => {
  const flat: any = {
    timestamp: doc.timestamp,
  };

  meterIds.forEach(meterId => {
    if (allowedMeterIds.includes(meterId)) {
      suffixes.forEach(suffix => {
        const key = `${meterId}_${suffix}`;
        if (doc[key] !== undefined) {
          flat[key] = doc[key];
        } else {
          flat[key] = 0; // Optional: show 0 if missing
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

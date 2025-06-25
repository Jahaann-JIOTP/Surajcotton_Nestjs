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

  private getMeterPrefixes(area: string, selection: string): string[] {
    const mapping: Record<string, Record<string, string[]>> = {
     'Unit 4': {
      LT_1: [
        'U1_PLC',
        'U2_PLC',
        'U3_PLC',
        'U4_PLC',
        'U5_PLC',
        'U6_PLC',
        'U7_PLC',
        'U8_PLC',
        'U9_PLC',
        'U10_PLC',
        'U11_PLC',
        'U12_PLC',
        'U13_PLC',
        'U14_PLC',
        'U15_PLC',
        'U16_PLC',
        'U17_PLC',
        'U18_PLC',
        'U19_PLC',
        'U20_PLC',
        'U21_PLC',

      ],
      LT_2: ['GW01']
    },
    'Unit 5': {
      LT_1: ['GW02'],
      LT_2: ['GW03']
    }
  };

    return mapping[area]?.[selection] || [];
  }

 async getTrendData(
  startDate: string,
  endDate: string,
  meterIds: string[],
  suffixes: string[],
  area: string,
  selection: string
) {
  const start = `${startDate}T00:00:00.000+05:00`;
  const end = `${endDate}T23:59:59.999+05:00`;

  const allowedMeterIds = this.getMeterPrefixes(area, selection);
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
    const data: any = {};
    meterIds.forEach(meterId => {
      if (allowedMeterIds.includes(meterId)) {
        suffixes.forEach(suffix => {
          const key = `${meterId}_${suffix}`;
          if (doc[key] !== undefined) {
            data[meterId] = data[meterId] || {};
            data[meterId][suffix] = doc[key];
          }
        });
      }
    });

    return {
      timestamp: doc.timestamp,
      data
    };
  });

  formatted.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return formatted;
}


}

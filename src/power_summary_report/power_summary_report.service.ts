import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetEnergyCostDto } from './dto/get-power_summary-report.dto';
import { EnergyCost } from './schemas/power_summary-report.schema';
import * as moment from 'moment-timezone';

@Injectable()
export class PowerSummaryReportService {
  constructor(
    @InjectModel(EnergyCost.name, 'surajcotton') private costModel: Model<EnergyCost>,
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
        'U18_GW01', 'U19_GW01', 'U20_GW01', 'U21_GW01', 'U22_GW01', 'U23_GW01'
      ],
      Unit_5:[
        'U1_GW02', 'U2_GW02', 'U3_GW02', 'U4_GW02', 'U5_GW02', 'U6_GW02', 'U7_GW02',
        'U8_GW02', 'U9_GW02', 'U10_GW02', 'U11_GW02', 'U12_GW02', 'U13_GW02', 'U14_GW02',
        'U15_GW02', 'U16_GW02', 'U17_GW02', 'U18_GW02', 'U19_GW02', 'U20_GW02', 'U21_GW02',
        'U22_GW02', 'U23_GW02', 'U1_GW03', 'U2_GW03', 'U3_GW03', 'U4_GW03', 'U5_GW03', 'U6_GW03', 'U7_GW03',
        'U8_GW03', 'U9_GW03', 'U10_GW03', 'U11_GW03', 'U12_GW03', 'U13_GW03', 'U14_GW03',
        'U15_GW03', 'U16_GW03', 'U17_GW03', 'U18_GW03', 'U19_GW03', 'U20_GW03', 'U21_GW03',
        'U22_GW03', 'U23_GW03'
      ],
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

  // Define bounds outside which values are considered scientific or invalid
  const minThreshold = 1e-6;
  const maxThreshold = 1e+12;

  if (Math.abs(value) < minThreshold || Math.abs(value) > maxThreshold) {
    return 0;
  }

  return value;
}


  // 🔹 Main method
async getConsumptionData(dto: GetEnergyCostDto) {
  const { start_date, end_date, suffixes } = dto;
  let { meterIds, area } = dto;

  if ((!meterIds || meterIds.length === 0) && area) {
    meterIds = this.getMeterIdsForArea(area);
  }

  if (!meterIds?.length || !suffixes?.length) {
    throw new Error('Missing meterIds or suffixes');
  }

  const additionalTags: Record<string, string[]> = {
    Unit_4: ['U22_GW01'],
    Unit_5: [
      'U6_GW02', 'U17_GW03',
      'U21_PLC', 'U13_GW01', 'U13_GW02', 'U16_GW03',
      'U23_GW01', 'U20_GW03', 'U19_GW03', 'U22_GW01',
    ],
  };

  const extraIds: string[] = area && additionalTags[area] ? additionalTags[area] : [];
  const allMeterIds = [...new Set([...meterIds, ...extraIds])];

  const start = moment.tz(start_date, 'Asia/Karachi').startOf('day');
  const end = moment.tz(end_date, 'Asia/Karachi').endOf('day');

  const projectionFields: Record<string, number> = { timestamp: 1 };
  for (const meterId of allMeterIds) {
    for (const suffix of suffixes) {
      projectionFields[`${meterId}_${suffix}`] = 1;
    }
  }

  const allData = await this.costModel.aggregate([
    {
      $match: {
        timestamp: {
          $gte: start.toISOString(true),
          $lte: end.toISOString(true),
        },
      },
    },
    { $project: projectionFields },
    { $sort: { timestamp: 1 } },
  ]).exec();

  const groupedData: Record<string, { first?: number; last?: number }> = {};

  for (const doc of allData) {
    const date = moment.tz(doc.timestamp, 'Asia/Karachi').format('YYYY-MM-DD');
    for (const key of Object.keys(doc)) {
      if (key === 'timestamp') continue;
      const uniqueKey = `${date}_${key}`;
      const val = this.sanitizeValue(doc[key]);
      if (!(uniqueKey in groupedData)) {
        groupedData[uniqueKey] = { first: val, last: val };
      } else {
        groupedData[uniqueKey].last = val;
      }
    }
  }

  // Transformer mappings for Unit_5
  const Trafo1Incoming = 'U21_PLC_Del_ActiveEnergy';
  const Trafo2Incoming = 'U13_GW01_Del_ActiveEnergy';
  const Trafo3Incoming = 'U13_GW02_Del_ActiveEnergy';
  const Trafo4Incoming = 'U16_GW03_Del_ActiveEnergy';
  const Trafo1Outgoing = 'U23_GW01_Del_ActiveEnergy';
  const Trafo2Outgoing = 'U22_GW01_Del_ActiveEnergy';
  const Trafo3Outgoing = 'U20_GW03_Del_ActiveEnergy';
  const Trafo4Outgoing = 'U19_GW03_Del_ActiveEnergy';

  const results: {
    date: string;
    totalConsumption: number;
    area?: string;
    solar1?: number;
    solar2?: number;
    transformerLosses?: number;
    trafo1Loss?: number;
    trafo2Loss?: number;
    trafo3Loss?: number;
    trafo4Loss?: number;
    totalGeneration?: number;
    wapda1?: number;
    wapdaexport?: number;
  }[] = [];

  let current = start.clone();

  while (current.isSameOrBefore(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');
    let dailyTotal = 0;
    let solar1 = 0;
    let solar2 = 0;
    let trafo1Loss = 0;
    let trafo2Loss = 0;
    let trafo3Loss = 0;
    let trafo4Loss = 0;
    let wapda1 = 0;
    let wapdaexport = 0;

    const getValue = (tag: string) => {
      const key = `${dateStr}_${tag}`;
      const pair = groupedData[key];
      if (pair && pair.first !== undefined && pair.last !== undefined) {
        return this.sanitizeValue(pair.last - pair.first);
      }
      return 0;
    };

    for (const meterId of allMeterIds) {
      for (const suffix of suffixes) {
        const key = `${dateStr}_${meterId}_${suffix}`;
        const pair = groupedData[key];

        if (pair && pair.first !== undefined && pair.last !== undefined) {
          const consumption = this.sanitizeValue(pair.last - pair.first);

          // Total consumption always accumulates
          dailyTotal += consumption;

          if (area === 'Unit_4' && meterId === 'U22_GW01') {
            if (suffix === 'ActiveEnergy_Exp_kWh') {
              wapdaexport += consumption;
            } else {
              wapda1 += consumption;
            }
          }

          if (area === 'Unit_5') {
            if (meterId === 'U6_GW02') solar1 += consumption;
            if (meterId === 'U17_GW03') solar2 += consumption;
          }
        }
      }
    }

    // Transformer losses only for Unit_5
    if (area === 'Unit_5') {
      trafo1Loss = getValue(Trafo1Incoming) - getValue(Trafo1Outgoing);
      trafo2Loss = getValue(Trafo2Incoming) - getValue(Trafo2Outgoing);
      trafo3Loss = getValue(Trafo3Incoming) - getValue(Trafo3Outgoing);
      trafo4Loss = getValue(Trafo4Incoming) - getValue(Trafo4Outgoing);
    }

    const transformerLosses = this.sanitizeValue(
      trafo1Loss + trafo2Loss + trafo3Loss + trafo4Loss,
    );
    const totalGeneration = this.sanitizeValue(solar1 + solar2);

    const entry: any = {
      date: dateStr,
      area: area || 'N/A',
      totalConsumption: Number(dailyTotal.toFixed(2)),
    };

    if (area === 'Unit_4') {
      entry.wapda1 = Number(wapda1.toFixed(2));
      entry.wapdaexport = Number(wapdaexport.toFixed(2));
    }

    if (area === 'Unit_5') {
      entry.solar1 = Number(solar1.toFixed(2));
      entry.solar2 = Number(solar2.toFixed(2));
      entry.totalGeneration = Number(totalGeneration.toFixed(2));
      entry.trafo1Loss = Number(trafo1Loss.toFixed(2));
      entry.trafo2Loss = Number(trafo2Loss.toFixed(2));
      entry.trafo3Loss = Number(trafo3Loss.toFixed(2));
      entry.trafo4Loss = Number(trafo4Loss.toFixed(2));
      entry.transformerLosses = Number(transformerLosses.toFixed(2));
    }
  


    results.push(entry);
    current.add(1, 'day');
  }

  return results;
}












}

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
  // did not add these tags in consumption these tags add in generation 
// ['U6_GW02', 'U17_GW03','U21_PLC', 'U13_GW01', 'U13_GW02', 'U16_GW03','U23_GW01', 'U20_GW03', 'U19_GW03', 'U22_GW01'],
  // 🔹 Mapping function for area to meterIds
  private getMeterIdsForArea(area: string): string[] {
    const areaMapping: Record<string, string[]> = {
      Unit_4: [
        'U1_PLC', 'U2_PLC', 'U3_PLC', 'U4_PLC', 'U5_PLC', 'U6_PLC', 'U7_PLC', 'U8_PLC',
        'U9_PLC', 'U10_PLC', 'U11_PLC', 'U12_PLC', 'U13_PLC', 'U14_PLC', 'U15_PLC', 'U16_PLC',
        'U17_PLC', 'U18_PLC', 'U19_PLC', 'U20_PLC', 'U21_PLC', 'U1_GW01', 'U2_GW01', 'U3_GW01',
        'U4_GW01', 'U5_GW01', 'U6_GW01', 'U7_GW01', 'U8_GW01', 'U9_GW01', 'U10_GW01',
        'U11_GW01', 'U12_GW01', 'U13_GW01', 'U14_GW01', 'U15_GW01', 'U16_GW01', 'U17_GW01',
        'U18_GW01', 'U19_GW01', 'U20_GW01', 'U21_GW01', 'U23_GW01'
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
        'U17_PLC', 'U18_PLC', 'U19_PLC', 'U20_PLC', 'U1_GW01', 'U2_GW01', 'U3_GW01',
        'U4_GW01', 'U5_GW01', 'U6_GW01', 'U7_GW01', 'U8_GW01', 'U9_GW01', 'U10_GW01',
        'U11_GW01', 'U12_GW01', 'U14_GW01', 'U15_GW01', 'U16_GW01', 'U17_GW01',
        'U18_GW01', 'U19_GW01', 'U20_GW01', 'U21_GW01',
        'U1_GW02', 'U2_GW02', 'U3_GW02', 'U4_GW02', 'U5_GW02',  'U7_GW02',
        'U8_GW02', 'U9_GW02', 'U10_GW02', 'U11_GW02', 'U12_GW02', 'U13_GW02', 'U14_GW02',
        'U15_GW02', 'U16_GW02', 'U17_GW02', 'U18_GW02', 'U19_GW02', 'U20_GW02', 'U21_GW02',
        'U22_GW02', 'U23_GW02', 'U1_GW03', 'U2_GW03', 'U3_GW03', 'U4_GW03', 'U5_GW03', 'U6_GW03', 'U7_GW03',
        'U8_GW03', 'U9_GW03', 'U10_GW03', 'U11_GW03', 'U12_GW03', 'U13_GW03', 'U14_GW03',
        'U15_GW03', 'U17_GW03', 'U18_GW03', 'U21_GW03',
         'U23_GW03']
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


private round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async getConsumptionData(dto: GetEnergyCostDto) {
  const { start_date, end_date, suffixes } = dto;
  const area = dto.area ?? '';

  const isAll = area === 'ALL';
  const areasToProcess = isAll ? ['Unit_4', 'Unit_5'] : [area];

  const additionalTags = {
    Unit_4: ['U22_GW01'],
    Unit_5: [
      'U6_GW02', 'U17_GW03',
      'U21_PLC', 'U13_GW01', 'U13_GW02', 'U16_GW03',
      'U23_GW01', 'U20_GW03', 'U19_GW03', 'U22_GW01',
    ],
  };

  const start = moment.tz(start_date, 'Asia/Karachi').startOf('day');
  const end = moment.tz(end_date, 'Asia/Karachi').endOf('day');

  const allMeterIds = new Set<string>();
  for (const areaKey of areasToProcess) {
    this.getMeterIdsForArea(areaKey).forEach(id => allMeterIds.add(id));
    (additionalTags[areaKey] || []).forEach(id => allMeterIds.add(id));
  }

  const projectionFields: Record<string, number> = { timestamp: 1 };
  for (const meterId of allMeterIds) {
    for (const suffix of suffixes) {
      projectionFields[`${meterId}_${suffix}`] = 1;
    }
  }

  const allData = await this.costModel.aggregate([
    { $match: { timestamp: { $gte: start.toISOString(true), $lte: end.toISOString(true) } } },
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
      if (!groupedData[uniqueKey]) {
        groupedData[uniqueKey] = { first: val, last: val };
      } else {
        groupedData[uniqueKey].last = val;
      }
    }
  }

  const trafoTags = {
    in: ['U21_PLC_Del_ActiveEnergy', 'U13_GW01_Del_ActiveEnergy', 'U13_GW02_Del_ActiveEnergy', 'U16_GW03_Del_ActiveEnergy'],
    out: ['U23_GW01_Del_ActiveEnergy', 'U22_GW01_Del_ActiveEnergy', 'U20_GW03_Del_ActiveEnergy', 'U19_GW03_Del_ActiveEnergy'],
  };

  const mergedResult: any = {
    area,
    unit4_consumption: 0,
    unit5_consumption: 0,
    wapda1: 0,
    wapdaexport: 0,
    solar1: 0,
    solar2: 0,
    totalGeneration: 0,
    trafo1Loss: 0,
    trafo2Loss: 0,
    trafo3Loss: 0,
    trafo4Loss: 0,
    transformerLosses: 0,
  };

  let current = start.clone();
  while (current.isSameOrBefore(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');

    for (const unitArea of areasToProcess) {
      const meterIds = this.getMeterIdsForArea(unitArea);
      const extraIds = additionalTags[unitArea] || [];
      const allIds = [...new Set([...meterIds, ...extraIds])];

      let dailyTotal = 0;
      let solar1 = 0, solar2 = 0;
      let wapda1 = 0, wapdaexport = 0;
      let trafo1Loss = 0, trafo2Loss = 0, trafo3Loss = 0, trafo4Loss = 0;

      const getValue = (tag: string) => {
        const key = `${dateStr}_${tag}`;
        const pair = groupedData[key];
        return pair?.first !== undefined && pair?.last !== undefined
          ? this.sanitizeValue(pair.last - pair.first)
          : 0;
      };

      for (const meterId of allIds) {
        for (const suffix of suffixes) {
          const key = `${dateStr}_${meterId}_${suffix}`;
          const pair = groupedData[key];
          if (pair && pair.first !== undefined && pair.last !== undefined) {
            const consumption = this.sanitizeValue(pair.last - pair.first);
            dailyTotal += consumption;

            if (unitArea === 'Unit_4' && meterId === 'U22_GW01') {
              if (suffix === 'ActiveEnergy_Exp_kWh') wapdaexport += consumption;
              else wapda1 += consumption;
            }

            if (unitArea === 'Unit_5') {
              if (meterId === 'U6_GW02') solar1 += consumption;
              if (meterId === 'U17_GW03') solar2 += consumption;
            }
          }
        }
      }

      if (unitArea === 'Unit_5') {
        trafo1Loss = getValue(trafoTags.in[0]) - getValue(trafoTags.out[0]);
        trafo2Loss = getValue(trafoTags.in[1]) - getValue(trafoTags.out[1]);
        trafo3Loss = getValue(trafoTags.in[2]) - getValue(trafoTags.out[2]);
        trafo4Loss = getValue(trafoTags.in[3]) - getValue(trafoTags.out[3]);
      }
   


      const transformerLosses = this.sanitizeValue(trafo1Loss + trafo2Loss + trafo3Loss + trafo4Loss);
      const totalGeneration = this.sanitizeValue(solar1 + solar2);

      if (unitArea === 'Unit_4') mergedResult.unit4_consumption += this.round2(dailyTotal);
      if (unitArea === 'Unit_5') mergedResult.unit5_consumption += this.round2(dailyTotal);

      mergedResult.wapda1 += this.round2(wapda1);
      mergedResult.wapdaexport += this.round2(wapdaexport);
      mergedResult.solar1 += this.round2(solar1);
      mergedResult.solar2 += this.round2(solar2);
      mergedResult.totalGeneration += this.round2(totalGeneration);
      mergedResult.trafo1Loss += this.round2(trafo1Loss);
      mergedResult.trafo2Loss += this.round2(trafo2Loss);
      mergedResult.trafo3Loss += this.round2(trafo3Loss);
      mergedResult.trafo4Loss += this.round2(trafo4Loss);
      mergedResult.transformerLosses += this.round2(transformerLosses);
    }

    current.add(1, 'day');
  }

  // Round all numeric values
  for (const key of Object.keys(mergedResult)) {
    if (typeof mergedResult[key] === 'number') {
      mergedResult[key] = this.round2(mergedResult[key]);
    }
  }

  // 🔍 Filter fields based on selection
  let fieldsToKeep: string[] = [];

if (area === 'Unit_4') {
  fieldsToKeep = ['area', 'unit4_consumption', 'total_consumption', 'wapda1', 'wapdaexport', 'total_generation', 'unaccountable_energy'];
} else if (area === 'Unit_5') {
  fieldsToKeep = [
    'area', 'unit5_consumption', 'total_consumption',
    'solar1', 'solar2',
    'trafo1Loss', 'trafo2Loss', 'trafo3Loss', 'trafo4Loss', 'transformerLosses',
    'total_generation', 'unaccountable_energy'
  ];
} else if (area === 'ALL') {
  fieldsToKeep = [
    'area', 'unit4_consumption', 'unit5_consumption', 'total_consumption',
    'wapda1', 'wapdaexport', 'solar1', 'solar2', 
    'trafo1Loss', 'trafo2Loss', 'trafo3Loss', 'trafo4Loss', 'transformerLosses',
    'total_generation', 'unaccountable_energy'
  ];
}

        // 👇 Add this block before finalResult
      if (area === 'Unit_4') {
        mergedResult.total_consumption = mergedResult.unit4_consumption;
      } else if (area === 'Unit_5') {
        mergedResult.total_consumption = mergedResult.unit5_consumption;
      } else if (area === 'ALL') {


        mergedResult.total_consumption = this.round2(
          mergedResult.unit4_consumption + mergedResult.unit5_consumption
        );
      }
      // 👇 Compute total_generation based on area selection
        if (area === 'Unit_4') {
          mergedResult.total_generation = this.round2(mergedResult.wapda1);
        } else if (area === 'Unit_5') {
          mergedResult.total_generation = this.round2(mergedResult.solar1 + mergedResult.solar2);
        } else if (area === 'ALL') {
          mergedResult.total_generation = this.round2(
            mergedResult.wapda1 + mergedResult.solar1 + mergedResult.solar2
          );
        }

        // 👇 Compute unaccountable_energy
        mergedResult.unaccountable_energy = this.round2(
          mergedResult.total_consumption - mergedResult.total_generation
        ); 


  const finalResult = Object.fromEntries(
    Object.entries(mergedResult).filter(([key]) => fieldsToKeep.includes(key))
  );

  return [finalResult];
}

}

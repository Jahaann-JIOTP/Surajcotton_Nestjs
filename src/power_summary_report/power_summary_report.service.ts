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
  ) { }

  private getMeterIdsForArea(area: string): string[] {
    const areaMapping: Record<string, string[]> = {
      Unit_4: ['U19_PLC', 'U21_PLC', 'U13_GW01', 'U11_GW01', 'U24_GW01'],
      Unit_5: ['U13_GW02', 'U16_GW03', 'U6_GW02', 'U17_GW03'],
      ALL: [
        'U19_PLC',
        'U21_PLC',
        'U13_GW01',
        'U11_GW01',
        'U13_GW02',
        'U16_GW03',
        'U6_GW02',
        'U17_GW03',
      ],
    };
    return areaMapping[area] || [];
  }

  private sanitizeValue(value: number): number {
    if (!isFinite(value) || isNaN(value)) return 0;
    const minThreshold = 1e-6;
    const maxThreshold = 1e12;
    if (Math.abs(value) < minThreshold || Math.abs(value) > maxThreshold) return 0;
    return value;
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  async getConsumptionData(dto: GetEnergyCostDto) {
    const { start_date, end_date, start_time, end_time, suffixes } = dto;
    const area = dto.area ?? '';
    const isAll = area === 'ALL';
    const areasToProcess = isAll ? ['Unit_4', 'Unit_5'] : [area];

    const additionalTags = {
      Unit_4: [],
      Unit_5: [],
    };

    const TZ = 'Asia/Karachi';
    let start: moment.Moment;
    let end: moment.Moment;

    if (start_time && end_time) {
      start = moment.tz(`${start_date} ${start_time}`, 'YYYY-MM-DD HH:mm', TZ).startOf('minute');
      end = moment.tz(`${end_date} ${end_time}`, 'YYYY-MM-DD HH:mm', TZ).endOf('minute');
      // console.log(start, "if condition")
      // console.log(end, "end condition")
      if (end.isSameOrBefore(start)) end.add(1, 'day');
    } else {
      // Default: 6:00 AM to next day 6:00 AM
      start = moment.tz(start_date, TZ).hour(6).minute(0).second(0).millisecond(0);
      end = start.clone().add(1, 'day');
      // console.log(start, "else condition")
    }

    const startISO = start.format('YYYY-MM-DDTHH:mm:ss.SSSZ');
    const endISO = end.format('YYYY-MM-DDTHH:mm:ss.SSSZ');
    // console.log(startISO, "start")
    // console.log(endISO, "end")

    // ✅ Collect all meterIds
    const allMeterIds = new Set<string>();
    for (const areaKey of areasToProcess) {
      this.getMeterIdsForArea(areaKey).forEach(id => allMeterIds.add(id));
      (additionalTags[areaKey] || []).forEach(id => allMeterIds.add(id));

      // ✅ Include special meters
      if (areaKey === 'Unit_4') {
        allMeterIds.add('U27_PLC'); // wapda2
        allMeterIds.add('U22_PLC'); // nigatta
        allMeterIds.add('U26_PLC'); // jms
        allMeterIds.add('U19_PLC'); // diesel jgs incoming lt1
        allMeterIds.add('U11_GW01'); // diesel jgs incoming lt2
      }

      if (areaKey === 'Unit_5') {
        allMeterIds.add('U27_PLC');
        allMeterIds.add('U22_PLC');
        allMeterIds.add('U26_PLC');

        // ✅ Add transformer meters (always for Unit_5 loss calculation)
        allMeterIds.add('U23_GW01');
        allMeterIds.add('U22_GW01');
        allMeterIds.add('U20_GW03');
        allMeterIds.add('U19_GW03');
      }

      // ✅ Shared meters for ALL should NOT include transformer meters
      if (area === 'ALL') {
        allMeterIds.add('U27_PLC');
        allMeterIds.add('U22_PLC');
        allMeterIds.add('U26_PLC');
      }
    }

    const projectionFields: Record<string, number> = { timestamp: 1 };
    for (const meterId of allMeterIds) {
      for (const suffix of suffixes) {
        projectionFields[`${meterId}_${suffix}`] = 1;
      }
    }

    const allData = await this.costModel
      .aggregate([
        { $match: { timestamp: { $gte: start.toISOString(true), $lte: end.toISOString(true) } } },
        { $project: projectionFields },
        { $sort: { timestamp: 1 } },
      ])
      .exec();
    // console.log(allData)

    const groupedData: Record<string, { first?: number; last?: number }> = {};
    for (const doc of allData) {
      // Create a "day start" shifted by 6 hours (6AM start)
      const m = moment.tz(doc.timestamp, TZ);
      const customDayStart = m.clone().subtract(6, 'hours');
      const date = customDayStart.format('YYYY-MM-DD'); // this becomes the "6am day"
      for (const key of Object.keys(doc)) {
        if (key === 'timestamp') continue;
        const uniqueKey = `${date}_${key}`;
        const val = this.sanitizeValue(doc[key]);
        if (!groupedData[uniqueKey]) groupedData[uniqueKey] = { first: val, last: val };
        else groupedData[uniqueKey].last = val;
      }
      // console.log(doc.timestamp, '=> grouped as', date);
    }
    // console.log(groupedData)



    const trafoTags = {
      in: [
        'U23_GW01_Del_ActiveEnergy',
        'U22_GW01_Del_ActiveEnergy',
        'U20_GW03_Del_ActiveEnergy',
        'U19_GW03_Del_ActiveEnergy',
      ],
      out: [
        'U21_PLC_Del_ActiveEnergy',
        'U13_GW01_Del_ActiveEnergy',
        'U13_GW02_Del_ActiveEnergy',
        'U16_GW03_Del_ActiveEnergy',
      ],
    };

    const mergedResult: any = {
      area,
      unit4_consumption: 0,
      unit5_consumption: 0,
      wapdaic: 0,
      wapda2: 0,
      nigatta: 0,
      jms: 0,
      dieseljgsincomminglt1: 0,
      dieseljgsincomminglt2: 0,
      wapdaexport: 0,
      solar1: 0,
      solar2: 0,
      solarunit4: 0,
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
        const allIds = [
          ...new Set([
            ...meterIds,
            ...extraIds,
            ...(unitArea === 'Unit_4'
              ? ['U27_PLC', 'U22_PLC', 'U26_PLC', 'U19_PLC', 'U11_GW01']
              : unitArea === 'Unit_5'
                ? ['U27_PLC', 'U22_PLC', 'U26_PLC']
                : []),
          ]),
        ];

        let dailyTotal = 0;
        let solar1 = 0,
          solar2 = 0;
        let wapdaic = 0,
          wapda2 = 0,
          wapdaexport = 0;
        let solarunit4 = 0;
        let trafo1Loss = 0,
          trafo2Loss = 0,
          trafo3Loss = 0,
          trafo4Loss = 0;

        const getValue = (tag: string) => {
          const key = `${dateStr}_${tag}`;
          const pair = groupedData[key];
          return pair?.first !== undefined && pair?.last !== undefined
            ? this.sanitizeValue(pair.last - pair.first)
            : 0;
        };


        for (const meterId of allIds) {
          // ✅ Skip shared meters during second iteration (Unit_5) when area = ALL
          if (area === 'ALL' && unitArea === 'Unit_5' && ['U27_PLC', 'U22_PLC', 'U26_PLC'].includes(meterId)) {
            continue;
          }
          for (const suffix of suffixes) {
            const key = `${dateStr}_${meterId}_${suffix}`;
            const pair = groupedData[key];
            if (!pair || pair.first === undefined || pair.last === undefined) continue;

            // Fallback: use next day's first reading if last == first
            let effectiveLast = pair.last;
            if (pair.last === pair.first) {
              const nextDay = moment(dateStr).add(1, 'day').format('YYYY-MM-DD');
              const nextKey = `${nextDay}_${meterId}_${suffix}`;
              const nextPair = groupedData[nextKey];
              if (nextPair && nextPair.first !== undefined) {
                effectiveLast = nextPair.first;
              }
            }

            const consumption = this.sanitizeValue(effectiveLast - pair.first);
            // console.log(meterId)
            // console.log(pair.first)
            // console.log(pair.last)
            // console.log(consumption)
            // ✅ wapdaic / Export
            if (unitArea === 'Unit_4' && meterId === 'U23_GW01') {
              if (suffix === 'ActiveEnergy_Exp_kWh') wapdaexport += consumption;
              else wapdaic += consumption;
            }

            // ✅ Solar Unit 4
            if (unitArea === 'Unit_4' && meterId === 'U24_GW01') solarunit4 += consumption;

            // ✅ WAPDA2
            if ((unitArea === 'Unit_4' || unitArea === 'Unit_5') && meterId === 'U27_PLC') {
              mergedResult.wapda2 += consumption;
              continue;
            }

            // ✅ Nigatta
            if ((unitArea === 'Unit_4' || unitArea === 'Unit_5') && meterId === 'U22_PLC') {
              mergedResult.nigatta += consumption;
              continue;
            }

            // ✅ JMS
            if ((unitArea === 'Unit_4' || unitArea === 'Unit_5') && meterId === 'U26_PLC') {
              mergedResult.jms += consumption;
              continue;
            }

            // ✅ Diesel JGS Incoming LT1
            if (unitArea === 'Unit_4' && meterId === 'U19_PLC') {
              mergedResult.dieseljgsincomminglt1 += consumption;
              continue;
            }

            // ✅ Diesel JGS Incoming LT2
            if (unitArea === 'Unit_4' && meterId === 'U11_GW01') {
              mergedResult.dieseljgsincomminglt2 += consumption;
              continue;
            }

            // ✅ Regular consumption (exclude transformer inputs)
            const isTrafoInput =
              meterId === 'U23_GW01' ||
              meterId === 'U22_GW01' ||
              meterId === 'U20_GW03' ||
              meterId === 'U19_GW03';

            if (!isTrafoInput) {
              dailyTotal += consumption;
            }

            // ✅ Unit 5 Solar
            if (unitArea === 'Unit_5') {
              if (meterId === 'U6_GW02') solar1 += consumption;
              if (meterId === 'U17_GW03') solar2 += consumption;
            }
          }
        }

        if (unitArea === 'Unit_5') {
          trafo1Loss = getValue(trafoTags.in[0]) - getValue(trafoTags.out[0]);
          trafo2Loss = getValue(trafoTags.in[1]) - getValue(trafoTags.out[1]);
          trafo3Loss = getValue(trafoTags.in[2]) - getValue(trafoTags.out[2]);
          trafo4Loss = getValue(trafoTags.in[3]) - getValue(trafoTags.out[3]);
        }

        const transformerLosses = this.sanitizeValue(
          trafo1Loss + trafo2Loss + trafo3Loss + trafo4Loss,
        );
        const totalGeneration = this.sanitizeValue(solar1 + solar2);

        if (unitArea === 'Unit_4') mergedResult.unit4_consumption += this.round2(dailyTotal);
        if (unitArea === 'Unit_5') mergedResult.unit5_consumption += this.round2(dailyTotal);

        mergedResult.wapdaic += this.round2(wapdaic);
        mergedResult.wapda2 += this.round2(wapda2);
        mergedResult.wapdaexport += this.round2(wapdaexport);
        mergedResult.solarunit4 += this.round2(solarunit4);
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

    mergedResult.start_time = startISO;
    mergedResult.end_time = endISO;

    if (area === 'Unit_4') {
      mergedResult.total_consumption = mergedResult.unit4_consumption;
      mergedResult.total_generation = this.round2(mergedResult.wapdaic + mergedResult.wapda2 + mergedResult.nigatta + mergedResult.jms + mergedResult.dieseljgsincomminglt1 + mergedResult.dieseljgsincomminglt2);
    } else if (area === 'Unit_5') {
      mergedResult.total_consumption = mergedResult.unit5_consumption;
      mergedResult.total_generation = this.round2(mergedResult.solar1 + mergedResult.solar2 + mergedResult.wapda2 + mergedResult.nigatta + mergedResult.jms);
    } else if (area === 'ALL') {
      mergedResult.total_consumption = this.round2(
        mergedResult.unit4_consumption + mergedResult.unit5_consumption,
      );
      mergedResult.total_generation = this.round2(
        mergedResult.wapdaic + mergedResult.solar1 + mergedResult.solar2 + mergedResult.wapda2 + mergedResult.nigatta + mergedResult.jms + mergedResult.dieseljgsincomminglt1 + mergedResult.dieseljgsincomminglt2,
      );
    }

    mergedResult.unaccountable_energy = this.round2(
      mergedResult.total_generation - mergedResult.total_consumption,
    );

    const fieldsToKeep =
      area === 'Unit_4'
        ? [
          'start_time',
          'end_time',
          'area',
          'unit4_consumption',
          'total_consumption',
          'wapdaic',
          'wapda2',
          'nigatta',
          'jms',
          'dieseljgsincomminglt1',
          'dieseljgsincomminglt2',
          'wapdaexport',
          'solarunit4',
          'total_generation',
          'unaccountable_energy',
        ]
        : area === 'Unit_5'
          ? [
            'start_time',
            'end_time',
            'area',
            'unit5_consumption',
            'total_consumption',
            'wapda2',
            'nigatta',
            'jms',
            'solar1',
            'solar2',
            'trafo1Loss',
            'trafo2Loss',
            'trafo3Loss',
            'trafo4Loss',
            'transformerLosses',
            'total_generation',
            'unaccountable_energy',
          ]
          : [
            'start_time',
            'end_time',
            'area',
            'unit4_consumption',
            'unit5_consumption',
            'total_consumption',
            'wapdaic',
            'wapda2',
            'nigatta',
            'jms',
            'dieseljgsincomminglt1',
            'dieseljgsincomminglt2',
            'wapdaexport',
            'solar1',
            'solar2',
            'solarunit4',
            'trafo1Loss',
            'trafo2Loss',
            'trafo3Loss',
            'trafo4Loss',
            'transformerLosses',
            'total_generation',
            'unaccountable_energy',
          ];

    const finalResult = {
      area: mergedResult.area,
      start_time: startISO,
      end_time: endISO,
      ...Object.fromEntries(
        Object.entries(mergedResult).filter(([key]) => fieldsToKeep.includes(key)),
      ),
    };

    return [finalResult];
  }
}

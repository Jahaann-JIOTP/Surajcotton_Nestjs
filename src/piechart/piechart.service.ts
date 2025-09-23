// src/pie-chart/pie_chart.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PieChart } from './schemas/pie-chart.schema';
import * as moment from 'moment-timezone';

@Injectable()
export class PieChartService {
  constructor(
    @InjectModel('PieChart', 'surajcotton')
    private readonly pieChartModel: Model<PieChart>,
  ) {}

  async fetchData(startTimestamp: number, endTimestamp: number) {
    try {
      // -----------------------------
      // 6 AM boundaries (Asia/Karachi)
      // -----------------------------
      const startOfDay = moment
        .unix(startTimestamp)
        .tz('Asia/Karachi')
        .startOf('day')
        .add(6, 'hours'); // ✅ always 6:00 AM

      let endOfDay: moment.Moment;

      if (
        moment.unix(startTimestamp).tz('Asia/Karachi').format('YYYY-MM-DD') ===
        moment.unix(endTimestamp).tz('Asia/Karachi').format('YYYY-MM-DD')
      ) {
        // 👉 Same date → next day 06:00:59.999
        endOfDay = startOfDay.clone().add(1, 'day').hour(6).minute(0).second(59).millisecond(999);
      } else {
        // 👉 Multiple dates → endDate ke din ka 06:00:59.999
        endOfDay = moment
          .unix(endTimestamp)
          .tz('Asia/Karachi')
          .startOf('day')
          .add(6, 'hours')
          .second(59)
          .millisecond(999);
      }

      const startUnix = startOfDay.unix();
      const endUnix = endOfDay.unix();

      // console.log('📌 Input startTimestamp:', startTimestamp);
      // console.log('📌 Input endTimestamp  :', endTimestamp);
      // console.log(
      //   '🕕 Query Start (6AM)     :',
      //   startOfDay.format('YYYY-MM-DD HH:mm:ss'),
      //   '(',
      //   startUnix,
      //   ')',
      // );
      // console.log(
      //   '🕕 Query End (next 6AM)  :',
      //   endOfDay.format('YYYY-MM-DD HH:mm:ss'),
      //   '(',
      //   endUnix,
      //   ')',
      // );

      // -----------------------------
      // Query DB
      // -----------------------------
      const data = await this.pieChartModel
        .find({ UNIXtimestamp: { $gte: startUnix, $lte: endUnix } })
        .select(
          'UNIXtimestamp U19_PLC_Del_ActiveEnergy U11_GW01_Del_ActiveEnergy ' +
            'U6_GW02_Del_ActiveEnergy U17_GW03_Del_ActiveEnergy ' +
            'U23_GW01_Del_ActiveEnergy U27_PLC_Del_ActiveEnergy ' +
            'U22_PLC_Del_ActiveEnergy U26_PLC_Del_ActiveEnergy',
        )
        .sort({ UNIXtimestamp: 1 })
        .lean()
        .exec();

      // console.log('📊 Docs found:', data.length);
      if (data.length) {
        // console.log(
        //   '🔍 First doc time:',
        //   moment.unix(data[0].UNIXtimestamp).tz('Asia/Karachi').format('YYYY-MM-DD HH:mm:ss'),
        // );
        // console.log(
        //   '🔍 Last doc time :',
        //   moment.unix(data[data.length - 1].UNIXtimestamp).tz('Asia/Karachi').format('YYYY-MM-DD HH:mm:ss'),
        // );
      }

      if (data.length === 0) {
        return [
          {
            category: 'No Data',
            total: 0,
            color: '#cccccc',
            subData: [],
          },
        ];
      }

      // -----------------------------
      // Helper functions
      // -----------------------------
      const ABS_LIM = 1e10;
      const TINY_LIM = 1e-5;
      const MAX_DIFF = 1e6;

      const clean = (n: unknown): number => {
        const v = typeof n === 'string' ? parseFloat(n) : (n as number);
        if (!Number.isFinite(v) || Number.isNaN(v)) return 0;
        return v;
      };

      const applyDiffRules = (diff: number): number => {
        const s = diff.toString();
        if (
          s.includes('e+') ||
          s.includes('e-') ||
          Math.abs(diff) > ABS_LIM ||
          (Math.abs(diff) < TINY_LIM && diff !== 0)
        ) {
          return 0;
        }
        if (Math.abs(diff) > MAX_DIFF) return 0;
        return diff;
      };

      const getConsumption = (arr: number[], key: string): number => {
        if (arr.length < 2) return 0;
        const first = clean(arr[0]);
        const last = clean(arr[arr.length - 1]);
        let diff = last - first;

        // console.log(`⚡ ${key}: first=${first}, last=${last}, diff=${diff}`);

        diff = applyDiffRules(diff);
        // console.log(`✅ ${key}: final consumption=${diff}`);
        return +diff.toFixed(2);
      };

      // -----------------------------
      // Groups
      // -----------------------------
      const LTGenerationKeys = ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'];
      const SolarGenerationKeys = ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];
      const WapdaImportKeys = ['U23_GW01_Del_ActiveEnergy', 'U27_PLC_Del_ActiveEnergy'];
      const HTGenerationKeys = ['U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy'];

      const buildConsumptionArray = (tag: string) =>
        data
          .map((doc) => (doc as any)[tag])
          .filter((v) => typeof v === 'number' || typeof v === 'string')
          .map((v) => clean(v));

      const mapSubData = (keys: string[]) => {
        const subData = keys.map((key) => {
          const arr = buildConsumptionArray(key);
          if (!arr.length) {
            // console.log(`❌ ${key}: no values found in range`);
            return { name: key, value: 0 };
          }
          const consumption = getConsumption(arr, key);
          return { name: key, value: +consumption.toFixed(2) };
        });

        const rawSum = subData.reduce((sum, item) => sum + item.value, 0);
        const groupSum = +applyDiffRules(rawSum).toFixed(2);
        // console.log(`📦 Group total (${keys.join(',')}): ${groupSum}`);
        return { subData, groupSum };
      };

      // -----------------------------
      // Final build
      // -----------------------------
      const { subData: ltSubData, groupSum: ltTotal } = mapSubData(LTGenerationKeys);
      const { subData: solarSubData, groupSum: solarTotal } = mapSubData(SolarGenerationKeys);
      const { subData: wapdaSubData, groupSum: wapdaTotal } = mapSubData(WapdaImportKeys);
      const { subData: htSubData, groupSum: htTotal } = mapSubData(HTGenerationKeys);

      return [
        { category: 'LT Generation', total: ltTotal, color: '#2980b9', subData: ltSubData },
        { category: 'Solar Generation', total: solarTotal, color: '#e67f22', subData: solarSubData },
        { category: 'WAPDA Import', total: wapdaTotal, color: '#27ae60', subData: wapdaSubData },
        { category: 'HT Generation', total: htTotal, color: '#8e44ad', subData: htSubData },
      ];
    } catch (error: any) {
      console.error('❌ Error while fetching data from MongoDB:', error?.message || error);
      throw new Error('Error while fetching data from MongoDB: ' + (error?.message || error));
    }
  }
}

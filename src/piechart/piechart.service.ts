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
      // Asia/Karachi day bounds
      const startOfDay = moment.unix(startTimestamp).tz('Asia/Karachi').startOf('day').unix();
      const endOfDay   = moment.unix(endTimestamp).tz('Asia/Karachi').endOf('day').unix();

      // Query
      const data = await this.pieChartModel
        .find({ UNIXtimestamp: { $gte: startOfDay, $lte: endOfDay } })
        .select(
          'U19_PLC_Del_ActiveEnergy U11_GW01_Del_ActiveEnergy ' +
          'U6_GW02_Del_ActiveEnergy U17_GW03_Del_ActiveEnergy ' +
          'U22_GW01_Del_ActiveEnergy U27_PLC_Del_ActiveEnergy ' +
          'U22_PLC_Del_ActiveEnergy U26_PLC_Del_ActiveEnergy',
        )
        .sort({ UNIXtimestamp: 1 })
        .exec();

      if (data.length === 0) {
        return [{
          category: 'No Data',
          total: 0,
          color: '#cccccc',
          subData: [],
        }];
      }

      // -----------------------------
      // Sanitize helpers
      // -----------------------------
      const SCI_RE   = /e[+-]?\d+$/i;
      const ABS_LIM  = 1e10;     // matches your condition
      const TINY_LIM = 1e-5;     // matches your condition
      const MAX_DIFF = 1e6;      // ← cap big jumps like 1,858,745; set to Infinity to disable

      const clean = (n: unknown): number => {
        const v = typeof n === 'string' ? parseFloat(n) : (n as number);
        if (!Number.isFinite(v) || Number.isNaN(v)) return 0;
        return v;
      };

      // Your exact diff checks + optional spike cap
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
        if (Math.abs(diff) > MAX_DIFF) return 0; // handle 1858745-type spikes
        return diff;
      };

      // last - first with your rules
      const getConsumption = (arr: number[]): number => {
        if (arr.length < 2) return 0;
        const first = clean(arr[0]);
        const last  = clean(arr[arr.length - 1]);
        let diff    = last - first;

        diff = applyDiffRules(diff);
        return +diff.toFixed(2);
      };

      // Groups
      const LTGenerationKeys = [
        'U19_PLC_Del_ActiveEnergy',
        'U11_GW01_Del_ActiveEnergy',
      ];
      const SolarGenerationKeys = [
        'U6_GW02_Del_ActiveEnergy',
        'U17_GW03_Del_ActiveEnergy',
      ];
      const WapdaImportKeys = [
        'U22_GW01_Del_ActiveEnergy',
        'U27_PLC_Del_ActiveEnergy',
      ];
      const HTGenerationKeys = [
        'U22_PLC_Del_ActiveEnergy',
        'U26_PLC_Del_ActiveEnergy',
      ];

      const buildConsumptionArray = (tag: string) =>
        data
          .map((doc) => (doc as any)[tag])
          .filter((v) => typeof v === 'number' || typeof v === 'string')
          .map((v) => clean(v));

      const mapSubData = (keys: string[]) => {
        const subData = keys.map((key) => {
          const arr = buildConsumptionArray(key);
          if (!arr.length) return { name: key, value: 0 };
          const consumption = getConsumption(arr);
          return { name: key, value: +consumption.toFixed(2) };
        });

        const rawSum = subData.reduce((sum, item) => sum + item.value, 0);
        const groupSum = +applyDiffRules(rawSum).toFixed(2);
        return { subData, groupSum };
      };

      const { subData: ltSubData,    groupSum: ltTotal }    = mapSubData(LTGenerationKeys);
      const { subData: solarSubData, groupSum: solarTotal } = mapSubData(SolarGenerationKeys);
      const { subData: wapdaSubData, groupSum: wapdaTotal } = mapSubData(WapdaImportKeys);
      const { subData: htSubData,    groupSum: htTotal }    = mapSubData(HTGenerationKeys);

      return [
        { category: 'LT Generation',   total: ltTotal,    color: '#2980b9', subData: ltSubData },
        { category: 'Solar Generation', total: solarTotal, color: '#e67f22', subData: solarSubData },
        { category: 'WAPDA Import',    total: wapdaTotal, color: '#27ae60', subData: wapdaSubData },
        { category: 'HT Generation',   total: htTotal,    color: '#8e44ad', subData: htSubData },
      ];
    } catch (error: any) {
      console.error('Error while fetching data from MongoDB:', error?.message || error);
      throw new Error('Error while fetching data from MongoDB: ' + (error?.message || error));
    }
  }
}

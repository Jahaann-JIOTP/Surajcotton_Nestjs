// src/pie-chart/pie_chart.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PieChart } from './schemas/pie-chart.schema';

@Injectable()
export class PieChartService {
  constructor(
    @InjectModel('PieChart', 'surajcotton')
    private readonly pieChartModel: Model<PieChart>,
  ) {}

  async fetchData(startTimestamp: number, endTimestamp: number) {
  try {
    if (endTimestamp <= startTimestamp) {
      return [
        { category: 'No Data', total: 0, color: '#cccccc', subData: [] },
      ];
    }

    const data = await this.pieChartModel
      .find({
        UNIXtimestamp: {
          $gte: startTimestamp,
          $lte: endTimestamp,
        },
      })
      .select(
        'UNIXtimestamp ' +
          'U19_PLC_Del_ActiveEnergy ' +
          'U11_GW01_Del_ActiveEnergy ' +
          'U6_GW02_Del_ActiveEnergy ' +
          'U17_GW03_Del_ActiveEnergy ' +
          'U24_GW01_Del_ActiveEnergy ' +
          'U23_GW01_Del_ActiveEnergy ' +
          'U27_PLC_Del_ActiveEnergy ' +
          'U22_PLC_Del_ActiveEnergy ' +
          'U26_PLC_Del_ActiveEnergy ' +
          'U28_PLC_Del_ActiveEnergy'
      )
      .sort({ UNIXtimestamp: 1 })
      .lean()
      .exec();

    if (!data.length) {
      return [
        { category: 'No Data', total: 0, color: '#cccccc', subData: [] },
      ];
    }

    // ✅ Log first and last document
    console.log('First document:', data[0]);
    console.log('Last document:', data[data.length - 1]);

    // --- rest of your code remains the same ---
    const clean = (n: unknown): number => {
      const v = typeof n === 'string' ? parseFloat(n) : (n as number);
      return Number.isFinite(v) ? v : 0;
    };

    const getConsumption = (arr: number[]) => {
      if (arr.length < 2) return 0;
      return +(arr[arr.length - 1] - arr[0]).toFixed(2);
    };

    const buildArr = (tag: string) =>
      data.map((d: any) => clean(d[tag])).filter((v) => v !== 0);

    const buildGroup = (keys: string[]) => {
      const subData = keys.map((k) => ({
        name: k,
        value: getConsumption(buildArr(k)),
      }));
      const total = +subData.reduce((s, x) => s + x.value, 0).toFixed(2);
      return { subData, total };
    };

    const LT = buildGroup(['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy']);
    const Solar = buildGroup([
      'U6_GW02_Del_ActiveEnergy',
      'U17_GW03_Del_ActiveEnergy',
      'U24_GW01_Del_ActiveEnergy',
      'U28_PLC_Del_ActiveEnergy',
    ]);
    const Wapda = buildGroup(['U23_GW01_Del_ActiveEnergy', 'U27_PLC_Del_ActiveEnergy']);
    const HT = buildGroup(['U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy']);

    return [
      { category: 'LT Generation', total: LT.total, color: '#2980b9', subData: LT.subData },
      { category: 'Solar Generation', total: Solar.total, color: '#e67f22', subData: Solar.subData },
      { category: 'Wapda Import', total: Wapda.total, color: '#27ae60', subData: Wapda.subData },
      { category: 'HT Generation', total: HT.total, color: '#8e44ad', subData: HT.subData },
    ];
  } catch (error: any) {
    console.error('❌ PieChart error:', error?.message || error);
    throw error;
  }
}
}

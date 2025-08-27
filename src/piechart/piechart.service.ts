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
      const data = await this.pieChartModel
        .find({
          UNIXtimestamp: { $gt: startTimestamp, $lte: endTimestamp },
        })
        .select(
          'U19_PLC_Del_ActiveEnergy U21_PLC_Del_ActiveEnergy ' +
          'U6_GW02_Del_ActiveEnergy U17_GW03_Del_ActiveEnergy ' +
          'U23_GW01_Del_ActiveEnergy U20_GW03_Del_ActiveEnergy ' +
          'U21_GW03_Del_ActiveEnergy U7_GW01_Del_ActiveEnergy',
        )
        .exec();

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

      const getConsumption = (arr: number[]): number =>
        arr.length > 1 ? arr[arr.length - 1] - arr[0] : 0;

      // Define tag groups
      const LTGenerationKeys = ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'];
      const SolarGenerationKeys = ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];
      const WapdaImportKeys = ['U22_GW01_ActiveEnergy_Imp_kWh', 'U27_PLC_ActiveEnergy_Imp_kWh'];
      const HTGenerationKeys = ['U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy'];

      // Utility to build and filter consumption arrays
   // Utility to build and filter consumption arrays
const buildConsumptionArray = (tag: string) =>
  data.map((doc) => doc[tag]).filter((v) => typeof v === 'number');

// Helper to map and format values
const mapSubData = (keys: string[]) =>
  keys.map((key) => {
    const arr = buildConsumptionArray(key);
    const value = getConsumption(arr);
    return { name: key, value: +value.toFixed(2) };
  });

// LT Generation
const ltSubData = mapSubData(LTGenerationKeys);
const ltTotal = +ltSubData.reduce((sum, item) => sum + item.value, 0).toFixed(2);

// Solar Generation
const solarSubData = mapSubData(SolarGenerationKeys);
const solarTotal = +solarSubData.reduce((sum, item) => sum + item.
value, 0).toFixed(2);

// WAPDA Import
const wapdaSubData = mapSubData(WapdaImportKeys);
const wapdaTotal = +wapdaSubData.reduce((sum, item) => sum + item.value, 0).toFixed(2);

// HT Generation
const htSubData = mapSubData(HTGenerationKeys);
const htTotal = +htSubData.reduce((sum, item) => sum + item.value, 0).toFixed(2);

      // Final response
      return [
        {
          category: 'LT Generation',
          total: ltTotal,
          color: '#2980b9',
          subData: ltSubData,
        },
        {
          category: 'Solar Generation',
          total: solarTotal,
          color: '#e67f22',
          subData: solarSubData,
        },
        {
          category: 'WAPDA Import',
          total: wapdaTotal,
          color: '#27ae60',
          subData: wapdaSubData,
        },
        {
          category: 'HT Generation',
          total: htTotal,
          color: '#8e44ad',
          subData: htSubData,
        },
      ];
    } catch (error) {
      console.error('Error while fetching data from MongoDB:', error.message);
      throw new Error('Error while fetching data from MongoDB: ' + error.message);
    }
  }
}

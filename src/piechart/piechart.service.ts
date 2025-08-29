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
      // ✅ Convert start/end to Pakistan timezone (Asia/Karachi)
      const startOfDay = moment
        .unix(startTimestamp) // jo bhi tum timestamp bhejo, usko base banao
        .tz('Asia/Karachi')
        .startOf('day')
        .unix(); // UNIX seconds

      const endOfDay = moment
        .unix(endTimestamp)
        .tz('Asia/Karachi')
        .endOf('day')
        .unix();

      // ✅ Query MongoDB with corrected timestamps
      const data = await this.pieChartModel
        .find({
          UNIXtimestamp: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        })
        .select(
          'U19_PLC_Del_ActiveEnergy U11_GW01_Del_ActiveEnergy ' +
            'U6_GW02_Del_ActiveEnergy U17_GW03_Del_ActiveEnergy ' +
            'U22_GW01_Del_ActiveEnergy U27_PLC_Del_ActiveEnergy ' +
            'U22_PLC_Del_ActiveEnergy U26_PLC_Del_ActiveEnergy',
        )
        .sort({ UNIXtimestamp: 1 }) // ✅ first → last
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

      // ✅ Consumption calc
      const getConsumption = (arr: number[]): number => {
        if (arr.length < 2) return 0;
        return arr[arr.length - 1] - arr[0];
      };

      // Tags grouping
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

      // Utility: build consumption array
      const buildConsumptionArray = (tag: string) =>
        data.map((doc) => doc[tag]).filter((v) => typeof v === 'number');

      // Utility: map subData
      const mapSubData = (keys: string[]) => {
        const subData = keys.map((key) => {
          const arr = buildConsumptionArray(key);

          if (arr.length > 0) {
            const first = arr[0];
            const last = arr[arr.length - 1];
            const consumption = getConsumption(arr);

            console.log(
              `🔍 Tag: ${key}, First: ${first}, Last: ${last}, Subtraction: ${consumption}, Count: ${arr.length}`,
            );

            return { name: key, value: +consumption.toFixed(2) };
          } else {
            console.log(`⚠️ Tag: ${key}, No values found`);
            return { name: key, value: 0 };
          }
        });

        const groupSum = +subData
          .reduce((sum, item) => sum + item.value, 0)
          .toFixed(2);

        console.log(
          `✅ Group Keys: [${keys.join(
            ', ',
          )}] => Group Total (Sum of meters): ${groupSum}`,
        );

        return { subData, groupSum };
      };

      // LT Generation
      const { subData: ltSubData, groupSum: ltTotal } =
        mapSubData(LTGenerationKeys);

      // Solar Generation
      const { subData: solarSubData, groupSum: solarTotal } =
        mapSubData(SolarGenerationKeys);

      // WAPDA Import
      const { subData: wapdaSubData, groupSum: wapdaTotal } =
        mapSubData(WapdaImportKeys);

      // HT Generation
      const { subData: htSubData, groupSum: htTotal } =
        mapSubData(HTGenerationKeys);

      // ✅ Final response
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
      throw new Error(
        'Error while fetching data from MongoDB: ' + error.message,
      );
    }
  }
}

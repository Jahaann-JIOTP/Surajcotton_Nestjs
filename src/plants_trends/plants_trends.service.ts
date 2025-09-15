// src/plants_trends/plants_trends.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Historical } from './schemas/historical.schema';
import { getTrends } from './utils/trends.utils';

@Injectable()
export class PlantsTrendsService {
  constructor(
    @InjectModel(Historical.name, 'surajcotton')
    private readonly historicalModel: Model<Historical>,
  ) {}

  private formatData(data: any[], type?: string) {
    switch (type) {
      case 'energy':
        return data.map(d => ({
          timestamp: d.timestamp,
          consumption: d.consumption,
          sumEnergy: d.sumEnergy,
        }));
      case 'activePower':
        return data.map(d => ({
          timestamp: d.timestamp,
          sumActivePower: d.sumActivePower,
        }));
      case 'current':
        return data.map(d => ({
          timestamp: d.timestamp,
          sumCurrent: d.sumCurrent,
        }));
      case 'voltage':
        return data.map(d => ({
          timestamp: d.timestamp,
          sumVoltage: d.sumVoltage,
        }));
      case 'recEnergy':
        return data.map(d => ({
          timestamp: d.timestamp,
          sumRecEnergy: d.sumRecEnergy,
        }));
      case 'powerfactor':
        return data.map(d => ({
          timestamp: d.timestamp,
          sumpowerfactor: d.sumpowerfactor,
        }));
      case 'harmonics':
        return data.map(d => ({
          timestamp: d.timestamp,
          sumHarmonics: d.sumHarmonics,
        }));
      default:
        return data; // agar type na bheje to pura return karega
    }
  }

  async getPlantsTrends(startDate: string, endDate: string, type?: string) {
    const meters = [
      'U19_PLC',
      'U11_GW01',
      'U6_GW02',
      'U17_GW03',
      'U22_PLC',
      'U26_PLC',
      'U22_GW01',
      'U27_PLC',
    ];
    const data = await getTrends({
      startDate,
      endDate,
      meters,
      model: this.historicalModel,
    });
    return this.formatData(data, type);
  }

  async getUnit4LT1Trends(startDate: string, endDate: string, type?: string) {
    const meters = ['U19_PLC', 'U21_PLC'];
    const data = await getTrends({
      startDate,
      endDate,
      meters,
      model: this.historicalModel,
    });
    return this.formatData(data, type);
  }

  async getUnit4LT2Trends(startDate: string, endDate: string, type?: string) {
    const meters = ['U13_GW01', 'U7_GW01'];
    const data = await getTrends({
      startDate,
      endDate,
      meters,
      model: this.historicalModel,
    });
    return this.formatData(data, type);
  }

async getUnit5LT1Trends(startDate: string, endDate: string, type?: string) {
  const meters = ['U13_GW02', 'U6_GW02'];
  const data = await getTrends({
    startDate,
    endDate,
    meters,
    model: this.historicalModel,
  });
  console.log("Raw Unit5-LT1 Data:", JSON.stringify(data, null, 2));
  return this.formatData(data, type);
}


  async getUnit5LT2Trends(startDate: string, endDate: string, type?: string) {
    const meters = ['U16_GW03', 'U17_GW03'];
    const data = await getTrends({
      startDate,
      endDate,
      meters,
      model: this.historicalModel,
    });
    return this.formatData(data, type);
  }
}

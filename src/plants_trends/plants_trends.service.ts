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

   async getplants(startDate: string, endDate: string) {
    const meters = ['U19_PLC', 'U11_GW01', 'U6_GW02', 'U17_GW03', 'U22_PLC', 'U26_PLC', 'U22_GW01', 'U27_PLC'];
    return getTrends({ startDate, endDate, meters, model: this.historicalModel });
  }

  async getUnit4LT1Trends(startDate: string, endDate: string) {
    const meters = ['U19_PLC', 'U21_PLC'];
    return getTrends({ startDate, endDate, meters, model: this.historicalModel });
  }

  async getUnit4LT2Trends(startDate: string, endDate: string) {
    const meters = ['U13_GW01', 'U7_GW01']; // LT2 meter IDs
    return getTrends({ startDate, endDate, meters, model: this.historicalModel });
  }

    async getUnit5LT1Trends(startDate: string, endDate: string) {
    const meters = ['U13_GW02', 'U6_GW02']; // LT2 meter IDs
    return getTrends({ startDate, endDate, meters, model: this.historicalModel });
  }

      async getUnit5LT2Trends(startDate: string, endDate: string) {
    const meters = ['U16_GW03', 'U17_GW03']; // LT2 meter IDs
    return getTrends({ startDate, endDate, meters, model: this.historicalModel });
  }


}


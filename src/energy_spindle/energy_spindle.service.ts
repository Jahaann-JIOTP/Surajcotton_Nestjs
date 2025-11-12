// src/energy-spindle/energy_spindle.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { DailyProduction, DailyProductionDocument } from './schemas/daily_production.schema';
import { GetSpindleDto } from './dto/get-spindle.dto';


@Injectable()
export class EnergySpindleService {
  constructor(
    @InjectModel(DailyProduction.name, 'surajcotton') // DB: surajcotton
    private readonly dailyProductionModel: Model<DailyProductionDocument>,
  ) {}
  
  

async getProductionByDate(dto: GetSpindleDto) {
  const { start_date, end_date, unit } = dto;

  const start = moment(start_date, 'YYYY-MM-DD');
  const end = moment(end_date, 'YYYY-MM-DD');
  const isSingleDay = start.isSame(end, 'day');

  const unitsToQuery = unit === 'ALL' ? ['U4', 'U5'] : [unit];

  if (isSingleDay) {
    // Return daily breakdown
    const result = await this.dailyProductionModel.aggregate([
      {
        $match: {
          unit: { $in: unitsToQuery },
          date: start_date,
        },
      },
      {
        $group: {
          _id: '$date',
          totalProduction: { $sum: '$value' },
          totalAvgCount: { $sum: '$avgcount' }, // ✅ correct field
        },
      },
    ]);

    return result.map((item) => ({
      date: item._id,
      unit,
      totalProduction: item.totalProduction,
      avgcount: item.totalAvgCount, // ✅ correct mapping
    }));
  } else {
    // Return total production sum across range
    const result = await this.dailyProductionModel.aggregate([
      {
        $match: {
          unit: { $in: unitsToQuery },
          date: { $gte: start_date, $lte: end_date },
        },
      },
      {
        $group: {
          _id: null,
          totalProduction: { $sum: '$value' },
          totalAvgCount: { $sum: '$avgcount' },
        },
      },
    ]);

    return [
      {
        unit,
        start_date,
        end_date,
        totalProduction: result[0]?.totalProduction || 0,
        avgcount: result[0]?.totalAvgCount || 0, // ✅ correct mapping
      },
    ];
  }
}



}

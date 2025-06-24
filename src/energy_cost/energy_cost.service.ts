import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetEnergyCostDto } from './dto/get-energy-cost.dto';
import { EnergyCost } from './schemas/energy-cost.schema';
import * as moment from 'moment-timezone';

@Injectable()
export class EnergyCostService {
  constructor(
    @InjectModel(EnergyCost.name, 'surajcotton') private costModel: Model<EnergyCost>,
  ) {}

  async getConsumptionData(dto: GetEnergyCostDto) {
    const { start_date, end_date, meterIds, suffixes } = dto;

    const suffixArray = suffixes || [];

    // Build full-day ISO range using only date (no time!)
    const startOfRange = moment
      .tz(start_date, 'YYYY-MM-DD', 'Asia/Karachi')
      .startOf('day')
      .toISOString(true);

    const endOfRange = moment
      .tz(end_date, 'YYYY-MM-DD', 'Asia/Karachi')
      .endOf('day')
      .toISOString(true);

    const result: {
      meterId: string;
      suffix: string;
      startValue: number;
      endValue: number;
      consumption: number;
      startTimestamp: string;
      endTimestamp: string;
    }[] = [];

    for (let i = 0; i < meterIds.length; i++) {
      const meterId = meterIds[i];
      const suffix = suffixArray[i] || suffixArray[0]; // default to first if missing

      const key = `${meterId}_${suffix}`;
      const projection = { [key]: 1, timestamp: 1 };

      // First document (start of range)
      const firstDoc = await this.costModel
        .findOne({ timestamp: { $gte: startOfRange, $lte: endOfRange } })
        .select(projection)
        .sort({ timestamp: 1 })
        .lean();

      // Last document (end of range)
      const lastDoc = await this.costModel
        .findOne({ timestamp: { $gte: startOfRange, $lte: endOfRange } })
        .select(projection)
        .sort({ timestamp: -1 })
        .lean();

      // Skip if missing or incomplete
      if (
        !firstDoc ||
        !lastDoc ||
        firstDoc[key] === undefined ||
        lastDoc[key] === undefined
      ) {
        continue;
      }

      const startValue = firstDoc[key];
      const endValue = lastDoc[key];
      const consumption = endValue - startValue;

      result.push({
        meterId,
        suffix,
        startValue,
        endValue,
        consumption,
        startTimestamp: firstDoc.timestamp,
        endTimestamp: lastDoc.timestamp,
      });
    }

    return result;
  }
}

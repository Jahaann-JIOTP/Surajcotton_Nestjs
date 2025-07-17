import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { HeatMapDocument } from './schemas/heat_map.schema'; // adjust this path as per your structure
// import { HourlyConsumption } from './dto/hourly-consumption.interface'; // correct path


interface HourlyConsumption {
  hour: string;
  consumption: number;
}

@Injectable()
export class HeatMapService {
  constructor(
    @InjectModel('HeatMap', 'surajcotton') private readonly heatMapModel: Model<HeatMapDocument>, // adjust name & type as per schema
  ) {}

  async getHourlyConsumption(startDate: string, endDate: string, tag: string): Promise<HourlyConsumption[]> {
    const start = moment.tz(startDate, 'YYYY-MM-DD', 'Asia/Karachi').startOf('day').toDate();
    const end = moment.tz(endDate, 'YYYY-MM-DD', 'Asia/Karachi').endOf('day').toDate();

    const rawData = await this.heatMapModel.aggregate([
      {
        $match: {
          PLC_DATE_TIME: { $gte: start, $lte: end },
          [tag]: { $exists: true }
        }
      },
      {
        $addFields: {
          hour: {
            $dateToString: {
              format: '%H:00',
              date: '$PLC_DATE_TIME',
              timezone: 'Asia/Karachi'
            }
          },
          value: `$${tag}`
        }
      },
      {
        $group: {
          _id: '$hour',
          consumption: { $sum: '$value' }
        }
      },
      {
        $project: {
          _id: 0,
          hour: '$_id',
          consumption: 1
        }
      },
      {
        $sort: { hour: 1 }
      }
    ]);

    // Fill all 24 hours even if missing
    const filledData: HourlyConsumption[] = [];
    for (let h = 0; h < 24; h++) {
      const hourStr = h.toString().padStart(2, '0') + ':00';
      const existing = rawData.find(item => item.hour === hourStr);
      filledData.push({
        hour: hourStr,
        consumption: existing ? existing.consumption : 0,
      });
    }

    return filledData;
  }
}

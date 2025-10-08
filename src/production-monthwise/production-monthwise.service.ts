import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment';
import { Production, ProductionDocument } from '../production/schemas/production.schema';

@Injectable()
export class ProductionMonthwiseService {
  constructor(
    @InjectModel(Production.name, 'surajcotton')
    private productionModel: Model<ProductionDocument>,
  ) {}

  async getByMonth(month: string): Promise<{ month: string; data: Production[] }> {
    const entries = await this.productionModel
      .find({ date: { $regex: `^${month}` } }) // Match dates starting with "YYYY-MM"
      .sort({ date: 1 })
      .exec();

    const readableMonth = moment(month, 'YYYY-MM').format('MMMM YYYY');

    return {
      month: readableMonth,
      data: entries,
    };
  }
}

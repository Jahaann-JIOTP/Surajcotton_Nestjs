// src/production/production.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Production, ProductionDocument } from './schemas/production.schema';
import { Model } from 'mongoose';
import { CreateProductionDto } from './dto/create-production.dto';
import * as moment from 'moment';

@Injectable()
export class ProductionService {
  constructor(
    @InjectModel(Production.name, 'surajcotton') private productionModel: Model<ProductionDocument>,
  ) {}

  async addProductions(dto: CreateProductionDto): Promise<Production[]> {
    const {unit, startDate, values } = dto;

    const entries = values.map((value, index) => {
      const date = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
      return { unit, date, value };
    });

    return this.productionModel.insertMany(entries);
  }

  async findAll(): Promise<Production[]> {
    return this.productionModel.find().sort({ date: 1 }).exec();
  }
}

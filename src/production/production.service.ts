// src/production/production.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Production, ProductionDocument } from './schemas/production.schema';
import { Model, Types } from 'mongoose';
import { CreateProductionDto } from './dto/create-production.dto';
import { UpdateProductionDto } from './dto/update-production.dto';
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
// async findByDateAndUnit(date: string, unit: string) {
//   return this.productionModel.find({ date, unit }).exec();
// }
async findAll(): Promise<Production[]> {
  return this.productionModel.find().sort({ date: 1 }).exec();
}



  // src/production/production.service.ts
async findByDateAndUnit(date: string, unit: string): Promise<Production[]> {
  // Try both match types
  const formatted = moment(date).format('YYYY-MM-DD');
  const start = moment(date).startOf('day').toDate();
  const end = moment(date).endOf('day').toDate();

  // Try exact string match
  const stringMatch = await this.productionModel.find({ unit, date: formatted }).exec();
  if (stringMatch.length > 0) return stringMatch;

  // Fallback: try date range match
  const dateMatch = await this.productionModel.find({
    unit,
    date: { $gte: start, $lte: end },
  }).exec();

  return dateMatch;
}




  async updateProduction(dto: UpdateProductionDto): Promise<Production | null> {
  const { id, ...updates } = dto;
  return this.productionModel.findByIdAndUpdate(id, updates, { new: true }).exec();
}

async deleteProduction(id: string): Promise<{ deleted: boolean }> {
  const result = await this.productionModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
  return { deleted: result.deletedCount > 0 };
}
}

// src/energy-spindle/energy_spindle.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EnergySpindleService } from './energy_spindle.service';
import {EnergySpindleController} from './energy_spindle.controller'
import { DailyProduction, DailyProductionSchema } from './schemas/daily_production.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: DailyProduction.name, schema: DailyProductionSchema }],
      'surajcotton',
    ),
  ],
  providers: [EnergySpindleService],
  controllers: [EnergySpindleController],
  exports: [EnergySpindleService],
})
export class EnergySpindleModule {}

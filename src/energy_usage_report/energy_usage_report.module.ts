
// src/energy-cost/energy-cost.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Energyusagereport, EnergyusagereportSchema } from './schemas/energy-usage_report.schema';
import { EnergyUsageReportController } from './energy_usage_report.controller';
import { EnergyUsageReportService } from './energy_usage_report.service';
import { DailyProduction, DailyProductionSchema } from './schemas/daily-production.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Energyusagereport.name, schema: EnergyusagereportSchema },
      { name: DailyProduction.name, schema: DailyProductionSchema },
    ],
'surajcotton'),
  ],
  controllers: [EnergyUsageReportController],
  providers: [EnergyUsageReportService],
})
export class EnergyUsageReportModule {}

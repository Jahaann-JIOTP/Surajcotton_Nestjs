
// src/energy-cost/energy-cost.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Energyconsumptionreport, EnergyconsumptionreportSchema } from './schemas/energy-usage_report.schema';
import { EnergyconsumptionreportController } from './energy_consumption_report.controller';
import { EnergyconsumptionreportService } from './energy_consumption_report.service';
import { DailyProduction, DailyProductionSchema } from './schemas/daily-production.schema';
import { FieldMeterProcess, FieldMeterProcessSchema } from './schemas/field-meter-process.schema';
import { MeterModule } from 'src/meter/meter.module';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Energyconsumptionreport.name, schema: EnergyconsumptionreportSchema },
      { name: DailyProduction.name, schema: DailyProductionSchema },
      { name: FieldMeterProcess.name, schema: FieldMeterProcessSchema },


    ],
'surajcotton'),
MeterModule, 
  ],
   // ✅ Add this line here
  controllers: [EnergyconsumptionreportController],
  providers: [EnergyconsumptionreportService],
})
export class EnergyconsumptionreportModule {}

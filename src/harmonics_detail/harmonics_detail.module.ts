import { Module } from '@nestjs/common';
import { HarmonicsDetailController } from './harmonics_detail.controller';
import { HarmonicsDetailService } from './harmonics_detail.service';
import { MeterModule } from 'src/meter/meter.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Energyconsumptionreport, EnergyconsumptionreportSchema } from 'src/energy_consumption_report/schemas/energy-usage_report.schema';
import { DailyProduction, DailyProductionSchema } from 'src/energy_usage_report/schemas/daily-production.schema';
import { FieldMeterProcess, FieldMeterProcessSchema } from 'src/energy_usage_report/schemas/field-meter-process.schema';

@Module( {
    imports: [
      MongooseModule.forFeature([
        { name: Energyconsumptionreport.name, schema: EnergyconsumptionreportSchema },
        { name: DailyProduction.name, schema: DailyProductionSchema },
        { name: FieldMeterProcess.name, schema: FieldMeterProcessSchema },
      ],
  'surajcotton'),
  MeterModule
    ],
  controllers: [HarmonicsDetailController],
  providers: [HarmonicsDetailService]
})
export class HarmonicsDetailModule {}

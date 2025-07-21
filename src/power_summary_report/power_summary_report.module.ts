

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PowerSummaryReportController } from './power_summary_report.controller';
import { PowerSummaryReportService } from './power_summary_report.service';
import { EnergyCost, EnergyCostSchema } from './schemas/power_summary-report.schema';
import { DailyProduction, DailyProductionSchema } from './schemas/daily_production.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EnergyCost.name, schema: EnergyCostSchema },
      {
          name: DailyProduction.name,
          schema: DailyProductionSchema,
        },
    ],
'surajcotton'),
  ],
  controllers: [PowerSummaryReportController],
  providers: [PowerSummaryReportService],
})
export class  PowerSummaryReportModule {}

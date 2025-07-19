

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PowerSummaryReportController } from './power_summary_report.controller';
import { PowerSummaryReportService } from './power_summary_report.service';
import { EnergyCost, EnergyCostSchema } from './schemas/power_summary-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EnergyCost.name, schema: EnergyCostSchema }
    ],
'surajcotton'),
  ],
  controllers: [PowerSummaryReportController],
  providers: [PowerSummaryReportService],
})
export class  PowerSummaryReportModule {}

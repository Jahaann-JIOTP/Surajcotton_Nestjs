import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyConsumptionService } from './daily_consumption.service';
import { DailyConsumptionController } from './daily_consumption.controller';
import { Historical, HistoricalSchema } from './schemas/historical.schema';

@Module({
  imports: [
    // yahan "surajcotton" connection ka naam match hona chahiye
    MongooseModule.forFeature(
      [{ name: Historical.name, schema: HistoricalSchema}],
      'surajcotton',   // <-- yehi name service me bhi use hoga
    ),
  ],



  providers: [DailyConsumptionService],
  controllers: [DailyConsumptionController],
})
export class DailyConsumptionModule {}

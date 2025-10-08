import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlantsTrendsService } from './plants_trends.service';
import { PlantsTrendsController } from './plants_trends.controller';
import { HistoricalSchema } from './schemas/historical.schema';

@Module({
  imports: [
    // 🔹 surajcotton DB connection with historical collection
    MongooseModule.forFeature(
      [{ name: 'Historical', schema: HistoricalSchema }],
      'surajcotton',
    ),
  ],
  controllers: [PlantsTrendsController],
  providers: [PlantsTrendsService],
})
export class PlantsTrendsModule {}

// src/heat_map/heat_map.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HeatMapService } from './heat_map.service';
import { HeatMapController } from './heat_map.controller';
import { HeatMapSchema } from './schemas/heat_map.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: 'HeatMap', schema: HeatMapSchema }],
      'surajcotton' // <-- Use your named DB connection
    )
  ],
  controllers: [HeatMapController],
  providers: [HeatMapService]
})
export class HeatMapModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HeatMapService } from './heat_map.service';
import { HeatMapController } from './heat_map.controller';
import { HeatMapSchema } from './schemas/heat_map.schema';
import { TransformerInput, TransformerInputSchema } from './schemas/transformer.schema';

@Module({
   imports: [
    // same connection name used in InjectModel decorators
    MongooseModule.forFeature(
      [{ name: 'HeatMap', schema: HeatMapSchema }],
      'surajcotton',
    ),
    MongooseModule.forFeature(
      [{ name: TransformerInput.name, schema: TransformerInputSchema }],
      'surajcotton',
    ),
  ],
  controllers: [HeatMapController],
  providers: [HeatMapService]
})
export class HeatMapModule {}



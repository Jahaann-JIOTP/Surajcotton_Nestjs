import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { sankeyService } from './sankey.service';
import { sankeyController } from './sankey.controller';
import { sankey, sankeySchema } from './schemas/sankey.schema';
import { MeterModule } from 'src/meter/meter.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: sankey.name, schema: sankeySchema }],
      'surajcotton' // MongoDB connection name
    ),  MeterModule,
  ],
  
  controllers: [sankeyController],
  providers: [sankeyService],
  
})
export class sankeyModule {}


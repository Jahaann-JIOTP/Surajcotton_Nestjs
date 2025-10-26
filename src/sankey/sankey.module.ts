import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { sankeyService } from './sankey.service';
import { sankeyController } from './sankey.controller';
import { sankey, sankeySchema } from './schemas/sankey.schema';
import { MeterModule } from 'src/meter/meter.module';
import { Unit4Lt1Module } from '../unit4_lt1/unit4_lt1.module';
import { Unit4Lt2Module } from '../unit4_lt2/unit4_lt2.module';
import { Unit5Lt3Module } from '../unit5_lt3/unit5_lt3.module';
import { Unit5Lt4Module } from '../unit5_lt4/unit5_lt4.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: sankey.name, schema: sankeySchema }],
      'surajcotton' // MongoDB connection name
    ),  
    MeterModule,
    Unit4Lt1Module, // ✅ add this line
    Unit4Lt2Module, // ✅ add this line
    Unit5Lt3Module, // ✅ add this line
    Unit5Lt4Module, // ✅ add this line
    
  ],
  
  controllers: [sankeyController],
  providers: [sankeyService],
  
})
export class sankeyModule {}


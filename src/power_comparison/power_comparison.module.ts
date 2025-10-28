import { Module } from '@nestjs/common';
import { powercomparisonService } from './power_comparison.service';
import { powercomparisonController } from './power_comparison.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { powercomparisonHistoricalDataSchema  } from './schemas/power_comparison.schema';
import { Unit4Lt1Module } from '../unit4_lt1/unit4_lt1.module';
import { Unit4Lt2Module } from '../unit4_lt2/unit4_lt2.module';
import { Unit5Lt3Module } from '../unit5_lt3/unit5_lt3.module';
import { Unit5Lt4Module } from '../unit5_lt4/unit5_lt4.module';

@Module({
  imports: [
      MongooseModule.forFeature([{ name: 'power_comparison', schema:  powercomparisonHistoricalDataSchema , collection: 'historical', }],
        'surajcotton',
      ),
      Unit4Lt1Module, // ✅ add this line
    Unit4Lt2Module, // ✅ add this line
    Unit5Lt3Module, // ✅ add this line
    Unit5Lt4Module, // ✅ add this line
    ],
  controllers: [powercomparisonController],
  providers: [powercomparisonService],
})
export class PowerComparisonModule {}
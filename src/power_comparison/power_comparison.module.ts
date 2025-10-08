import { Module } from '@nestjs/common';
import { powercomparisonService } from './power_comparison.service';
import { powercomparisonController } from './power_comparison.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { powercomparisonHistoricalDataSchema  } from './schemas/power_comparison.schema';

@Module({
  imports: [
      MongooseModule.forFeature([{ name: 'power_comparison', schema:  powercomparisonHistoricalDataSchema , collection: 'historical', }],
        'surajcotton',
      ),
    ],
  controllers: [powercomparisonController],
  providers: [powercomparisonService],
})
export class PowerComparisonModule {}
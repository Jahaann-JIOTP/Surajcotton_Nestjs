import { Module } from '@nestjs/common';
import { HarmonicsController } from './harmonics.controller';
import { HarmonicsService } from './harmonics.service';

@Module({
  controllers: [HarmonicsController],
  providers: [HarmonicsService]
})
export class HarmonicsModule {}

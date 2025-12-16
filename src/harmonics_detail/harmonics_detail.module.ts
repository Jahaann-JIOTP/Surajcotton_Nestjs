import { Module } from '@nestjs/common';
import { HarmonicsDetailController } from './harmonics_detail.controller';
import { HarmonicsDetailService } from './harmonics_detail.service';

@Module({
  controllers: [HarmonicsDetailController],
  providers: [HarmonicsDetailService]
})
export class HarmonicsDetailModule {}

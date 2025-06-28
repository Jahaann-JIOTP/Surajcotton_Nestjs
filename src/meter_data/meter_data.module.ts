// src/meter_data/meter_data.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { meter_dataService } from './meter_data.service';
import { meter_dataController } from './meter_data.controller';

@Module({
  imports: [HttpModule],
  controllers: [meter_dataController],
  providers: [meter_dataService],
})
export class meter_dataModule {}

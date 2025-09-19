// src/meter_data/meter_data.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { meter_dataService } from './meter_data.service';
import { RealtimeDto } from './dto/realtime.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('meter-data')
export class meter_dataController {
  constructor(private readonly meterDataService: meter_dataService) {}

  @UseGuards(JwtAuthGuard)
 @Post()
async getFilteredMeterData(@Body() dto: RealtimeDto) {
  const { area, meterId } = dto;

  // directly use area as groupKey
  const groupKey = area.toLowerCase();

  const data = await this.meterDataService.getFilteredData(groupKey, meterId);
  return { message: 'Filtered data', data };
}

}

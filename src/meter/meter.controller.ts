import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { MeterService } from './meter.service';
import { ToggleMeterDto } from './dto/toggle-meter.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from 'src/auth/roles.authguard';

@Controller('meter')
export class MeterController {
  constructor(private readonly meterService: MeterService) {}

  // ✅ Toggle meter
  @Post('toggle')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggle(@Body() dto: ToggleMeterDto) {
    return await this.meterService.toggleMeter(dto);
  }

  // ✅ Get all toggles
  @UseGuards(JwtAuthGuard)
  @Get('toggles')
  async getAllToggles() {
    return await this.meterService.getAllToggleData();
  }

  // ✅ Get latest config
  @UseGuards(JwtAuthGuard)
  @Get('config/latest')
  async getLatestConfig() {
    return await this.meterService.getLatestConfig();
  }

  // ✅ Get toggle-based realtime data
 @UseGuards(JwtAuthGuard)
@Get('realtime')
async getToggleBasedRealTime() {
  return this.meterService.getToggleBasedRealTime(); // ✅ FIXED
}


  // ✅ Calculate total consumption
  @UseGuards(JwtAuthGuard)
  @Get('consumption')
  async getConsumption() {
    return this.meterService.calculateConsumption();
  }

  // ✅ Meter wise consumption
  @UseGuards(JwtAuthGuard)
  @Get('meter-wise-consumption')
  async getMeterWiseConsumption() {
    return this.meterService.getMeterWiseConsumption();
  }
}

import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { MeterService } from './meter.service';
import { ToggleMeterDto } from './dto/toggle-meter.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from 'src/auth/roles.authguard';

@Controller('meter')
export class MeterController {
  constructor(private readonly meterService: MeterService) {}

  @Post('toggle')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggle(@Body() dto: ToggleMeterDto) {
    return await this.meterService.toggleMeter(dto);
  }
  @Get('toggles')
async getAllToggles() {
  return await this.meterService.getAllToggleData();
}
  // ✅ GET latest config
@Get('config/latest')
async getLatestConfig() {
  return await this.meterService.getLatestConfig();
}

}

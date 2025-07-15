import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { MeterService } from './meter.service';
import { ToggleMeterDto } from './dto/toggle-meter.dto';
// import { JwtAuthGuard } from '../auth/jwt.authguard';
// import { RolesGuard } from '../auth/roles.authguard';
// import { Roles } from '../auth/roles.decorator';

@Controller('meter')
export class MeterController {
  constructor(private readonly meterService: MeterService) {}

  @Post('toggle')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin', 'super_admin')
  async toggle(@Body() dto: ToggleMeterDto) {
    return await this.meterService.toggleMeter(dto);
  }

  

  // ✅ GET latest config
@Get('config/latest')
async getLatestConfig() {
  return await this.meterService.getLatestConfig();
}

}

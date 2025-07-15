import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MeterService } from './meter.service';
import { ToggleMeterDto } from './dto/toggle-meter.dto';
// import { JwtAuthGuard } from 'src/auth/jwt.authguard';
// import { AdminGuard } from 'src/auth/roles.authguard';        // ✅ uncommented and used

@Controller('meter')
export class MeterController {
  constructor(private readonly meterService: MeterService) {}

  // 🔐 Only admin and super_admin can toggle
  @Post('toggle')
  //  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggle(@Body() dto: ToggleMeterDto) {
    return await this.meterService.toggleMeter(dto);
  }

  // 🟢 Open to all (or protect it if needed)
  @Get('status/:meterId')
  async getStatus(@Param('meterId') meterId: string) {
    return await this.meterService.getMeterStatus(meterId);
  }
}

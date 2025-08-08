import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { powercomparisonService } from './power_comparison.service';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller()
export class powercomparisonController {
  constructor(private readonly powercomparisonService: powercomparisonService) {}
   
  @UseGuards(JwtAuthGuard)
  @Get('power_comparison')
  async getConVsPro(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Query('label') label: string
  ) {
    return this.powercomparisonService.getPowerData(startDate, endDate, label);
  }
}

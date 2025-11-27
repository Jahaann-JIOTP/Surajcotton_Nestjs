// src/energy/energy.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EnergyService } from './energy.service';
import { EnergyQueryDto } from './dto/energy-query.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';


@Controller('dashboard')
export class EnergyController {
  constructor(private readonly energyService: EnergyService) {}

 @UseGuards(JwtAuthGuard)
  @Get('consumption')
  async getEnergyData(@Query() query: EnergyQueryDto) {
    return await this.energyService.getConsumption(query.start_date, query.end_date);
  }
}

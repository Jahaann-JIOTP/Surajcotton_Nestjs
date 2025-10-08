// src/energy-spindle/energy_spindle.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EnergySpindleService } from './energy_spindle.service';
import { GetSpindleDto } from './dto/get-spindle.dto';
 import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('energy-spindle')
export class EnergySpindleController {
  constructor(private readonly energySpindleService: EnergySpindleService) {}
  
@UseGuards(JwtAuthGuard)
  @Get()
  async getProduction(@Query() query: GetSpindleDto) {
    return await this.energySpindleService.getProductionByDate(query);
  }
}

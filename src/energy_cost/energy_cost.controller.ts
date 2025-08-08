// src/energy-cost/energy-cost.controller.ts

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GetEnergyCostDto } from './dto/get-energy-cost.dto';
import { EnergyCostService } from './energy_cost.service';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('energy-cost')
export class EnergyCostController {
  constructor(private readonly energyCostService: EnergyCostService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async getCostData(@Body() dto: GetEnergyCostDto) {
    return this.energyCostService.getConsumptionData(dto);
  }
}

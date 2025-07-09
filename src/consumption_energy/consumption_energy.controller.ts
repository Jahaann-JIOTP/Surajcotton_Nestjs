

import { Controller, Get, Query } from '@nestjs/common';
import { ConsumptionEnergyService } from './consumption_energy.service';
import { Consumption_energyDto  } from './dto/consumption_energy.dto'; // Correct import for DTO

@Controller('consumption-energy')
export class ConsumptionEnergyController {
  constructor(private readonly ConsumptionEnergyService: ConsumptionEnergyService) {}

  @Get()
  async getGeneration(@Query() query: Consumption_energyDto ) {
    // Call handleQuery method from the service
    return this.ConsumptionEnergyService.handleQuery(query);
  }
}

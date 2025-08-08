import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GenerationEnergyService } from './generation_energy.service';
import { generation_energyDto } from './dto/generation_energy.dto'; // Correct import for DTO
 import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('generation-energy')
export class GenerationEnergyController {
  constructor(private readonly GenerationEnergyService: GenerationEnergyService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getGeneration(@Query() query: generation_energyDto ) {
    // Call handleQuery method from the service
    return this.GenerationEnergyService.handleQuery(query);
  }
}

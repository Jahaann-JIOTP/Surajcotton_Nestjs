// src/production/production.controller.ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ProductionService } from './production.service';
import { CreateProductionDto } from './dto/create-production.dto';
import { plainToInstance } from 'class-transformer';
import { Production } from './schemas/production.schema';

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post()
  async addProductions(@Body() dto: CreateProductionDto) {
    const result = await this.productionService.addProductions(dto);
    return plainToInstance(Production, result, { excludeExtraneousValues: true });
  }

  @Get()
  async getAllProductions() {
    const result = await this.productionService.findAll();
    return plainToInstance(Production, result, { excludeExtraneousValues: true });
  }
}

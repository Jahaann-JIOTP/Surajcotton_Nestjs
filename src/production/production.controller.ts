// src/production/production.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Put} from '@nestjs/common';
import { ProductionService } from './production.service';
import { CreateProductionDto } from './dto/create-production.dto';
import { UpdateProductionDto } from './dto/update-production.dto'
import { plainToInstance } from 'class-transformer';
import { Production } from './schemas/production.schema';
import * as moment from 'moment';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';


@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}
  
  @UseGuards(JwtAuthGuard)
  @Post()
  async addProductions(@Body() dto: CreateProductionDto) {
    const result = await this.productionService.addProductions(dto);
    return plainToInstance(Production, result, { excludeExtraneousValues: true });
  }

  // @Get()
  // async getAllProductions() {
  //   const result = await this.productionService.findAll();
  //   return plainToInstance(Production, result, { excludeExtraneousValues: true });
  // }
@UseGuards(JwtAuthGuard)
 @Get()
  async getProductions(
    @Query('date') date?: string,
    @Query('unit') unit?: string,
  ) {
    console.log('Received query:', { unit, date });

    if (unit && date) {
      const formattedDate = moment(date).format('YYYY-MM-DD');
      const result = await this.productionService.findByDateAndUnit(formattedDate, unit);
      console.log('Result:', result);  // 👈 Debugging line
      return result;
    }

    return this.productionService.findAll();
  }


@UseGuards(JwtAuthGuard)
@Put()
async updateProduction(@Body() dto: UpdateProductionDto) {
  const result = await this.productionService.updateProduction(dto);
  return plainToInstance(Production, result, { excludeExtraneousValues: true });
}
 
@UseGuards(JwtAuthGuard)
@Delete(':id')
async deleteProduction(@Param('id') id: string) {
  return this.productionService.deleteProduction(id);
}
}

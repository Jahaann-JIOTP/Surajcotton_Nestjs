import { Controller, Post, Body } from '@nestjs/common';
import { Unit4LT1Service } from './unit4_lt1.service';
import { Unit4LT1Dto } from './dto/unit4_lt1.dto';

@Controller('unit4-lt1')
export class Unit4LT1Controller {
  constructor(private readonly unitService: Unit4LT1Service) {}

  @Post()
  async getSankey(@Body() dto: Unit4LT1Dto) {
    return this.unitService.getSankeyData(dto.startDate, dto.endDate);
  }
}

import { Controller, Post, Body } from '@nestjs/common';
import { Unit5LT3Service } from './unit5_lt3.service';
import { Unit5LT3Dto } from './dto/unit5_lt3.dto';

@Controller('unit5-lt3')
export class Unit5LT3Controller {
  constructor(private readonly unitService: Unit5LT3Service) {}

  @Post()
  async getSankey(@Body() dto: Unit5LT3Dto) {
    return this.unitService.getSankeyData(dto.startDate, dto.endDate);
  }
}

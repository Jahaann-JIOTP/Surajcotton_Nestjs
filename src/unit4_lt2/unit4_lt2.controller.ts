import { Controller, Post, Body } from '@nestjs/common';
import { Unit4LT2Service } from './unit4_lt2.service';
import { Unit4LT2Dto } from './dto/unit4_lt2.dto';

@Controller('unit4-lt2')
export class Unit4LT2Controller {
  constructor(private readonly unitService: Unit4LT2Service) {}

  @Post()
  async getSankey(@Body() dto: Unit4LT2Dto) {
    return this.unitService.getSankeyData(dto.startDate, dto.endDate);
  }
}

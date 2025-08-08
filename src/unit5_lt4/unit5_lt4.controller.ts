import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Unit5LT4Service } from './unit5_lt4.service';
import { Unit5LT4Dto } from './dto/unit5_lt4.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('unit5-lt4')
export class Unit5LT4Controller {
  constructor(private readonly unitService: Unit5LT4Service) {}
   
  @UseGuards(JwtAuthGuard)
  @Post()
  async getSankey(@Body() dto: Unit5LT4Dto) {
    return this.unitService.getSankeyData(dto.startDate, dto.endDate);
  }
}

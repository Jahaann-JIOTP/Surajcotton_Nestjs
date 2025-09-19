import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Unit4LT1Service } from './unit4_lt1.service';
import { Unit4LT1Dto } from './dto/unit4_lt1.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('unit4-lt1')
export class Unit4LT1Controller {
  constructor(private readonly unitService: Unit4LT1Service) {}
  
  @UseGuards(JwtAuthGuard)
  @Post()
  async getSankey(@Body() dto: Unit4LT1Dto) {
    // Pass the entire dto as a single argument
    return this.unitService.getSankeyData(dto);
  }
}   

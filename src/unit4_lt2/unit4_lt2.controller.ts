import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Unit4LT2Service } from './unit4_lt2.service';
import { Unit4LT2Dto } from './dto/unit4_lt2.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('unit4-lt2')
export class Unit4LT2Controller {
  constructor(private readonly unitService: Unit4LT2Service) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async getSankey(@Body() dto: Unit4LT2Dto) {
    // Pass the entire dto object to the service method
    return this.unitService.getSankeyData(dto);
  }
}

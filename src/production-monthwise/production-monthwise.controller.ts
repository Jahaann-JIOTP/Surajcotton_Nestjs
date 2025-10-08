import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ProductionMonthwiseService } from './production-monthwise.service';
import { GetByMonthDto } from './dto/get-by-month.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('production-monthwise')
export class ProductionMonthwiseController {
  constructor(private readonly monthwiseService: ProductionMonthwiseService) {}
  
  @UseGuards(JwtAuthGuard)
  @Get()
  async getMonthlyData(@Query() query: GetByMonthDto) {
    return this.monthwiseService.getByMonth(query.month);
  }
}

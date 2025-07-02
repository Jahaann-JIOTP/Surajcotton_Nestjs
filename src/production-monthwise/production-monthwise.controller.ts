import { Controller, Get, Query } from '@nestjs/common';
import { ProductionMonthwiseService } from './production-monthwise.service';
import { GetByMonthDto } from './dto/get-by-month.dto';

@Controller('production-monthwise')
export class ProductionMonthwiseController {
  constructor(private readonly monthwiseService: ProductionMonthwiseService) {}

  @Get()
  async getMonthlyData(@Query() query: GetByMonthDto) {
    return this.monthwiseService.getByMonth(query.month);
  }
}

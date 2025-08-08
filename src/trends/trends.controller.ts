import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TrendsService } from './trends.service';
import { TrendsBodyDto } from './dto/trends-query.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('trends')
export class TrendsController {
  constructor(private readonly trendsService: TrendsService) {}
  
  @UseGuards(JwtAuthGuard)
  @Post()
  async getTrends(@Body() body: TrendsBodyDto) {
    const meterIds = body.meterId.split(',').map(id => id.trim());
    const suffixes = body.suffixes.split(',').map(suffix => suffix.trim());

    return this.trendsService.getTrendData(
      body.start_date,
      body.end_date,
      meterIds,
      suffixes,
      body.area,
      body.LT_selections
    );
  }
}

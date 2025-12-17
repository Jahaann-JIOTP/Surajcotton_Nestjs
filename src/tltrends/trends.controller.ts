import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TLTrendsService } from './trends.service';
import { TrendsBodyDto } from './dto/trends-query.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller( 'tltrends' )
export class TLTrendsController
{
  constructor ( private readonly tltrendsService: TLTrendsService ) { }

  // @UseGuards(JwtAuthGuard)
  @Post('unit4-combine')
  async getU4CombineTrends ( @Body() body: TrendsBodyDto )
  {
    return this.tltrendsService.getU4CombineTrendData(
      body.start_date,
      body.end_date
    );
  }
  @Post( 'unit5-trafo3' )
  async getU5T3Trends ( @Body() body: TrendsBodyDto )
  {
    return this.tltrendsService.getU5T3TrendData(
      body.start_date,
      body.end_date
    );
  }
  @Post( 'unit5-trafo4' )
  async getU5T4Trends ( @Body() body: TrendsBodyDto )
  {
    return this.tltrendsService.getU5T4TrendData(
      body.start_date,
      body.end_date
    );
  }
  @Post( 'unit5-combine' )
  async getU5CombineTrends ( @Body() body: TrendsBodyDto )
  {
    return this.tltrendsService.getU5CombineTrendData(
      body.start_date,
      body.end_date
    );
  }
}

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
    return this.trendsService.getTrendData(
      body.start_date,
      body.end_date,
      body.meterId,   // 🔹 string as it is (comma separated)
      body.suffixes,  // 🔹 string as it is
      body.area,      // 🔹 "Unit 5 LT_3" parse hoga service mein
    );
  }
}

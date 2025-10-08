import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PieChartService } from './piechart.service';
import { PieChartDto } from './dto/pie-chart.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('pie-chart')
export class PieChartController {
  constructor(private readonly pieChartService: PieChartService) {}

  @UseGuards(JwtAuthGuard)
  @Get('chart-data')
  async getChartData(@Query() pieChartDto: PieChartDto) {
    let startTimestamp: number;
    let endTimestamp: number;

    const { start_date, end_date } = pieChartDto;

    if (start_date && end_date) {
      // Convert start_date and end_date to Unix timestamps in UTC (no timezone offset)
      startTimestamp = new Date(start_date + 'T00:00:00Z').getTime() / 1000; // Convert milliseconds to seconds
      endTimestamp = new Date(end_date + 'T23:59:59Z').getTime() / 1000; // Convert milliseconds to seconds

      // Log the actual start and end dates (human-readable format)
      // console.log('Start Date:', start_date);
      // console.log('End Date:', end_date);
    } else {
      throw new Error('Start date and end date must be provided.');
    }

    // console.log('Start Timestamp (seconds):', startTimestamp);
    // console.log('End Timestamp (seconds):', endTimestamp);

    return await this.pieChartService.fetchData(startTimestamp, endTimestamp);
  }
}

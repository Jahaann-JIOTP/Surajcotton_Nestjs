import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PieChartService } from './piechart.service';
import { PieChartDto } from './dto/pie-chart.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';
import * as moment from 'moment-timezone';

@Controller('pie-chart')
export class PieChartController {
  constructor(private readonly pieChartService: PieChartService) {}

  @UseGuards(JwtAuthGuard)
  @Get('chart-data')
  async getChartData(@Query() pieChartDto: PieChartDto) {
    const TZ = 'Asia/Karachi';

    const {
      start_date,
      end_date,
      start_time,
      end_time,
    } = pieChartDto;

    if (!start_date || !end_date || !start_time || !end_time) {
      throw new Error('start_date, end_date, start_time and end_time are required.');
    }

    // ----------------------------------
    // Build moments from payload
    // ----------------------------------
    const startMoment = moment.tz(
      `${start_date} ${start_time}`,
      'YYYY-MM-DD HH:mm',
      TZ,
    );

    const endMoment = moment.tz(
      `${end_date} ${end_time}`,
      'YYYY-MM-DD HH:mm',
      TZ,
    );

    // ----------------------------------
    // Rule: same datetime → NO DATA
    // ----------------------------------
    if (startMoment.isSame(endMoment)) {
      return [
        {
          category: 'No Data',
          total: 0,
          color: '#cccccc',
          subData: [],
        },
      ];
    }

    // ----------------------------------
    // Convert to UNIX (seconds)
    // +1 minute buffer at end
    // ----------------------------------
    const startTimestamp = startMoment.unix();
    const endTimestamp = endMoment.add(1, 'minute').unix();

    // ----------------------------------
    // Call service
    // ----------------------------------
    return await this.pieChartService.fetchData(
      startTimestamp,
      endTimestamp,
    );
  }
}

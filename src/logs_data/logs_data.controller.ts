import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { LogsDataService } from './logs_data.service';
import { LogsQueryDto } from './dto/logs-query.dto';
 import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('logs_data')
export class LogsDataController {
  constructor(private readonly logsService: LogsDataService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  getLogs(@Body() body: LogsQueryDto) {
    return this.logsService.fetchLogs(body);
  }
}

import { Controller, Post, Body } from '@nestjs/common';
import { LogsDataService } from './logs_data.service';
import { LogsQueryDto } from './dto/logs-query.dto';

@Controller('logs_data')
export class LogsDataController {
  constructor(private readonly logsService: LogsDataService) {}

  @Post()
  getLogs(@Body() body: LogsQueryDto) {
    return this.logsService.fetchLogs(body);
  }
}

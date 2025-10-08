import { Module } from '@nestjs/common';
import { LogsDataService } from './logs_data.service';
import { LogsDataController } from './logs_data.controller';

@Module({
  providers: [LogsDataService],
  controllers: [LogsDataController]
})
export class LogsDataModule {}

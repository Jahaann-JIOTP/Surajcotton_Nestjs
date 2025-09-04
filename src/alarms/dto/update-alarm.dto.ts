/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsString } from 'class-validator';
import { ConfigAlarmDto } from './alarmsConfig.dto';

export class UpdateAlarmDto extends ConfigAlarmDto {
  @IsString()
  alarmConfigId: string;
}

import { IsString } from 'class-validator';

export class DeleteAlarmDto {
  @IsString()
  alarmConfigId: string;
}

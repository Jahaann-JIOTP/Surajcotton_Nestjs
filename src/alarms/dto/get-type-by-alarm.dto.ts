import { IsMongoId, IsNotEmpty } from 'class-validator';

export class GetTypeByAlarmDto {
  @IsMongoId()
  @IsNotEmpty()
  alarmId: string;
}

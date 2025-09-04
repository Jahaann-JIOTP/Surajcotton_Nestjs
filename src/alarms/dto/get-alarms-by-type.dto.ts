import { IsMongoId, IsNotEmpty } from 'class-validator';

export class GetAlarmsByTypeDto {
  @IsMongoId()
  @IsNotEmpty()
  typeId: string;
}

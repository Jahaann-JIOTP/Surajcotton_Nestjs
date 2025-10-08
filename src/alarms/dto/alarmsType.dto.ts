import { IsString, IsNumber } from 'class-validator';

export class AlarmsTypeDto {
  @IsString()
  type: string;

  @IsNumber()
  priority: number;

  @IsString()
  color: string;

  @IsString()
  code: string;

  @IsString()
  acknowledgeType: string;
}

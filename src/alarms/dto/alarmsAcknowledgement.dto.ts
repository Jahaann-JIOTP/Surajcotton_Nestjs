import { IsString } from 'class-validator';

export class AlarmAcknowledgementDto {
  @IsString()
  action: string;

  @IsString()
  by: string;

  @IsString()
  delay: string;
}

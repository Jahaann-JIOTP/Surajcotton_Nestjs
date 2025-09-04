// snooze.dto.ts
import {
  IsBoolean,
  IsNumber,
  IsDateString,
  IsArray,
  ArrayNotEmpty,
  IsString,
} from 'class-validator';

export class SnoozeDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];

  @IsBoolean()
  alarmSnooze: boolean;

  @IsNumber()
  snoozeDuration: number;

  @IsDateString()
  snoozeAt: string;
}

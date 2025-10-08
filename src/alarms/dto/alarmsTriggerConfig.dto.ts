import {
  IsEnum,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

// Define DTO for each threshold condition
export class ThresholdConditionDto {
  @IsNumber()
  value: number;

  @IsEnum(['>', '<', '>=', '<=', '==', '!='])
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
}

// Main Alarm Trigger Config DTO
export class AlarmTriggerConfigDto {
  @IsOptional()
  @IsNumber()
  persistenceTime?: number;

  @IsOptional()
  @IsNumber()
  occursCount?: number;

  @IsOptional()
  @IsNumber()
  occursWithin?: number;

  @IsEnum(['&&', '||', ''])
  conditionType: '&&' | '||' | '';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ThresholdConditionDto)
  thresholds: ThresholdConditionDto[];
  _id: any;
}

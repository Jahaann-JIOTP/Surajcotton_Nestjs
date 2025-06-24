// src/energy-cost/dto/get-energy-cost.dto.ts

import { IsArray, IsOptional, IsString } from 'class-validator';

export class GetEnergyCostDto {
  @IsString()
  start_date: string;

  @IsString()
  end_date: string;

  @IsArray()
  @IsString({ each: true })
  meterIds: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suffixes?: string[];
}

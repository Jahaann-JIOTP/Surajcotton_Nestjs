// src/production/dto/update-production.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsDateString, IsNumber } from 'class-validator';

export class UpdateProductionDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  value?: number;
}

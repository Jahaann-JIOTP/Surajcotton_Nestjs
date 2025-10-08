// src/pie-chart/dto/pie-chart.dto.ts
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class PieChartDto {
  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsString()
  Label: string;
}

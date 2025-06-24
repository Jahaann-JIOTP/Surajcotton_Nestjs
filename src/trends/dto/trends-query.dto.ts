// src/trends/dto/trends-query.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class TrendsQueryDto {
  @IsNotEmpty()
  @IsString()
  start_date: string;

  @IsNotEmpty()
  @IsString()
  end_date: string;

  @IsNotEmpty()
  @IsString()
  meterId: string; // comma-separated

  @IsNotEmpty()
  @IsString()
  suffixes: string; // comma-separated
}

// src/trends/dto/trends-query.dto.ts
import { IsString } from 'class-validator';

export class TrendsQueryDto {
  @IsString()
  start_date: string;

  @IsString()
  end_date: string;

  @IsString()
  area: string;

  @IsString()
  selection: string;

  @IsString()
  meterId: string;

  @IsString()
  suffixes: string;
}

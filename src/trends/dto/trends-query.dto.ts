// src/trends/dto/trends-body.dto.ts
import { IsString } from 'class-validator';

export class TrendsBodyDto {
  @IsString() start_date: string;
  @IsString() end_date: string;
  @IsString() area: string;
  @IsString() selection: string;
  @IsString() meterId: string; // comma separated
  @IsString() suffixes: string; // comma separated
}

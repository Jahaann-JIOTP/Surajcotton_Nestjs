// src/energy-spindle/dto/get-spindle.dto.ts

import { IsNotEmpty, IsString } from 'class-validator';

export class GetSpindleDto {
  @IsNotEmpty()
  @IsString()
  start_date: string; // Format: YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  end_date: string; // Format: YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  unit: string; // U4 or U5
}

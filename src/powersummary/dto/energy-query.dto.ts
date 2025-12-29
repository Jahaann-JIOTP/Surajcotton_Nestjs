// src/energy/dto/energy-query.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class EnergyQueryDto {
  @IsString()
  @IsNotEmpty()
  start_date: string;

  @IsString()
  @IsNotEmpty()
  end_date: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;
}

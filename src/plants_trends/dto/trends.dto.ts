import { IsNotEmpty, IsString } from 'class-validator';

export class TrendsDto {
  @IsString()
  @IsNotEmpty()
  startDate: string; // e.g. 2025-09-12

  @IsString()
  @IsNotEmpty()
  endDate: string; // e.g. 2025-09-12

  @IsString()
  @IsNotEmpty()
  meterIds: string; // e.g. "U21_PLC,U19_PLC"

  @IsString()
  @IsNotEmpty()
  suffixes: string; // e.g. "Del_ActiveEnergy"
}

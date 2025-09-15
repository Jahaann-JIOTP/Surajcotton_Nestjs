import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class TrendsDto {
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @IsString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsNotEmpty()
  meterIds: string;

  @IsString()
  @IsNotEmpty()
  suffixes: string;

  @IsString()
  @IsOptional()
  @IsIn(['energy', 'activePower', 'current', 'voltage', 'recEnergy', 'powerfactor', 'harmonics'])
  type?: string;
}

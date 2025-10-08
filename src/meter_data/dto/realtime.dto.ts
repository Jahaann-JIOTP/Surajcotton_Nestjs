// src/meter_data/dto/realtime.dto.ts
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RealtimeDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['Unit_4', 'Unit_5'])
  area: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['LT_1', 'LT_2', 'LT_3', 'LT_4'])
  LT_selections: string;

  @IsNotEmpty()
  @IsString()
  meterId: string;
}

// src/energy/dto/energy-query.dto.ts
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class EnergyQueryDto {
  @IsString()
  @IsNotEmpty()
  start_date: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  end_date: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'start_time must be in HH:mm format',
  })
  start_time: string; // HH:mm (REQUIRED)

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'end_time must be in HH:mm format',
  })
  end_time: string; // HH:mm (REQUIRED)
}

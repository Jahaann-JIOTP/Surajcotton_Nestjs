import { IsOptional, IsString, Matches } from 'class-validator';

export class PieChartDto {
  @IsString()
  start_date: string; // YYYY-MM-DD

  @IsString()
  end_date: string; // YYYY-MM-DD

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'start_time must be in HH:mm format',
  })
  start_time: string; // HH:mm

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'end_time must be in HH:mm format',
  })
  end_time: string; // HH:mm

  @IsOptional()
  @IsString()
  Label?: string;
}

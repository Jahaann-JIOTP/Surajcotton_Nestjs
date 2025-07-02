import { IsString, Matches } from 'class-validator';

export class GetByMonthDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Month must be in YYYY-MM format like 2025-06' })
  month: string;
}

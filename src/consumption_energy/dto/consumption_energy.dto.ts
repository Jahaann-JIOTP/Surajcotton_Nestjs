
import { IsIn, IsString } from 'class-validator';
export class Consumption_energyDto {
    @IsString()
    @IsIn(['today', 'week', 'month', 'year'], {
      message: 'value must be one of: today, week, month, or year',
    })
    value: string;
  }
  
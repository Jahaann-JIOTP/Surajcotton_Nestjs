import { IsArray, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class LogsQueryDto {
  @IsIn(['current', 'voltage', 'active_power',
         'power_factor', 'reactive_power','reactive_energy', 'apparent_power', 'active_energy', 'harmonics'])

    //  'apparent_energy'
    
  type: string;

  @IsString()
  @IsNotEmpty()
  meters: string;

  @IsString()
  @IsNotEmpty()
  start_date: string;

  @IsString()
  @IsNotEmpty()
  end_date: string;
}
  
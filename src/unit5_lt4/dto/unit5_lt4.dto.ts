import { IsString } from 'class-validator';

export class Unit5LT4Dto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

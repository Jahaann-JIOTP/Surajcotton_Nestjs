import { IsString } from 'class-validator';

export class Unit5LT3Dto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

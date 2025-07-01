import { IsString } from 'class-validator';

export class Unit4LT1Dto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

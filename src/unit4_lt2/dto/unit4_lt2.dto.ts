import { IsString } from 'class-validator';

export class Unit4LT2Dto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

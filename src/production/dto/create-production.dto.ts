// src/production/dto/create-production.dto.ts
import { IsArray, IsDateString, IsIn, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateProductionDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['U4', 'U5']) // restrict allowed units if needed
  unit: string;

  @IsDateString()
  startDate: string;

  @IsArray()
  @IsNumber({}, { each: true })
  values: number[];

  @IsArray()
  @IsNumber({}, { each: true })
  avgcount: number[]; // 👈 new array for avgCount (parallel to values)
}

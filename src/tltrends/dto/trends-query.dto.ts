import { IsNotEmpty, IsString } from 'class-validator';

export class TrendsBodyDto {
  @IsString()
  @IsNotEmpty()
  start_date: string;

  @IsString()
  @IsNotEmpty()
  end_date: string;

  // 🔹 Ab "Unit 5 LT_3" aayega
  @IsString()
  @IsNotEmpty()
  area: string;

  // 🔹 Comma separated string
  @IsString()
  @IsNotEmpty()
  meterId: string;

  // 🔹 Comma separated string
  @IsString()
  @IsNotEmpty()
  suffixes: string;
}

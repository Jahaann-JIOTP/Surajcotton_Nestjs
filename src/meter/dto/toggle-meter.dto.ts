import { IsNotEmpty, IsString } from 'class-validator';

export class ToggleMeterDto {
  @IsNotEmpty()
  @IsString()
  meterId: string;

  @IsNotEmpty()
  @IsString()
  area: string;
}

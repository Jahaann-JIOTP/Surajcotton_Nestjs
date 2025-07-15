import { IsString } from 'class-validator';

export class ToggleMeterDto {
  @IsString()
  area: string;

  @IsString()
  email: string;

  @IsString()
  username: string;
}

import { IsOptional, IsString } from 'class-validator';

export class AddPrivellegesDto {
  @IsOptional()
  @IsString()
  name?: string | undefined;
}

export class UpdatePrivellegesDto {
  @IsOptional()
  @IsString()
  name?: string;
}

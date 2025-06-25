import { IsOptional, IsString, IsArray, ArrayNotEmpty } from 'class-validator';

export class AddPrivellegesDto {
   @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  names: string[];
}


export class UpdatePrivellegesDto {
  @IsOptional()
  @IsString()
  name?: string;
}

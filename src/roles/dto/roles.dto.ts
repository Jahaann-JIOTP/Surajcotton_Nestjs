import { IsString, IsArray, IsMongoId } from 'class-validator';

export class AddRolesDto {
  @IsString()
  name?: string;

  @IsArray()
  @IsMongoId({ each: true })
  privelleges?: string[];
}

export class UpdateRolesDto {
  @IsString()
  name?: string;

  @IsArray()
  @IsMongoId({ each: true })
  privelleges?: string[];
}

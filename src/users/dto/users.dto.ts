import {
  IsOptional,
  IsString,
  IsEmail,
  IsEnum,
  IsMongoId,
} from 'class-validator';

export class AddUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'banned'])
  userStatus?: string;

  @IsMongoId()
  role: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'banned'])
  userStatus?: string;

  @IsMongoId()
  role: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

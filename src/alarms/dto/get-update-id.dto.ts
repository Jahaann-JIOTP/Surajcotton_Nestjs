import { IsMongoId, IsNotEmpty } from 'class-validator';

export class GetUpdateIdDto {
  @IsMongoId()
  @IsNotEmpty()
  typeId: string;
}

// src/heatmap/transformers/dto/create-transformer-input.dto.ts
import { IsIn, IsNumber } from 'class-validator';

export class CreateTransformerInputDto {
  @IsIn(['T1', 'T2', 'T3', 'T4'])
  transformerName: 'T1' | 'T2' | 'T3' | 'T4';

  @IsNumber()
  value: number;
}

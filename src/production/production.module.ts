// src/production/production.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { Production, ProductionSchema } from './schemas/production.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Production.name, schema: ProductionSchema }],
    'surajcotton',
),
  ],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}


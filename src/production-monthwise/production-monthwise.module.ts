import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductionMonthwiseController } from './production-monthwise.controller';
import { ProductionMonthwiseService } from './production-monthwise.service';
import { Production, ProductionSchema } from '../production/schemas/production.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Production.name, schema: ProductionSchema }],
      'surajcotton'
    ),
  ],
  controllers: [ProductionMonthwiseController],
  providers: [ProductionMonthwiseService],
})
export class ProductionMonthwiseModule {}

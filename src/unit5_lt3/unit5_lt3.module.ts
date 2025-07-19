import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Unit5LT3Service } from './unit5_lt3.service';
import { Unit5LT3Controller } from './unit5_lt3.controller';
import { Unit5LT3, Unit5LT3Schema } from './schemas/unit5_LT3.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Unit5LT3.name, schema: Unit5LT3Schema }],
      'surajcotton' // MongoDB connection name
    ),
  ],
  controllers: [Unit5LT3Controller],
  providers: [Unit5LT3Service],
})
export class Unit5Lt3Module {}

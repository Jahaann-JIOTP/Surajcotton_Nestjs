import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Unit5LT4Service } from './unit5_lt4.service';
import { Unit5LT4Controller } from './unit5_lt4.controller';
import { Unit5LT4, Unit5LT4Schema } from './schemas/unit5_LT4.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Unit5LT4.name, schema: Unit5LT4Schema }],
      'surajcotton' // MongoDB connection name
    ),
  ],
  controllers: [Unit5LT4Controller],
  providers: [Unit5LT4Service],
})
export class Unit5Lt4Module {}

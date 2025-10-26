import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Unit4LT1Service } from './unit4_lt1.service';
import { Unit4LT1Controller } from './unit4_lt1.controller';
import { Unit4LT1, Unit4LT1Schema } from './schemas/unit4_LT1.schema';
import { MeterModule } from 'src/meter/meter.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Unit4LT1.name, schema: Unit4LT1Schema }],
      'surajcotton' // MongoDB connection name
    ),  MeterModule,
  ],
  
  controllers: [Unit4LT1Controller],
  providers: [Unit4LT1Service],
  exports: [Unit4LT1Service], // ✅ this makes it visible to other modules
  
})
export class Unit4Lt1Module {}


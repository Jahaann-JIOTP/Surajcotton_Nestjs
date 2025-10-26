import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Unit5LT3Service } from './unit5_lt3.service';
import { Unit5LT3Controller } from './unit5_lt3.controller';
import { Unit5LT3, Unit5LT3Schema } from './schemas/unit5_LT3.schema';
import { FieldMeterProcess, FieldMeterProcessSchema } from './schemas/field-meter-process.schema';
import { MeterModule } from 'src/meter/meter.module';
@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Unit5LT3.name, schema: Unit5LT3Schema },
      { name: FieldMeterProcess.name, schema: FieldMeterProcessSchema }],
      'surajcotton' // MongoDB connection name
    ),  MeterModule,
  ],
  controllers: [Unit5LT3Controller],
  providers: [Unit5LT3Service],
  exports: [Unit5LT3Service], // ✅ this makes it visible to other modules
})
export class Unit5Lt3Module {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Unit4LT2Service } from './unit4_lt2.service';
import { Unit4LT2Controller } from './unit4_lt2.controller';
import { Unit4LT2, Unit4LT2Schema } from './schemas/unit4_LT2.schema';
import { MeterModule } from 'src/meter/meter.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Unit4LT2.name, schema: Unit4LT2Schema }],
      'surajcotton' // MongoDB connection name
    ),MeterModule,
  ],
  controllers: [Unit4LT2Controller],
  providers: [Unit4LT2Service],
  exports: [Unit4LT2Service], // ✅ this makes it visible to other modules
})
export class Unit4Lt2Module {}

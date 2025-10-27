// src/energy/energy.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EnergyService } from './energy.service';
import { EnergyController } from './energy.controller';
import { Energy, EnergySchema } from './schemas/energy.schema';
import { Unit4Lt1Module } from '../unit4_lt1/unit4_lt1.module';
import { Unit4Lt2Module } from '../unit4_lt2/unit4_lt2.module';
import { Unit5Lt3Module } from '../unit5_lt3/unit5_lt3.module';
import { Unit5Lt4Module } from '../unit5_lt4/unit5_lt4.module';

@Module({

  
  imports: [
    MongooseModule.forFeature([{ name: Energy.name, schema: EnergySchema }

    ],
     'surajcotton', 
),
    Unit4Lt1Module, // ✅ add this line
    Unit4Lt2Module, // ✅ add this line
    Unit5Lt3Module, // ✅ add this line
    Unit5Lt4Module, // ✅ add this line
  ],
  controllers: [EnergyController],
  providers: [EnergyService],
})
export class EnergyModule {}

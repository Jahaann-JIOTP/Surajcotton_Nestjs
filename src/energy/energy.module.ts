// src/energy/energy.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EnergyService } from './energy.service';
import { EnergyController } from './energy.controller';
import { Energy, EnergySchema } from './schemas/energy.schema';

@Module({

  
  imports: [
    MongooseModule.forFeature([{ name: Energy.name, schema: EnergySchema }

    ],
     'surajcotton', 
),
  ],
  controllers: [EnergyController],
  providers: [EnergyService],
})
export class EnergyModule {}

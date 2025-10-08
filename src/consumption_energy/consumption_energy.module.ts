import { MongooseModule } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { ConsumptionEnergyService } from './consumption_energy.service';
import { consumption_energy, consumption_energySchema } from './schemas/consumption_energy.schema';
import { ConsumptionEnergyController} from './consumption_energy.controller';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: consumption_energy.name, schema: consumption_energySchema  },
      ],
      'surajcotton', // <-- connection name
    ),
  ],
   controllers: [ConsumptionEnergyController],
    providers: [ConsumptionEnergyService],
 
})
export class ConsumptionEnergyModule {}

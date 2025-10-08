
import { MongooseModule } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { GenerationEnergyService } from './generation_energy.service';
import { GenerationEnergyController } from './generation_energy.controller'; // ✅ Make sure this name is correct
import { generation_energy, generation_energySchema } from './schemas/generation_energy.schema';


@Module({
     imports: [
        MongooseModule.forFeature(
          [
            { name: generation_energy.name, schema: generation_energySchema  },
          ],
          'surajcotton', // <-- connection name
        ),
      ],
  controllers: [GenerationEnergyController],
  providers: [GenerationEnergyService],
})
export class GenerationEnergyModule {}

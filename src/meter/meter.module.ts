import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeterService } from './meter.service';
import { MeterController } from './meter.controller';
import { MeterToggle, MeterToggleSchema } from './schemas/meter-toggle.schema';
// import { MeterHistory, MeterHistorySchema } from './schemas/meter-history.schema';
import { MeterConfiguration, MeterConfigurationSchema } from './schemas/meter-configuration.schema';
import { Roles, RolesSchema } from '../roles/schema/roles.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MeterToggle.name, schema: MeterToggleSchema },
      // { name: MeterHistory.name, schema: MeterHistorySchema },
       { name: MeterConfiguration.name, schema: MeterConfigurationSchema },
       { name: Roles.name, schema: RolesSchema }
       
    ],
'surajcotton',
),
  ],
  controllers: [MeterController],
  providers: [MeterService],
})
export class MeterModule {}

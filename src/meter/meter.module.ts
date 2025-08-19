import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { MeterService } from './meter.service';
import { MeterController } from './meter.controller';
import { MeterToggle, MeterToggleSchema } from './schemas/meter-toggle.schema';
// import { MeterHistory, MeterHistorySchema } from './schemas/meter-history.schema';
import { MeterConfiguration, MeterConfigurationSchema } from './schemas/meter-configuration.schema';
import { Roles, RolesSchema } from '../roles/schema/roles.schema'
import { FieldMeterRawData, FieldMeterRawDataSchema } from './schemas/field-meter-raw-data.schema';
import { FieldMeterProcessData, FieldMeterProcessDataSchema } from './schemas/field_meter_process_data';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: MeterToggle.name, schema: MeterToggleSchema },
      // { name: MeterHistory.name, schema: MeterHistorySchema },
       { name: MeterConfiguration.name, schema: MeterConfigurationSchema },
       { name: Roles.name, schema: RolesSchema },
          { name: FieldMeterRawData.name, schema: FieldMeterRawDataSchema },
          { name: FieldMeterProcessData.name, schema: FieldMeterProcessDataSchema },

       
    ],
'surajcotton',
),
  ],
  controllers: [MeterController],
  providers: [MeterService],
})
export class MeterModule {}

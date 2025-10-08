import { Module } from '@nestjs/common';
import { AlarmsController } from './alarms.controller';
import { AlarmsService } from './alarms.service';
import { HelpersModule } from 'src/helpers/helpers.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AlarmsType, AlarmsTypeSchema } from './schema/alarmsType.schema';
import {
  alarmsConfiguration,
  AlarmsConfigurationSchema,
} from './schema/alarmsConfig.schema';
import {
  AlarmRulesSet,
  AlarmRulesSetSchema,
} from './schema/alarmsTriggerConfig.schema';
import { HttpModule } from '@nestjs/axios';
import { Alarms, AlarmsSchema } from './schema/alarmsModel.schema';
import {
  AlarmOccurrence,
  AlarmsOccurrenceSchema,
} from './schema/alarmOccurences.schema';

@Module({
  imports: [
    HelpersModule,
    HttpModule,
    MongooseModule.forFeature(
      [
        { name: AlarmsType.name, schema: AlarmsTypeSchema },
        { name: alarmsConfiguration.name, schema: AlarmsConfigurationSchema },
        { name: AlarmRulesSet.name, schema: AlarmRulesSetSchema },
        { name: Alarms.name, schema: AlarmsSchema },
        { name: AlarmOccurrence.name, schema: AlarmsOccurrenceSchema },
      ],
      'surajcotton',
    ),
  ],
  controllers: [AlarmsController],
  providers: [AlarmsService],
})
export class AlarmsModule {}

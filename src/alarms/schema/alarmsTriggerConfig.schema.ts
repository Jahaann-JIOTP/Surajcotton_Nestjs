// alarmsTriggerConfig.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class ThresholdCondition {
  // Mongoose will provide an _id for subdocuments at runtime; declare it for TS
  _id?: Types.ObjectId;
  @Prop({ required: true })
  value: number;

  @Prop({ enum: ['>', '<', '>=', '<=', '==', '!='], required: true })
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
}

@Schema({ collection: 'alarmsRuleSet' })
export class AlarmRulesSet {
  @Prop() persistenceTime?: number;
  @Prop() occursCount?: number;
  @Prop() occursWithin?: number;
  @Prop({ enum: ['&&', '||', '', 'null'] })
  conditionType: '&&' | '||' | '' | 'null';

  @Prop({ type: [ThresholdCondition], required: true })
  thresholds: ThresholdCondition[];
  _id: undefined;
}

export type AlarmRulesSetDocument = AlarmRulesSet & Document;
export const AlarmRulesSetSchema = SchemaFactory.createForClass(AlarmRulesSet);

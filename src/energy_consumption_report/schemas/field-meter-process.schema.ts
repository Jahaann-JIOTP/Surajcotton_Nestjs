import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as moment from 'moment-timezone';

@Schema({ collection: 'FM_process ', timestamps: true })    // FM_process   for local server   // for production FM_Process_Prod
export class FieldMeterProcess extends Document {
  @Prop({ required: true, index: true })
  meterId: string;

  @Prop({ 
    type: Map, 
    of: {
      fV: { type: Number },
      lV: { type: Number },
      CONS: { type: Number },
    },
    required: true,
  })
  meters: Map<string, { fV: number, lV: number, CONS: number }>;

  @Prop({
    type: Date,
    default: () => moment().tz('Asia/Karachi').toDate(),
  })
  timestamp: Date;

  @Prop({ type: Number, default: 0 })
  cumulative_con: number;
}

export const FieldMeterProcessSchema = SchemaFactory.createForClass(FieldMeterProcess);

// Pre-save hook
FieldMeterProcessSchema.pre<FieldMeterProcess>('save', function(next) {
  let total = 0;

  this.meters.forEach((meterData) => {
    let fV = meterData.fV;
    let lV = meterData.lV;

    if (fV === 0 && lV !== 0) fV = 0; // first non-zero logic if needed
    if (lV === 0 && fV !== 0) lV = fV; // last zero fallback

    const con = lV - fV;
    meterData.CONS = con >= 0 ? con : 0;

    total += meterData.CONS;
  });

  this.cumulative_con = total;
  next();
});

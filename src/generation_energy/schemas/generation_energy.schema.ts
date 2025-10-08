import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// If you want to define a custom collection name, you can specify it here.
@Schema({ collection: 'historical' })  // Custom collection name if needed
export class generation_energy extends Document {
  @Prop()
  timestamp: string;

  @Prop()
 U2_PLC_Del_ActiveEnergy?: number;

  @Prop()
 U1_PLC_Del_ActiveEnergy?: number;

  
}

export const generation_energySchema = SchemaFactory.createForClass(generation_energy);

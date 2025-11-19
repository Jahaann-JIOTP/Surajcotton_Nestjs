// meter-5min.schema.ts
import { Schema, Document } from 'mongoose';

export type Meter5MinDocument = Document;

export const Meter5Min = 'Meter5Min';   // <-- ADD THIS

export const Meter5MinSchema = new Schema(
  {
    isProcessed: { type: Boolean, default: false }
  },
  {
    strict: false,
    collection: '5min_historical',
  }
);

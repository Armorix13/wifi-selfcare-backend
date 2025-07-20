import mongoose, { Document, Schema } from 'mongoose';

// TypeScript interface for ComplaintType
export interface IComplaintType extends Document {
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose schema for ComplaintType
const ComplaintTypeSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
  },
  { timestamps: true }
);

// Mongoose model for ComplaintType
const ComplaintType = mongoose.model<IComplaintType>('ComplaintType', ComplaintTypeSchema);

export { ComplaintType };

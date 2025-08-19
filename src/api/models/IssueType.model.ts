import mongoose, { Document, Schema } from 'mongoose';

export interface IIssueType extends Document {
  name: string;
  description?: string;
  type: 'WIFI' | 'CCTV';
  dt: string;
  createdAt: Date;
  updatedAt: Date;
}

const IssueTypeSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    type: { 
      type: String, 
      required: true, 
      enum: ['WIFI', 'CCTV'],
      default: 'WIFI'
    },
    dt: { type: String, required: true },
  },
  { timestamps: true }
);

const IssueType = mongoose.model<IIssueType>('IssueType', IssueTypeSchema);

export { IssueType}; 
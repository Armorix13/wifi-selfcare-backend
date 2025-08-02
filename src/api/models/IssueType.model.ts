import mongoose, { Document, Schema } from 'mongoose';

export interface IIssueType extends Document {
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IssueTypeSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
  },
  { timestamps: true }
);

const IssueType = mongoose.model<IIssueType>('IssueType', IssueTypeSchema);

export { IssueType}; 
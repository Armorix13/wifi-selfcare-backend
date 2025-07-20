import mongoose, { Document, Schema } from 'mongoose';

export interface IPlan extends Document {
  title: string;
  price: number;
  validity: string;
  speed: string;
  dataLimit: string;
  provider: string;
  logo: string;
  benefits: string;
  description: string;
  planType: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true },
    validity: { type: String, required: true },
    speed: { type: String, required: true },
    dataLimit: { type: String, required: true },
    provider: { type: String, required: true },
    logo: { type: String, required: true },
    benefits: { type: String, required: true },
    description: { type: String, required: true },
    planType: { type: String, required: true },
  },
  { timestamps: true }
);

const Plan = mongoose.model<IPlan>('Plan', PlanSchema);

export { Plan }; 
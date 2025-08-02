import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IIptvPlan extends Document {
  name: string; // Plan name like "Skypro Lite Play HD"
  totalChannels: number;
  payChannels: number;
  freeToAirChannels: number;
  price: number;
  lcoMarginPercent: number;
  distributorMarginPercent: number;
  channelList: string[]; // Optional: can list channel names
  planType: 'starter' | 'lite' | 'popular' | 'family' | 'vip' | 'custom';
  quality: 'SD' | 'HD' | 'Mixed';
  provider: string;
  logo: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const IptvPlanSchema = new Schema<IIptvPlan>(
  {
    name: { type: String, required: true },
    totalChannels: { type: Number, required: true },
    payChannels: { type: Number, required: true },
    freeToAirChannels: { type: Number, required: true },
    price: { type: Number, required: true },
    lcoMarginPercent: { type: Number, default: 10 },
    distributorMarginPercent: { type: Number, default: 5 },
    channelList: [{ type: String }], // Optional
    planType: {
      type: String,
      enum: ['starter', 'lite', 'popular', 'family', 'vip', 'custom'],
      required: true
    },
    quality: {
      type: String,
      enum: ['SD', 'HD', 'Mixed'],
      default: 'Mixed'
    },
    provider: { type: String, default: 'Skypro' },
    logo: { type: String, required: true },
    description: { type: String, required: true }
  },
  { timestamps: true }
);

const IptvPlan: Model<IIptvPlan> = mongoose.model<IIptvPlan>('IptvPlan', IptvPlanSchema);
export { IptvPlan };

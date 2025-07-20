import mongoose, { Document, Schema } from 'mongoose';

export interface IRecharge extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phoneNumber: string;
  alternatePhoneNumber?: string;
  aadhaarFrontUrl: string;
  aadhaarBackUrl: string;
  passportPhotoUrl: string;
  agreementAccepted: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const RechargeSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    alternatePhoneNumber: { type: String },
    aadhaarFrontUrl: { type: String, required: true },
    aadhaarBackUrl: { type: String, required: true },
    passportPhotoUrl: { type: String, required: true },
    agreementAccepted: { type: Boolean, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

const Recharge = mongoose.model<IRecharge>('Recharge', RechargeSchema);

export { Recharge }; 
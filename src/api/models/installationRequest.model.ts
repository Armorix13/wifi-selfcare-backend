import mongoose, { Document, Schema } from 'mongoose';

export interface IInstallationRequest extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  alternateCountryCode?: string;
  alternatePhoneNumber?: string;
  aadhaarFrontUrl: string;
  aadhaarBackUrl: string;
  passportPhotoUrl: string;
  agreementAccepted: boolean;
  status: 'pending' | 'approved' | 'rejected';
  approvedDate?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstallationRequestSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
    name: { type: String },
    email: { type: String },
    phoneNumber: { type: String },
    alternatePhoneNumber: { type: String },
    countryCode: { type: String },
    alternateCountryCode: { type: String },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl: { type: String },
    passportPhotoUrl: { type: String },
    agreementAccepted: { type: Boolean },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedDate: { type: Date },
    remarks: { type: String }
  },
  { timestamps: true }
);

const InstallationRequest = mongoose.model<IInstallationRequest>('InstallationRequest', InstallationRequestSchema);

export { InstallationRequest }; 
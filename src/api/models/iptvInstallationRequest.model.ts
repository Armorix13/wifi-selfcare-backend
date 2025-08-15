import mongoose, { Document, Schema } from 'mongoose';

export interface IptvInstallationRequest extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  iptvPlanId?: mongoose.Types.ObjectId;
  status: 'inreview' | 'approved' | 'rejected';
  approvedDate?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
  assignedEngineer?: mongoose.Types.ObjectId;
  installationAddress?: string;
  preferredInstallationDate?: Date;
  deviceType?: 'iptv-box' | 'smart-tv' | 'android-box' | 'other';
  existingInternetProvider?: string;
  internetSpeed?: string;
}

const IptvInstallationRequestSchema: Schema = new Schema(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      required: true
    },
    name: { 
      type: String,
      required: true
    },
    email: { 
      type: String,
      required: true
    },
    phoneNumber: { 
      type: String,
      required: true
    },
    countryCode: { 
      type: String,
      required: true
    },
    iptvPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'IptvPlan'
    },
    status: { 
      type: String, 
      enum: ['inreview', 'approved', 'rejected'], 
      default: 'inreview'
    },
    approvedDate: { 
      type: Date
    },
    remarks: { 
      type: String
    },
    assignedEngineer: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    installationAddress: {
      type: String
    },
    preferredInstallationDate: {
      type: Date
    },
    deviceType: {
      type: String,
      enum: ['iptv-box', 'smart-tv', 'android-box', 'other']
    },
    existingInternetProvider: {
      type: String
    },
    internetSpeed: {
      type: String
    }
  },
  { timestamps: true }
);

// Pre-save middleware to ensure status is always valid
IptvInstallationRequestSchema.pre('save', function(next) {
  // Ensure status is always one of the valid enum values
  if (this.isNew && (!this.status || !['inreview', 'approved', 'rejected'].includes(this.status as string))) {
    this.status = 'inreview';
  }
  next();
});

const IptvInstallationRequest = mongoose.model<IptvInstallationRequest>('IptvInstallationRequest', IptvInstallationRequestSchema);

export { IptvInstallationRequest }; 
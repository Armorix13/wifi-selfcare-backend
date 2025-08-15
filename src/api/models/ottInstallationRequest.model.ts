import mongoose, { Document, Schema } from 'mongoose';

export interface OttInstallationRequest extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  ottPlanId?: mongoose.Types.ObjectId;
  status: 'inreview' | 'approved' | 'rejected';
  approvedDate?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
  assignedEngineer?: mongoose.Types.ObjectId;
  installationAddress?: string;
  preferredInstallationDate?: Date;
  deviceType?: 'smart-tv' | 'firestick' | 'android-box' | 'other';
  existingInternetProvider?: string;
  internetSpeed?: string;
}

const OttInstallationRequestSchema: Schema = new Schema(
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
    ottPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'OttPlan'
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
      enum: ['smart-tv', 'firestick', 'android-box', 'other']
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
OttInstallationRequestSchema.pre('save', function(next) {
  // Ensure status is always one of the valid enum values
  if (this.isNew && (!this.status || !['inreview', 'approved', 'rejected'].includes(this.status as string))) {
    this.status = 'inreview';
  }
  next();
});

const OttInstallationRequest = mongoose.model<OttInstallationRequest>('OttInstallationRequest', OttInstallationRequestSchema);

export { OttInstallationRequest }; 
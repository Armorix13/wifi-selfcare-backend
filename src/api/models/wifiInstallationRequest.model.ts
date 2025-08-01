import mongoose, { Document, Schema } from 'mongoose';

export interface IWifiInstallationRequest extends Document {
  userId: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  alternateCountryCode?: string;
  alternatePhoneNumber?: string;
  aadhaarFrontUrl: string;
  aadhaarBackUrl: string;
  passportPhotoUrl: string;
  status: 'inreview' | 'approved' | 'rejected';
  approvedDate?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WifiInstallationRequestSchema: Schema = new Schema(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      required: true
    },
    applicationId: { 
      type: Schema.Types.ObjectId, 
      ref: 'ApplicationForm',
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
    alternateCountryCode: { 
      type: String
    },
    alternatePhoneNumber: { 
      type: String
    },
    aadhaarFrontUrl: { 
      type: String,
      required: true
    },
    aadhaarBackUrl: { 
      type: String,
      required: true
    },
    passportPhotoUrl: { 
      type: String,
      required: true
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
    }
  },
  { timestamps: true }
);

// Pre-save middleware to ensure status is always valid
WifiInstallationRequestSchema.pre('save', function(next) {
  console.log('Pre-save middleware - Current status:', this.status as string);
  console.log('Pre-save middleware - Is new:', this.isNew);
  
  // Ensure status is always one of the valid enum values
  if (this.isNew && (!this.status || !['inreview', 'approved', 'rejected'].includes(this.status as string))) {
    console.log('Pre-save middleware - Setting status to inreview');
    this.status = 'inreview';
  }
  next();
});

const WifiInstallationRequest = mongoose.model<IWifiInstallationRequest>('WifiInstallationRequest', WifiInstallationRequestSchema);

export { WifiInstallationRequest }; 
import mongoose, { Document, Schema } from 'mongoose';

export interface IApplicationForm extends Document {
  userId: mongoose.Types.ObjectId;
  applicationId?: string;
  phoneNumber: string;
  countryCode: string;
  alternateCountryCode?: string;
  alternatePhoneNumber?: string;
  status: 'inreview' | 'accept' | 'reject';
  planId: mongoose.Types.ObjectId;
  pincode: string;
  name: string;
  village: string;
  address: string;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationFormSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    applicationId: {
      type: String,
      unique: true
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
    status: {
      type: String,
      enum: ['inreview', 'accept', 'reject'],
      default: 'inreview',
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
    },
    pincode: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    village: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    rejectedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Pre-save middleware to generate application ID
ApplicationFormSchema.pre('save', function(next) {
  if (this.isNew) {
    const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.applicationId = `WIFI-${randomNumber}`;
  }
  next();
});

const ApplicationForm = mongoose.model<IApplicationForm>('ApplicationForm', ApplicationFormSchema);

export { ApplicationForm };



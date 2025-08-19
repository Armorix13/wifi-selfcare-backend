import mongoose, { Document, Schema } from 'mongoose';

export interface RequestBill extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  billType: 'wifi' | 'iptv' | 'ott' | 'fibre' | 'other';
  planId?: mongoose.Types.ObjectId;
  planName?: string;
  billAmount?: number;
  billPeriod?: string; // e.g., "January 2024", "Q1 2024"
  status: 'pending' | 'bill_uploaded' | 'payment_pending' | 'payment_uploaded' | 'completed' | 'rejected';
  requestDate: Date;
  billUploadDate?: Date;
  paymentUploadDate?: Date;
  adminRemarks?: string;
  userRemarks?: string;
  billFileUrl?: string;
  paymentProofUrl?: string;
  assignedAdmin?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RequestBillSchema: Schema = new Schema(
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
    billType: { 
      type: String,
      enum: ['wifi', 'iptv', 'ott', 'fibre', 'other']
    },
    planId: {
      type: Schema.Types.ObjectId,
    },
    planName: {
      type: String
    },
    billAmount: {
      type: Number
    },
    billPeriod: {
      type: String
    },
    status: { 
      type: String, 
      enum: ['pending', 'bill_uploaded', 'payment_pending', 'payment_uploaded', 'completed', 'rejected'], 
      default: 'pending'
    },
    requestDate: { 
      type: Date,
      default: Date.now
    },
    billUploadDate: { 
      type: Date
    },
    paymentUploadDate: { 
      type: Date
    },
    adminRemarks: { 
      type: String
    },
    userRemarks: { 
      type: String
    },
    billFileUrl: { 
      type: String
    },
    paymentProofUrl: { 
      type: String
    },
    assignedAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Pre-save middleware to ensure status is always valid
RequestBillSchema.pre('save', function(next) {
  // Ensure status is always one of the valid enum values
  if (this.isNew && (!this.status || !['pending', 'bill_uploaded', 'payment_pending', 'payment_uploaded', 'completed', 'rejected'].includes(this.status as string))) {
    this.status = 'pending';
  }
  next();
});

const RequestBill = mongoose.model<RequestBill>('RequestBill', RequestBillSchema);

export { RequestBill };

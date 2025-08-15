import mongoose, { Schema, Document, Model } from "mongoose";

enum CctvStatus {
  NOT_REQUESTED = 1,
  APPLICATION_SUBMITTED = 2,
  APPLICATION_ACCEPTED = 3,
  APPLICATION_REJECTED = 4
}

enum Priority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent"
}

export interface ICctvRequest extends Document {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  countryCode: string;
  pincode: string;
  area: string;
  status: CctvStatus;
  userId: mongoose.Types.ObjectId;
  isActive: boolean;
  assignId: mongoose.Types.ObjectId; // Engineer assigned
  assignDate: Date;
  priority: Priority;
  remarks?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CctvRequestSchema = new Schema<ICctvRequest>({
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  countryCode: {
    type: String,
    required: true,
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    trim: true
  },
  area: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: Number,
    enum: Object.values(CctvStatus),
    default: CctvStatus.NOT_REQUESTED
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignId: {
    type: Schema.Types.ObjectId,
    ref: "User" // Reference to engineer
  },
  assignDate: {
    type: Date
  },
  priority: {
    type: String,
    enum: Object.values(Priority),
    default: Priority.MEDIUM
  },
  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
CctvRequestSchema.index({ userId: 1 });
CctvRequestSchema.index({ assignId: 1 });
CctvRequestSchema.index({ status: 1 });
CctvRequestSchema.index({ priority: 1 });
CctvRequestSchema.index({ isActive: 1 });
CctvRequestSchema.index({ createdAt: -1 });

// Virtual for full name
CctvRequestSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for full phone number
CctvRequestSchema.virtual('fullPhoneNumber').get(function() {
  return `${this.countryCode}${this.phoneNumber}`;
});

// Pre-save middleware to set assignDate when engineer is assigned
CctvRequestSchema.pre('save', function(next) {
  if (this.isModified('assignId') && this.assignId && !this.assignDate) {
    this.assignDate = new Date();
  }
  next();
});

// Static method to find by status
CctvRequestSchema.statics.findByStatus = function(status: CctvStatus) {
  return this.find({ status });
};

// Static method to find by engineer
CctvRequestSchema.statics.findByEngineer = function(engineerId: mongoose.Types.ObjectId) {
  return this.find({ assignId: engineerId });
};

// Static method to find active requests
CctvRequestSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

const CctvRequestModel: Model<ICctvRequest> = mongoose.model<ICctvRequest>("CctvRequest", CctvRequestSchema);

export { CctvRequestModel, CctvStatus, Priority };

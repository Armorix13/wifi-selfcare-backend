import mongoose, { Schema, Document, Model } from "mongoose";

enum AreaType {
  RURAL = "rural",
  URBAN = "urban"
}

enum IVRStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ASSIGNED = "assigned",
  UNASSIGNED = "unassigned"
}

export interface IIVR extends Document {
  ivrNumber: string; // Unique IVR number
  name: string; // Name/label for the IVR
  area: AreaType; // Rural or Urban area
  isAssigned: boolean; // Whether the IVR is assigned to a company
  assignedToCompany?: mongoose.Types.ObjectId; // Reference to User (company with ADMIN role) - only if isAssigned is true
  associatedCompany?: mongoose.Types.ObjectId; // Reference to User (parent company/admin)
  status: IVRStatus; // Status of the IVR
  description?: string; // Optional description
  addedBy?: mongoose.Types.ObjectId; // Reference to User who added this IVR
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for IVR Model with static methods
export interface IIVRModel extends Model<IIVR> {
  findAssignedIVRs(): Promise<IIVR[]>;
  findUnassignedIVRs(): Promise<IIVR[]>;
  findIVRsByCompany(companyId: mongoose.Types.ObjectId): Promise<IIVR[]>;
  findIVRsByArea(area: AreaType): Promise<IIVR[]>;
  assignToCompany(ivrId: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId): Promise<IIVR>;
  unassignFromCompany(ivrId: mongoose.Types.ObjectId): Promise<IIVR>;
}

const IVRSchema = new Schema<IIVR>({
  ivrNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  area: {
    type: String,
    enum: Object.values(AreaType),
    required: true
  },
  isAssigned: {
    type: Boolean,
    default: false
  },
  assignedToCompany: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: function(this: IIVR) {
      return this.isAssigned === true;
    }
  },
  associatedCompany: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  status: {
    type: String,
    enum: Object.values(IVRStatus),
    default: IVRStatus.INACTIVE
  },
  description: {
    type: String,
    trim: true
  },
  addedBy: {
    type: Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});

// Indexes for better performance
IVRSchema.index({ ivrNumber: 1 });
IVRSchema.index({ isAssigned: 1 });
IVRSchema.index({ assignedToCompany: 1 });
IVRSchema.index({ area: 1 });
IVRSchema.index({ status: 1 });

// Method to assign IVR to a company
IVRSchema.methods.assignToCompany = function(companyId: mongoose.Types.ObjectId) {
  this.isAssigned = true;
  this.assignedToCompany = companyId;
  this.status = IVRStatus.ASSIGNED;
  return this.save();
};

// Method to unassign IVR from company
IVRSchema.methods.unassignFromCompany = function() {
  this.isAssigned = false;
  this.assignedToCompany = undefined;
  this.status = IVRStatus.UNASSIGNED;
  return this.save();
};

// Static method to find assigned IVRs
IVRSchema.statics.findAssignedIVRs = function() {
  return this.find({ isAssigned: true }).populate('assignedToCompany', 'companyName email companyPhone').sort({ createdAt: -1 });
};

// Static method to find unassigned IVRs
IVRSchema.statics.findUnassignedIVRs = function() {
  return this.find({ isAssigned: false }).sort({ createdAt: -1 });
};

// Static method to find IVRs by company
IVRSchema.statics.findIVRsByCompany = function(companyId: mongoose.Types.ObjectId) {
  return this.find({ assignedToCompany: companyId }).populate('assignedToCompany', 'companyName email companyPhone').sort({ createdAt: -1 });
};

// Static method to find IVRs by area
IVRSchema.statics.findIVRsByArea = function(area: AreaType) {
  return this.find({ area }).sort({ createdAt: -1 });
};

// Static method to assign IVR to company
IVRSchema.statics.assignToCompany = function(ivrId: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId) {
  return this.findByIdAndUpdate(
    ivrId,
    {
      isAssigned: true,
      assignedToCompany: companyId,
      status: IVRStatus.ASSIGNED
    },
    { new: true }
  );
};

// Static method to unassign IVR from company
IVRSchema.statics.unassignFromCompany = function(ivrId: mongoose.Types.ObjectId) {
  return this.findByIdAndUpdate(
    ivrId,
    {
      isAssigned: false,
      $unset: { assignedToCompany: "" },
      status: IVRStatus.UNASSIGNED
    },
    { new: true }
  );
};

const IVRModel: IIVRModel = mongoose.model<IIVR, IIVRModel>("IVR", IVRSchema);

export { IVRModel, AreaType, IVRStatus };

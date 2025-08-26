import mongoose, { Schema, Document, Model } from "mongoose";
import { upload } from '../services/upload.service';

// SUBMS Status Enum
enum SUBMSStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  MAINTENANCE = "maintenance",
  OFFLINE = "offline",
  ERROR = "error"
}

// Power Status Enum
enum PowerStatus {
  ON = "on",
  OFF = "off",
  STANDBY = "standby",
  ERROR = "error"
}

// SUBMS Type Enum
enum SUBMSType {
  SPLITTER_1_2 = "1x2",
  SPLITTER_1_4 = "1x4",
  SPLITTER_1_8 = "1x8",
  SPLITTER_1_16 = "1x16",
  OTHER = "other"
}

// Input/Output Interface for SUBMS connections
interface ISUBMSConnection {
  type: "olt" | "ms" | "subms" | "fdb" | "x2" | "other";
  id: string; // Reference ID
  port?: number; // Port number if applicable
  description?: string;
}

// GeoJSON Point Interface
interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ISUBMS extends Document {
  // Basic SUBMS Information
  submsId?: string; // SUBMS ID (e.g., SUBMS001) - Auto-generated if not provided
  submsName: string; // SUBMS Name
  submsType: SUBMSType; // Type of splitter
  submsPower?: number; // SUBMS Power (e.g., 2)
  
  // Location Information
  latitude: number; // Separate latitude field
  longitude: number; // Separate longitude field
  location: IGeoPoint; // GeoJSON Point for geospatial queries
  
  // Connection Information
  input: ISUBMSConnection; // Input connection (usually from MS)
  outputs?: ISUBMSConnection[]; // Output connections
  
  // Technical Specifications
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  hardwareVersion?: string;
  
  // Power Information
  powerStatus: PowerStatus;
  powerConsumption?: number; // in watts
  voltage?: number; // in volts
  current?: number; // in amperes
  
  // Status and Health
  status: SUBMSStatus;
  uptime?: number; // in seconds
  lastSeen?: Date;
  temperature?: number; // in celsius
  
  // Splitter Specifications
  splitRatio?: string; // e.g., "1:8"
  insertionLoss?: number; // in dB
  returnLoss?: number; // in dB
  wavelength?: string; // e.g., "1310nm/1550nm"
  
  // Port Information
  totalPorts?: number;
  activePorts?: number;
  availablePorts?: number;
  
  // Administrative Information
  description?: string;
  locationName?: string; // Human readable location
  address?: string; // Physical address
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  
  // Management and Ownership
  ownedBy: mongoose.Types.ObjectId; // Admin(Company) that owns this SUBMS
  assignedEngineer?: mongoose.Types.ObjectId;
  assignedCompany?: mongoose.Types.ObjectId;
  addedBy?: mongoose.Types.ObjectId;
  
  // Attachments
  attachments: string[]; // Array of strings as links with minimum 2 required
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

// SUBMS Connection Schema
const SUBMSConnectionSchema = new Schema<ISUBMSConnection>({
  type: {
    type: String,
    enum: ["olt", "ms", "subms", "fdb", "x2", "other"],
    required: true
  },
  id: {
    type: String,
    required: true
  },
  port: {
    type: Number,
    min: 1
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: false });

// GeoJSON Point Schema
const GeoPointSchema = new Schema<IGeoPoint>({
  type: {
    type: String,
    enum: ["Point"],
    default: "Point"
  },
  coordinates: {
    type: [Number],
    required: true
  }
}, { _id: false });

const SUBMSSchema = new Schema<ISUBMS>({
  // Basic SUBMS Information
  submsId: { 
    type: String, 
    unique: true,
    trim: true
  },
  submsName: { 
    type: String, 
    required: true,
    trim: true
  },
  submsType: { 
    type: String, 
    enum: Object.values(SUBMSType), 
    default: SUBMSType.SPLITTER_1_4
  },
  submsPower: { 
    type: Number,
    min: 0
  },
  
  // Location Information
  latitude: { 
    type: Number,
    min: -90,
    max: 90
  },
  longitude: { 
    type: Number,
    min: -180,
    max: 180
  },
  location: { 
    type: GeoPointSchema
  },
  
  // Connection Information
  input: { 
    type: SUBMSConnectionSchema,
    required: true
  },
  outputs: [{ 
    type: SUBMSConnectionSchema
  }],
  
  // Technical Specifications
  manufacturer: { 
    type: String,
    trim: true
  },
  model: { 
    type: String,
    trim: true
  },
  serialNumber: { 
    type: String,
    trim: true
  },
  firmwareVersion: { 
    type: String,
    trim: true
  },
  hardwareVersion: { 
    type: String,
    trim: true
  },
  
  // Power Information
  powerStatus: { 
    type: String, 
    enum: Object.values(PowerStatus), 
    default: PowerStatus.OFF
  },
  powerConsumption: { 
    type: Number,
    min: 0
  },
  voltage: { 
    type: Number,
    min: 0
  },
  current: { 
    type: Number,
    min: 0
  },
  
  // Status and Health
  status: { 
    type: String, 
    enum: Object.values(SUBMSStatus), 
    default: SUBMSStatus.INACTIVE
  },
  uptime: { 
    type: Number,
    min: 0
  },
  lastSeen: { 
    type: Date 
  },
  temperature: { 
    type: Number,
    min: -50,
    max: 100
  },
  
  // Splitter Specifications
  splitRatio: { 
    type: String,
    trim: true
  },
  insertionLoss: { 
    type: Number,
    min: 0
  },
  returnLoss: { 
    type: Number,
    min: 0
  },
  wavelength: { 
    type: String,
    trim: true
  },
  
  // Port Information
  totalPorts: { 
    type: Number,
    min: 1
  },
  activePorts: { 
    type: Number,
    min: 0
  },
  availablePorts: { 
    type: Number,
    min: 0
  },
  
  // Administrative Information
  description: { 
    type: String,
    trim: true
  },
  locationName: { 
    type: String,
    trim: true
  },
  address: { 
    type: String,
    trim: true
  },
  city: { 
    type: String,
    trim: true
  },
  state: { 
    type: String,
    trim: true
  },
  country: { 
    type: String,
    trim: true
  },
  postalCode: { 
    type: String,
    trim: true
  },
  
  // Management and Ownership
  ownedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  assignedEngineer: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  assignedCompany: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  addedBy: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  
  // Attachments
  attachments: {
    type: [String],
    required: true,
    validate: {
      validator: function(attachments: string[]) {
        return attachments && attachments.length >= 2;
      },
      message: 'At least 2 attachments are required'
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
SUBMSSchema.index({ submsId: 1 });
SUBMSSchema.index({ submsName: 1 });
SUBMSSchema.index({ "input.id": 1 }); // Index for input connections
SUBMSSchema.index({ "outputs.id": 1 }); // Index for output connections
SUBMSSchema.index({ location: "2dsphere" }); // Geospatial index
SUBMSSchema.index({ status: 1 });
SUBMSSchema.index({ submsType: 1 });
SUBMSSchema.index({ ownedBy: 1 }); // Index for ownedBy field
SUBMSSchema.index({ assignedEngineer: 1 });
SUBMSSchema.index({ assignedCompany: 1 });

// Pre-save middleware
SUBMSSchema.pre('save', function(next) {
  // Generate random SUBMS ID if not provided
  if (!this.submsId) {
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    this.submsId = `SUBMS${randomNum}`;
  }
  
  // Ensure location coordinates match lat/long
  if (this.latitude && this.longitude) {
    this.location = {
      type: "Point",
      coordinates: [this.longitude, this.latitude]
    };
  }
  
  // Auto-calculate total ports based on SUBMS type
  if (!this.totalPorts) {
    switch (this.submsType) {
      case SUBMSType.SPLITTER_1_2:
        this.totalPorts = 2;
        break;
      case SUBMSType.SPLITTER_1_4:
        this.totalPorts = 4;
        break;
      case SUBMSType.SPLITTER_1_8:
        this.totalPorts = 8;
        break;
      case SUBMSType.SPLITTER_1_16:
        this.totalPorts = 16;
        break;
    }
  }
  
  next();
});

// Virtual for calculating available ports
SUBMSSchema.virtual('calculatedAvailablePorts').get(function() {
  if (this.totalPorts && this.activePorts) {
    return this.totalPorts - this.activePorts;
  }
  return undefined;
});

// Method to update port counts
SUBMSSchema.methods.updatePortCounts = function(activePorts: number) {
  this.activePorts = activePorts;
  if (this.totalPorts) {
    this.availablePorts = this.totalPorts - activePorts;
  }
  return this.save();
};

// Method to check if SUBMS is healthy
SUBMSSchema.methods.isHealthy = function() {
  return this.status === SUBMSStatus.ACTIVE && 
         this.powerStatus === PowerStatus.ON &&
         this.temperature && this.temperature < 80;
};

// Method to add output connection
SUBMSSchema.methods.addOutput = function(output: ISUBMSConnection) {
  if (!this.outputs) {
    this.outputs = [];
  }
  this.outputs.push(output);
  return this.save();
};

// Method to remove output connection
SUBMSSchema.methods.removeOutput = function(outputId: string) {
  if (this.outputs) {
    this.outputs = this.outputs.filter(output => output.id !== outputId);
  }
  return this.save();
};

// Method to get connected devices
SUBMSSchema.methods.getConnectedDevices = function() {
  const devices = [];
  
  if (this.input) {
    devices.push({
      type: 'input',
      connection: this.input
    });
  }
  
  if (this.outputs) {
    this.outputs.forEach(output => {
      devices.push({
        type: 'output',
        connection: output
      });
    });
  }
  
  return devices;
};

const SUBMSModel: Model<ISUBMS> = mongoose.model<ISUBMS>("SUBMS", SUBMSSchema);

export { SUBMSModel, SUBMSStatus, PowerStatus, SUBMSType, ISUBMSConnection };

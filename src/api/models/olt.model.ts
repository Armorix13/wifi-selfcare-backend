import mongoose, { Schema, Document, Model } from "mongoose";
import { upload } from '../services/upload.service';

// OLT Status Enum
enum OLTStatus {
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

// OLT Type Enum
enum OLTType {
  GPON = "gpon",
  EPON = "epon",
  XGSPON = "xgspon",
  XGPON = "xgpon",
  OTHER = "other"
}

// GeoJSON Point Interface (following project pattern)
interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IOLT extends Document {
  // Basic OLT Information
  oltId?: string; // OLT ID (e.g., OLT001) - Auto-generated if not provided
  name: string;
  oltIp: string; // OLT IP Address
  macAddress: string; // OLT MAC Address
  serialNumber: string; // OLT Serial Number
  
  // Location Information
  latitude: number; // Separate latitude field
  longitude: number; // Separate longitude field
  location: IGeoPoint; // GeoJSON Point for geospatial queries
  
  // Technical Specifications
  oltType: OLTType;
  oltModel: string;
  manufacturer: string;
  firmwareVersion: string;
  hardwareVersion: string;
  
  // Power Information
  powerStatus: PowerStatus;
  oltPower?: number; // OLT Power (e.g., 2)
  powerConsumption?: number; // in watts
  voltage?: number; // in volts
  current?: number; // in amperes
  
  // Status and Health
  status: OLTStatus;
  uptime?: number; // in seconds
  lastSeen?: Date;
  temperature?: number; // in celsius
  
  // Network Configuration
  subnetMask?: string;
  gateway?: string;
  dnsServers?: string[];
  vlanConfig?: string;
  
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
  
  // Connection Information
  outputs?: Array<{
    type: "ms" | "fdb" | "other";
    id: string;
    port?: number;
    description?: string;
  }>;
  
  // Management and Ownership
  ownedBy: mongoose.Types.ObjectId; // Admin(Company) that owns this OLT
  assignedEngineer?: mongoose.Types.ObjectId;
  assignedCompany?: mongoose.Types.ObjectId;
  addedBy?: mongoose.Types.ObjectId;
  
  // Attachments
  attachments: string[]; // Array of strings as links with minimum 4 required
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

// GeoJSON Point Schema (following project pattern)
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

const OLTSchema = new Schema<IOLT>({
  // Basic OLT Information
  oltId: { 
    type: String, 
    unique: true,
    trim: true
  },
  name: { 
    type: String, 
    trim: true
  },
  oltIp: { 
    type: String, 
    unique: true,
    trim: true
  },
  macAddress: { 
    type: String, 
    unique: true,
    trim: true
  },
  serialNumber: { 
    type: String, 
    unique: true,
    trim: true
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
  
  // Technical Specifications
  oltType: { 
    type: String, 
    enum: Object.values(OLTType), 
    default: OLTType.GPON
  },
  oltModel: { 
    type: String,
    trim: true
  },
  manufacturer: { 
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
    default: PowerStatus.ON
  },
  oltPower: { 
    type: Number,
    min: 0
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
    enum: Object.values(OLTStatus), 
    default: OLTStatus.ACTIVE
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
  
  // Network Configuration
  subnetMask: { 
    type: String,
    trim: true
  },
  gateway: { 
    type: String,
    trim: true
  },
  dnsServers: [{ 
    type: String,
    trim: true
  }],
  vlanConfig: { 
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
  
  // Connection Information
  outputs: [{
    type: {
      type: String,
      enum: ["ms", "fdb", "other"]
    },
    id: {
      type: String,
    },
    port: {
      type: Number,
      min: 1
    },
    description: {
      type: String,
      trim: true
    }
  }],
  
  // Management and Ownership
  ownedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
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
    validate: {
      validator: function(attachments: string[]) {
        return attachments && attachments.length >= 4;
      },
      message: 'At least 4 attachments are required'
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
// Note: unique: true fields automatically create indexes, so we don't need to declare them again
OLTSchema.index({ location: "2dsphere" }); // Geospatial index
OLTSchema.index({ status: 1 });
OLTSchema.index({ oltType: 1 });
OLTSchema.index({ ownedBy: 1 }); // Index for ownedBy field
OLTSchema.index({ assignedEngineer: 1 });
OLTSchema.index({ assignedCompany: 1 });

// Additional indexes for search performance
OLTSchema.index({ manufacturer: 1 });
OLTSchema.index({ oltModel: 1 });
OLTSchema.index({ city: 1 });
OLTSchema.index({ state: 1 });
OLTSchema.index({ country: 1 });
OLTSchema.index({ powerStatus: 1 });
OLTSchema.index({ createdAt: 1 });
OLTSchema.index({ updatedAt: 1 });

// Compound indexes for common query patterns
OLTSchema.index({ status: 1, powerStatus: 1 });
OLTSchema.index({ ownedBy: 1, status: 1 });
OLTSchema.index({ city: 1, state: 1 });
OLTSchema.index({ oltType: 1, status: 1 });
OLTSchema.index({ manufacturer: 1, oltModel: 1 });

// Pre-save middleware to generate OLT ID and ensure location coordinates match lat/long
OLTSchema.pre('save', function(next) {
  // Generate random OLT ID if not provided
  if (!this.oltId) {
    const randomNum = Math.floor(Math.random() * 9000) + 1000; // Generate 4-digit random number
    this.oltId = `OLT${randomNum}`;
  }
  
  // Ensure location coordinates match lat/long
  if (this.latitude && this.longitude) {
    this.location = {
      type: "Point",
      coordinates: [this.longitude, this.latitude] // GeoJSON uses [lng, lat] order
    };
  }
  next();
});

// Virtual for calculating available ports
OLTSchema.virtual('calculatedAvailablePorts').get(function() {
  if (this.totalPorts && this.activePorts) {
    return this.totalPorts - this.activePorts;
  }
  return undefined;
});

// Method to update port counts
OLTSchema.methods.updatePortCounts = function(activePorts: number) {
  this.activePorts = activePorts;
  if (this.totalPorts) {
    this.availablePorts = this.totalPorts - activePorts;
  }
  return this.save();
};

// Method to check if OLT is healthy
OLTSchema.methods.isHealthy = function() {
  return this.status === OLTStatus.ACTIVE && 
         this.powerStatus === PowerStatus.ON &&
         this.temperature && this.temperature < 80;
};

// Method to get OLT health score (0-100)
OLTSchema.methods.getHealthScore = function() {
  let score = 100;
  
  // Status penalty
  if (this.status === OLTStatus.ERROR) score -= 50;
  else if (this.status === OLTStatus.OFFLINE) score -= 40;
  else if (this.status === OLTStatus.MAINTENANCE) score -= 20;
  else if (this.status === OLTStatus.INACTIVE) score -= 10;
  
  // Power status penalty
  if (this.powerStatus === PowerStatus.ERROR) score -= 30;
  else if (this.powerStatus === PowerStatus.OFF) score -= 25;
  else if (this.powerStatus === PowerStatus.STANDBY) score -= 5;
  
  // Temperature penalty
  if (this.temperature) {
    if (this.temperature > 80) score -= 30;
    else if (this.temperature > 70) score -= 20;
    else if (this.temperature > 60) score -= 10;
  }
  
  // Port utilization penalty
  if (this.totalPorts && this.activePorts) {
    const utilization = (this.activePorts / this.totalPorts) * 100;
    if (utilization > 90) score -= 15;
    else if (utilization > 80) score -= 10;
    else if (utilization > 70) score -= 5;
  }
  
  return Math.max(0, score);
};

// Method to get OLT summary information
OLTSchema.methods.getSummary = function() {
  return {
    oltId: this.oltId,
    name: this.name,
    status: this.status,
    powerStatus: this.powerStatus,
    healthScore: this.getHealthScore(),
    location: {
      city: this.city,
      state: this.state,
      country: this.country,
      coordinates: this.location?.coordinates
    },
    ports: {
      total: this.totalPorts,
      active: this.activePorts,
      available: this.availablePorts,
      utilization: this.totalPorts && this.activePorts ? 
        Math.round((this.activePorts / this.totalPorts) * 100) : 0
    },
    lastSeen: this.lastSeen,
    uptime: this.uptime
  };
};

// Method to validate OLT configuration
OLTSchema.methods.validateConfiguration = function() {
  const errors = [];
  
  if (!this.oltIp) errors.push('OLT IP address is required');
  if (!this.macAddress) errors.push('MAC address is required');
  if (!this.serialNumber) errors.push('Serial number is required');
  if (!this.manufacturer) errors.push('Manufacturer is required');
  if (!this.oltModel) errors.push('OLT model is required');
  
  // Validate IP address format
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (this.oltIp && !ipRegex.test(this.oltIp)) {
    errors.push('Invalid IP address format');
  }
  
  // Validate MAC address format
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  if (this.macAddress && !macRegex.test(this.macAddress)) {
    errors.push('Invalid MAC address format');
  }
  
  // Validate port counts
  if (this.totalPorts && this.activePorts && this.activePorts > this.totalPorts) {
    errors.push('Active ports cannot exceed total ports');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const OLTModel: Model<IOLT> = mongoose.model<IOLT>("OLT", OLTSchema);

export { OLTModel, OLTStatus, PowerStatus, OLTType };

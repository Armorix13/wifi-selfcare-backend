import mongoose, { Schema, Document, Model } from "mongoose";

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
  assignedEngineer?: mongoose.Types.ObjectId;
  assignedCompany?: mongoose.Types.ObjectId;
  addedBy?: mongoose.Types.ObjectId;
  
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
    required: true,
    trim: true
  },
  oltIp: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  macAddress: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  serialNumber: { 
    type: String, 
    required: true,
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
    default: PowerStatus.OFF
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
    default: OLTStatus.INACTIVE
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
  }],
  
  // Management and Ownership
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
  }
}, {
  timestamps: true
});

// Indexes for better performance
OLTSchema.index({ oltId: 1 });
OLTSchema.index({ oltIp: 1 });
OLTSchema.index({ macAddress: 1 });
OLTSchema.index({ serialNumber: 1 });
OLTSchema.index({ location: "2dsphere" }); // Geospatial index
OLTSchema.index({ status: 1 });
OLTSchema.index({ oltType: 1 });
OLTSchema.index({ assignedEngineer: 1 });
OLTSchema.index({ assignedCompany: 1 });

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

const OLTModel: Model<IOLT> = mongoose.model<IOLT>("OLT", OLTSchema);

export { OLTModel, OLTStatus, PowerStatus, OLTType };

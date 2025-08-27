import mongoose, { Schema, Document, Model } from "mongoose";
import { upload } from '../services/upload.service';

// X2 Status Enum
enum X2Status {
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

// X2 Type Enum
enum X2Type {
  INDOOR = "indoor",
  OUTDOOR = "outdoor",
  WALL_MOUNTED = "wall_mounted",
  POLE_MOUNTED = "pole_mounted",
  UNDERGROUND = "underground",
  OTHER = "other"
}

// Input/Output Interface for X2 connections
interface IX2Connection {
  type: "olt" | "ms" | "subms" | "fdb" | "x2" | "customer" | "other";
  id: string; // Reference ID
  port?: number; // Port number if applicable
  description?: string;
}

// GeoJSON Point Interface
interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IX2 extends Document {
  // Basic X2 Information
  x2Id?: string; // X2 ID (e.g., X2001) - Auto-generated if not provided
  x2Name: string; // X2 Name
  x2Type: X2Type; // Type of X2
  x2Power?: number; // X2 Power (e.g., 2)
  
  // Location Information
  latitude: number; // Separate latitude field
  longitude: number; // Separate longitude field
  location: IGeoPoint; // GeoJSON Point for geospatial queries
  
  // Connection Information
  input: IX2Connection; // Input connection
  outputs?: IX2Connection[]; // Output connections
  
  // Technical Specifications
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  capacity?: number; // Number of fiber ports
  material?: string; // Material (plastic, metal, etc.)
  protection?: string; // IP rating, weather protection
  
  // Power Information
  powerStatus: PowerStatus;
  powerConsumption?: number; // in watts
  voltage?: number; // in volts
  current?: number; // in amperes
  
  // Status and Health
  status: X2Status;
  uptime?: number; // in seconds
  lastSeen?: Date;
  temperature?: number; // in celsius
  
  // Port Information
  totalPorts?: number;
  activePorts?: number;
  availablePorts?: number;
  fiberType?: string; // Single mode, multi-mode
  connectorType?: string; // SC, LC, FC, etc.
  
  // Administrative Information
  description?: string;
  locationName?: string; // Human readable location
  address?: string; // Physical address
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  
  // Installation Details
  installationDate?: Date;
  installationType?: string; // Pole, wall, underground
  height?: number; // Height from ground in meters
  depth?: number; // Depth if underground in meters
  
  // Customer Connection Details
  customerCapacity?: number; // Number of customers this X2 can serve
  activeCustomers?: number; // Number of active customer connections
  
  // Management and Ownership
  ownedBy: mongoose.Types.ObjectId; // Admin(Company) that owns this X2
  assignedEngineer?: mongoose.Types.ObjectId;
  assignedCompany?: mongoose.Types.ObjectId;
  addedBy?: mongoose.Types.ObjectId;
  
  // Attachments
  attachments: string[]; // Array of strings as links with minimum 2 required
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

// X2 Connection Schema
const X2ConnectionSchema = new Schema<IX2Connection>({
  type: {
    type: String,
    enum: ["olt", "ms", "subms", "fdb", "x2", "customer", "other"],
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

const X2Schema = new Schema<IX2>({
  // Basic X2 Information
  x2Id: { 
    type: String, 
    unique: true,
    trim: true
  },
  x2Name: { 
    type: String, 
    required: true,
    trim: true
  },
  x2Type: { 
    type: String, 
    enum: Object.values(X2Type), 
    default: X2Type.OUTDOOR
  },
  x2Power: { 
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
    type: X2ConnectionSchema,
    required: true
  },
  outputs: [{ 
    type: X2ConnectionSchema
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
  capacity: { 
    type: Number,
    min: 1
  },
  material: { 
    type: String,
    trim: true
  },
  protection: { 
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
    enum: Object.values(X2Status), 
    default: X2Status.INACTIVE
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
  fiberType: { 
    type: String,
    trim: true
  },
  connectorType: { 
    type: String,
    trim: true
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
  
  // Installation Details
  installationDate: { 
    type: Date 
  },
  installationType: { 
    type: String,
    trim: true
  },
  height: { 
    type: Number,
    min: 0
  },
  depth: { 
    type: Number,
    min: 0
  },
  
  // Customer Connection Details
  customerCapacity: { 
    type: Number,
    min: 1
  },
  activeCustomers: { 
    type: Number,
    min: 0
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
// Note: unique: true fields automatically create indexes, so we don't need to declare them again
X2Schema.index({ "input.id": 1 }); // Index for input connections
X2Schema.index({ "outputs.id": 1 }); // Index for output connections
X2Schema.index({ location: "2dsphere" }); // Geospatial index
X2Schema.index({ status: 1 });
X2Schema.index({ x2Type: 1 });
X2Schema.index({ ownedBy: 1 }); // Index for ownedBy field
X2Schema.index({ assignedEngineer: 1 });
X2Schema.index({ assignedCompany: 1 });

// Pre-save middleware
X2Schema.pre('save', function(next) {
  // Generate random X2 ID if not provided
  if (!this.x2Id) {
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    this.x2Id = `X2${randomNum}`;
  }
  
  // Ensure location coordinates match lat/long
  if (this.latitude && this.longitude) {
    this.location = {
      type: "Point",
      coordinates: [this.longitude, this.latitude]
    };
  }
  
  // Auto-set total ports if capacity is provided
  if (this.capacity && !this.totalPorts) {
    this.totalPorts = this.capacity;
  }
  
  next();
});

// Virtual for calculating available ports
X2Schema.virtual('calculatedAvailablePorts').get(function() {
  if (this.totalPorts && this.activePorts) {
    return this.totalPorts - this.activePorts;
  }
  return undefined;
});

// Method to update port counts
X2Schema.methods.updatePortCounts = function(activePorts: number) {
  this.activePorts = activePorts;
  if (this.totalPorts) {
    this.availablePorts = this.totalPorts - activePorts;
  }
  return this.save();
};

// Method to check if X2 is healthy
X2Schema.methods.isHealthy = function() {
  return this.status === X2Status.ACTIVE && 
         this.powerStatus === PowerStatus.ON &&
         this.temperature && this.temperature < 80;
};

// Method to add output connection
X2Schema.methods.addOutput = function(output: IX2Connection) {
  if (!this.outputs) {
    this.outputs = [];
  }
  this.outputs.push(output);
  return this.save();
};

// Method to remove output connection
X2Schema.methods.removeOutput = function(outputId: string) {
  if (this.outputs) {
    this.outputs = this.outputs.filter(output => output.id !== outputId);
  }
  return this.save();
};

// Method to get connected devices
X2Schema.methods.getConnectedDevices = function() {
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

// Method to update customer count
X2Schema.methods.updateCustomerCount = function(activeCustomers: number) {
  this.activeCustomers = activeCustomers;
  return this.save();
};

const X2Model: Model<IX2> = mongoose.model<IX2>("X2", X2Schema);

export { X2Model, X2Status, PowerStatus, X2Type, IX2Connection };

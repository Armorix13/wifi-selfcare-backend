import mongoose, { Schema, Document, Model } from "mongoose";

// MS Status Enum
enum MSStatus {
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

// MS Type Enum
enum MSType {
  SPLITTER_1_2 = "1x2",
  SPLITTER_1_4 = "1x4",
  SPLITTER_1_8 = "1x8",
  SPLITTER_1_16 = "1x16",
  SPLITTER_1_32 = "1x32",
  SPLITTER_1_64 = "1x64",
  OTHER = "other"
}

// Input/Output Interface for MS connections
interface IMSConnection {
  type: "olt" | "ms" | "odf" | "other";
  id: string; // Reference ID (OLT ID, MS ID, etc.)
  port?: number; // Port number if applicable
  description?: string;
}

// GeoJSON Point Interface (following project pattern)
interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IMS extends Document {
  // Basic MS Information
  msId?: string; // MS ID (e.g., MS001) - Auto-generated if not provided
  msName: string; // MS Name
  msType: MSType; // Type of splitter
  msPower?: number; // MS Power (e.g., 4)
  
  // Location Information
  latitude: number; // Separate latitude field
  longitude: number; // Separate longitude field
  location: IGeoPoint; // GeoJSON Point for geospatial queries
  
  // Connection Information
  input: IMSConnection; // Input connection (usually from OLT)
  outputs?: IMSConnection[]; // Output connections (to other MS, ODF, etc.)
  
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
  status: MSStatus;
  uptime?: number; // in seconds
  lastSeen?: Date;
  temperature?: number; // in celsius
  
  // Splitter Specifications
  splitRatio?: string; // e.g., "1:32"
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
  assignedEngineer?: mongoose.Types.ObjectId;
  assignedCompany?: mongoose.Types.ObjectId;
  addedBy?: mongoose.Types.ObjectId;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

// MS Connection Schema
const MSConnectionSchema = new Schema<IMSConnection>({
  type: {
    type: String,
    enum: ["olt", "ms", "odf", "other"],
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

const MSSchema = new Schema<IMS>({
  // Basic MS Information
  msId: { 
    type: String, 
    unique: true,
    trim: true
  },
  msName: { 
    type: String, 
    required: true,
    trim: true
  },
  msType: { 
    type: String, 
    enum: Object.values(MSType), 
    default: MSType.SPLITTER_1_8
  },
  msPower: { 
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
    type: MSConnectionSchema,
    required: true
  },
  outputs: [{ 
    type: MSConnectionSchema
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
    enum: Object.values(MSStatus), 
    default: MSStatus.INACTIVE
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
MSSchema.index({ msId: 1 });
MSSchema.index({ msName: 1 });
MSSchema.index({ "input.id": 1 }); // Index for input connections
MSSchema.index({ "outputs.id": 1 }); // Index for output connections
MSSchema.index({ location: "2dsphere" }); // Geospatial index
MSSchema.index({ status: 1 });
MSSchema.index({ msType: 1 });
MSSchema.index({ assignedEngineer: 1 });
MSSchema.index({ assignedCompany: 1 });

// Pre-save middleware to generate MS ID and ensure location coordinates match lat/long
MSSchema.pre('save', function(next) {
  // Generate random MS ID if not provided
  if (!this.msId) {
    const randomNum = Math.floor(Math.random() * 9000) + 1000; // Generate 4-digit random number
    this.msId = `MS${randomNum}`;
  }
  
  // Ensure location coordinates match lat/long
  if (this.latitude && this.longitude) {
    this.location = {
      type: "Point",
      coordinates: [this.longitude, this.latitude] // GeoJSON uses [lng, lat] order
    };
  }
  
  // Auto-calculate total ports based on MS type if not provided
  if (!this.totalPorts) {
    switch (this.msType) {
      case MSType.SPLITTER_1_2:
        this.totalPorts = 2;
        break;
      case MSType.SPLITTER_1_4:
        this.totalPorts = 4;
        break;
      case MSType.SPLITTER_1_8:
        this.totalPorts = 8;
        break;
      case MSType.SPLITTER_1_16:
        this.totalPorts = 16;
        break;
      case MSType.SPLITTER_1_32:
        this.totalPorts = 32;
        break;
      case MSType.SPLITTER_1_64:
        this.totalPorts = 64;
        break;
    }
  }
  
  next();
});

// Virtual for calculating available ports
MSSchema.virtual('calculatedAvailablePorts').get(function() {
  if (this.totalPorts && this.activePorts) {
    return this.totalPorts - this.activePorts;
  }
  return undefined;
});

// Method to update port counts
MSSchema.methods.updatePortCounts = function(activePorts: number) {
  this.activePorts = activePorts;
  if (this.totalPorts) {
    this.availablePorts = this.totalPorts - activePorts;
  }
  return this.save();
};

// Method to check if MS is healthy
MSSchema.methods.isHealthy = function() {
  return this.status === MSStatus.ACTIVE && 
         this.powerStatus === PowerStatus.ON &&
         this.temperature && this.temperature < 80;
};

// Method to add output connection
MSSchema.methods.addOutput = function(output: IMSConnection) {
  if (!this.outputs) {
    this.outputs = [];
  }
  this.outputs.push(output);
  return this.save();
};

// Method to remove output connection
MSSchema.methods.removeOutput = function(outputId: string) {
  if (this.outputs) {
    this.outputs = this.outputs.filter(output => output.id !== outputId);
  }
  return this.save();
};

// Method to get connected devices
MSSchema.methods.getConnectedDevices = function() {
  const devices = [];
  
  // Add input device
  if (this.input) {
    devices.push({
      type: 'input',
      connection: this.input
    });
  }
  
  // Add output devices
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

const MSModel: Model<IMS> = mongoose.model<IMS>("MS", MSSchema);

export { MSModel, MSStatus, PowerStatus, MSType, IMSConnection };

import mongoose, { Schema, Document, Model } from "mongoose";
import { upload } from '../services/upload.service';

// FDB Status Enum
enum FDBStatus {
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

// FDB Type Enum
enum FDBType {
  INDOOR = "indoor",
  OUTDOOR = "outdoor",
  WALL_MOUNTED = "wall_mounted",
  POLE_MOUNTED = "pole_mounted",
  UNDERGROUND = "underground",
  OTHER = "other"
}

// Port Status Enum
enum PortStatus {
  AVAILABLE = "available",
  OCCUPIED = "occupied",
  MAINTENANCE = "maintenance",
  FAULTY = "faulty"
}

// Port Interface
interface IFDBPort {
  portNumber: string; // P1, P2, P3, etc.
  status: PortStatus;
  connectedDevice?: {
    type: "olt" | "ms" | "subms" | "fdb" | "x2" | "other" | "user";
    id: string;
    description?: string;
  };
  connectionDate?: Date;
  lastMaintenance?: Date;
}

// Input/Output Interface for FDB connections
interface IFDBConnection {
  type: "olt" | "ms" | "subms" | "fdb" | "x2" | "other" | "user";
  id: string; // Reference ID
  portNumber?: string; // Port number (P1, P2, etc.)
  description?: string;
}

// GeoJSON Point Interface
interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IFDB extends Document {
  // Port management methods
  generatePorts(): void;
  connectToPort(portNumber: string, device: { type: string; id: string; description?: string }): Promise<IFDB>;
  disconnectFromPort(portNumber: string): Promise<IFDB>;
  getAvailablePorts(): IFDBPort[];
  getOccupiedPorts(): IFDBPort[];
  getPort(portNumber: string): IFDBPort | undefined;
  updatePortStatus(portNumber: string, status: PortStatus): Promise<IFDB>;
  // Basic FDB Information
  fdbId?: string; // FDB ID (e.g., FDB001) - Auto-generated if not provided
  fdbName: string; // FDB Name
  fdbType: FDBType; // Type of FDB
  fdbPower?: number; // FDB Power (e.g., 2,4,8,16,32)

  // Location Information
  latitude: number; // Separate latitude field
  longitude: number; // Separate longitude field
  location: IGeoPoint; // GeoJSON Point for geospatial queries

  // Connection Information
  input: IFDBConnection; // Input connection
  outputs?: IFDBConnection[]; // Output connections

  // Technical Specifications
  manufacturer?: string;
  deviceModel?: string;
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
  status: FDBStatus;
  uptime?: number; // in seconds
  lastSeen?: Date;
  temperature?: number; // in celsius

  // Port Information
  totalPorts?: number;
  activePorts?: number;
  availablePorts?: number;
  fiberType?: string; // Single mode, multi-mode
  connectorType?: string; // SC, LC, FC, etc.
  ports?: IFDBPort[]; // Dynamic port array based on fdbPower

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

  // Management and Ownership
  ownedBy: mongoose.Types.ObjectId; // Admin(Company) that owns this FDB
  assignedEngineer?: mongoose.Types.ObjectId;
  assignedCompany?: mongoose.Types.ObjectId;
  addedBy?: mongoose.Types.ObjectId;

  // Attachments
  attachments: string[]; // Array of strings as links with minimum 2 required

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

// Port Schema
const FDBPortSchema = new Schema<IFDBPort>({
  portNumber: {
    type: String,
    required: true,
    match: /^P\d+$/ // Matches P1, P2, P3, etc.
  },
  status: {
    type: String,
    enum: Object.values(PortStatus),
    default: PortStatus.AVAILABLE
  },
  connectedDevice: {
    type: {
      type: String,
      enum: ["olt", "ms", "subms", "fdb", "x2", "other", "user"]
    },
    id: {
      type: String
    },
    description: {
      type: String,
      trim: true
    }
  },
  connectionDate: {
    type: Date
  },
  lastMaintenance: {
    type: Date
  }
}, { _id: false });

// FDB Connection Schema
const FDBConnectionSchema = new Schema<IFDBConnection>({
  type: {
    type: String,
    enum: ["olt", "ms", "subms", "fdb", "x2", "other", "user"],
    required: true
  },
  id: {
    type: String,
    required: true
  },
  portNumber: {
    type: String,
    match: /^P\d+$/ // Matches P1, P2, P3, etc.
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

const FDBSchema = new Schema<IFDB>({
  // Basic FDB Information
  fdbId: {
    type: String,
    unique: true,
    trim: true
  },
  fdbName: {
    type: String,
    required: true,
    trim: true
  },
  fdbType: {
    type: String,
    enum: Object.values(FDBType),
    default: FDBType.OUTDOOR
  },
  fdbPower: {
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
    type: FDBConnectionSchema,
    required: true
  },
  outputs: [{
    type: FDBConnectionSchema
  }],

  // Technical Specifications
  manufacturer: {
    type: String,
    trim: true
  },
  deviceModel: {
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
    default: PowerStatus.ON
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
    enum: Object.values(FDBStatus),
    default: FDBStatus.ACTIVE
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
  ports: [FDBPortSchema], // Dynamic port array

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
      validator: function (attachments: string[]) {
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
FDBSchema.index({ "input.id": 1 }); // Index for input connections
FDBSchema.index({ "outputs.id": 1 }); // Index for output connections
FDBSchema.index({ location: "2dsphere" }); // Geospatial index
FDBSchema.index({ status: 1 });
FDBSchema.index({ fdbType: 1 });
FDBSchema.index({ ownedBy: 1 }); // Index for ownedBy field
FDBSchema.index({ assignedEngineer: 1 });
FDBSchema.index({ assignedCompany: 1 });

// Pre-save middleware
FDBSchema.pre('save', function (next) {
  // Generate random FDB ID if not provided
  if (!this.fdbId) {
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    this.fdbId = `FDB${randomNum}`;
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

  // Generate dynamic ports based on fdbPower
  if (this.fdbPower && (!this.ports || this.ports.length === 0)) {
    this.generatePorts();
  }

  // Update port counts based on ports array
  if (this.ports) {
    this.totalPorts = this.ports.length;
    this.activePorts = this.ports.filter((port: IFDBPort) => port.status === PortStatus.OCCUPIED).length;
    this.availablePorts = this.ports.filter((port: IFDBPort) => port.status === PortStatus.AVAILABLE).length;
  }

  next();
});

// Virtual for calculating available ports
FDBSchema.virtual('calculatedAvailablePorts').get(function () {
  if (this.totalPorts && this.activePorts) {
    return this.totalPorts - this.activePorts;
  }
  return undefined;
});

// Method to update port counts
FDBSchema.methods.updatePortCounts = function (activePorts: number) {
  this.activePorts = activePorts;
  if (this.totalPorts) {
    this.availablePorts = this.totalPorts - activePorts;
  }
  return this.save();
};

// Method to check if FDB is healthy
FDBSchema.methods.isHealthy = function () {
  return this.status === FDBStatus.ACTIVE &&
    this.powerStatus === PowerStatus.ON &&
    this.temperature && this.temperature < 80;
};

// Method to add output connection
FDBSchema.methods.addOutput = function (output: IFDBConnection) {
  if (!this.outputs) {
    this.outputs = [];
  }

  // Check for duplicate connections to prevent security issues
  const existingConnection = this.outputs.find(
    (existing: IFDBConnection) =>
      existing.type === output.type && existing.id === output.id
  );

  if (!existingConnection) {
    this.outputs.push(output);
    return this.save();
  } else {
    console.log(`Connection already exists: ${output.type}:${output.id}`);
    return Promise.resolve(this);
  }
};

// Method to remove output connection
FDBSchema.methods.removeOutput = function (outputId: string) {
  if (this.outputs) {
    this.outputs = this.outputs.filter((output: IFDBConnection) => output.id !== outputId);
  }
  return this.save();
};

// Method to generate ports based on fdbPower
FDBSchema.methods.generatePorts = function () {
  if (!this.fdbPower) return;

  const validPowers = [2, 4, 8];
  if (!validPowers.includes(this.fdbPower)) {
    throw new Error(`Invalid FDB power: ${this.fdbPower}. Must be one of: ${validPowers.join(', ')}`);
  }

  this.ports = [];
  for (let i = 1; i <= this.fdbPower; i++) {
    this.ports.push({
      portNumber: `P${i}`,
      status: PortStatus.AVAILABLE
    });
  }
};

// Method to connect device to a specific port
FDBSchema.methods.connectToPort = function (portNumber: string, device: { type: string; id: string; description?: string }) {
  const port = this.ports?.find((p: IFDBPort) => p.portNumber === portNumber);

  if (!port) {
    throw new Error(`Port ${portNumber} not found`);
  }

  if (port.status !== PortStatus.AVAILABLE) {
    throw new Error(`Port ${portNumber} is not available (Status: ${port.status})`);
  }

  port.status = PortStatus.OCCUPIED;
  port.connectedDevice = device;
  port.connectionDate = new Date();

  return this.save();
};

// Method to disconnect device from a port
FDBSchema.methods.disconnectFromPort = function (portNumber: string) {
  const port = this.ports?.find((p: IFDBPort) => p.portNumber === portNumber);

  if (!port) {
    throw new Error(`Port ${portNumber} not found`);
  }

  port.status = PortStatus.AVAILABLE;
  port.connectedDevice = undefined;
  port.connectionDate = undefined;

  return this.save();
};

// Method to get available ports
FDBSchema.methods.getAvailablePorts = function () {
  return this.ports?.filter((port: IFDBPort) => port.status === PortStatus.AVAILABLE) || [];
};

// Method to get occupied ports
FDBSchema.methods.getOccupiedPorts = function () {
  return this.ports?.filter((port: IFDBPort) => port.status === PortStatus.OCCUPIED) || [];
};

// Method to get port by number
FDBSchema.methods.getPort = function (portNumber: string) {
  return this.ports?.find((port: IFDBPort) => port.portNumber === portNumber);
};

// Method to update port status
FDBSchema.methods.updatePortStatus = function (portNumber: string, status: PortStatus) {
  const port = this.ports?.find((p: IFDBPort) => p.portNumber === portNumber);

  if (!port) {
    throw new Error(`Port ${portNumber} not found`);
  }

  port.status = status;

  if (status === PortStatus.MAINTENANCE) {
    port.lastMaintenance = new Date();
  }

  return this.save();
};

// Method to get connected devices
FDBSchema.methods.getConnectedDevices = function () {
  const devices = [];

  if (this.input) {
    devices.push({
      type: 'input',
      connection: this.input
    });
  }

  if (this.outputs) {
    this.outputs.forEach((output: IFDBConnection) => {
      devices.push({
        type: 'output',
        connection: output
      });
    });
  }

  // Add devices connected to ports
  if (this.ports) {
    this.ports.forEach((port: IFDBPort) => {
      if (port.connectedDevice) {
        devices.push({
          type: 'port_connection',
          portNumber: port.portNumber,
          connection: port.connectedDevice,
          connectionDate: port.connectionDate
        });
      }
    });
  }

  return devices;
};

const FDBModel: Model<IFDB> = mongoose.model<IFDB>("FDB", FDBSchema);

export { FDBModel, FDBStatus, PowerStatus, FDBType, PortStatus, IFDBConnection, IFDBPort };

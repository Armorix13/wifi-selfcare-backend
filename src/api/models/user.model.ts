import mongoose, { Schema, Document, Model } from "mongoose";


enum Role {
  USER = "user",
  ENGINEER = "engineer",//UNIQUE CODE
  SUPERADMIN = "superadmin",
  ADMIN = "admin",//UNIQUE CODE
  MANAGER = "manager",//
  AGENT = "agent"
}

enum AreaType {
  RURAL = "rural",
  URBAN = "urban"
}

enum Mode {
  ONLINE = "online",
  OFFLINE = "offline"
}

interface IGeoPoint {
  type: "Point";
  coordinates: [number, number];
}

type CompanyPreference = string;

export interface IUser extends Document {
  email: string;
  name?: string;
  countryCode: string;
  phoneNumber: string;
  lat?: number;
  long?: number;
  role: Role;
  profileImage?: string;
  location?: IGeoPoint;
  language?: string;
  companyPreference?: CompanyPreference;
  country: string;
  userName: string;
  firstName: string;
  lastName: string;
  status?: string;
  group?: string;
  zone?: string;
  permanentAddress?: string;
  residentialAddress?: string;
  billingAddress?: string;
  balanceDue?: number;
  activationDate?: Date;
  expirationDate?: Date;
  staticIp?: string;
  macIp?: string;
  type?: string;
  fatherName?: string;
  landlineNumber?: string;
  area?: AreaType;
  mode?: Mode;
  provider?: string;
  providerId?: string;
  
  // Additional engineer fields
  state?: string;
  pincode?: string;
  areaFromPincode?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  aadhaarFront?: string; // File path for Aadhaar front image
  aadhaarBack?: string; // File path for Aadhaar back image
  panCard?: string; // File path for PAN card image
  residenceAddress?: string; // Alternative to residentialAddress
  
  otp?: string;
  otpExpiry?: Date;
  otpVerified?: boolean;
  isAccountVerified?: boolean;
  isDeleted?: boolean;
  isDeactivated?: boolean;
  isSuspended?: boolean;
  lastLogin?: Date;
  jti?: string;
  deviceType?: string;
  deviceToken?: string;
  otpPurpose?: string;
  password?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // New fields from Excel sheet
  oltIp?: string; // OLT_IP - Optical Line Terminal IP address
  mtceFranchise?: string; // MTCE_FRANCHISE - Maintenance Franchise
  category?: string; // CATEG - Category
  mobile?: string; // MOBILE - Mobile Number (separate from phoneNumber)
  bbUserId?: string; // BB_USER_ID - Broadband User ID
  bbPassword?: string; // BB_USER_ID - Broadband User ID
  ftthExchangePlan?: string; // FTTH_EXCH_PLAN - Fiber to the Home Exchange Plan
  bbPlan?: string; // BB_PLAN - Broadband Plan
  llInstallDate?: Date; // LL_INSTALL - Landline Installation Date
  workingStatus?: string; // WKG_ST - Working Status
  assigned?: string; // ASSIGNED
  ruralUrban?: string; // RURAL_UR - Rural/Urban
  acquisitionType?: string; // ACQUISITION_TYPE
  modemUserName?: string; // MODEN_USER_NAME
  modemPassword?: string; // MODEN_PASSWORD
  addedBy?: mongoose.Types.ObjectId; // ADDED_BY
  parentCompany?: mongoose.Types.ObjectId; // ADDED_BY
  isActivated?: boolean; // IS_ACTIVATED

  //for admin(company) details
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogo?: string;
  companyDescription?: string;

  // Enhanced company details
  contactPerson?: string;
  industry?: string;
  companySize?: string;
  companyCity?: string;
  companyState?: string;
  companyCountry?: string;

  // Internet providers array
  internetProviders?: string[];

  // Customer-specific fields for fiber network
  customerId?: string; // Auto-generated customer ID (e.g., CUS1234)
  customerType?: string; // residential, commercial, enterprise
  customerPower?: string; // on, off, standby
  bandwidth?: number; // in Mbps
  planId?: string; // Reference to plan
  installationDate?: Date; // Customer installation date
  lastBillingDate?: Date; // Last billing date
  assignedEngineer?: mongoose.Types.ObjectId; // Reference to engineer
  assignedCompany?: mongoose.Types.ObjectId; // Reference to company

}

// Interface for static methods
export interface IUserModel extends mongoose.Model<IUser> {
  findCustomersByLocation(latitude: number, longitude: number, maxDistance?: number): Promise<IUser[]>;
  findCustomersByStatus(status: string): Promise<IUser[]>;
  findCustomersByType(customerType: string): Promise<IUser[]>;
}

const GeoPointSchema = new Schema<IGeoPoint>({
  type: {
    type: String,
    enum: ["Point"],
    default: "Point"
  },
  coordinates: {
    type: [Number]
  }
}, { _id: false });

const UserSchema = new Schema<IUser>({
  email: { type: String },
  countryCode: { type: String },
  phoneNumber: { type: String },
  lat: { type: Number },
  long: { type: Number },
  role: { type: String, enum: Object.values(Role), default: Role.USER },
  profileImage: { type: String },
  location: { type: GeoPointSchema },
  language: { type: String },
  companyPreference: { type: String },
  country: { type: String },
  userName: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  status: { type: String },
  group: { type: String },
  zone: { type: String },
  permanentAddress: { type: String },
  residentialAddress: { type: String },
  billingAddress: { type: String },
  balanceDue: { type: Number, default: 0 },
  activationDate: { type: Date },
  expirationDate: { type: Date },
  staticIp: { type: String },
  macIp: { type: String },
  type: { type: String },
  fatherName: { type: String },
  landlineNumber: { type: String },
  area: { type: String, enum: Object.values(AreaType) },
  mode: { type: String, enum: Object.values(Mode) },
  provider: { type: String },
  providerId: { type: String },
  
  // Additional engineer fields
  state: { type: String },
  pincode: { type: String },
  areaFromPincode: { type: String },
  aadhaarNumber: { type: String },
  panNumber: { type: String },
  aadhaarFront: { type: String }, // File path for Aadhaar front image
  aadhaarBack: { type: String }, // File path for Aadhaar back image
  panCard: { type: String }, // File path for PAN card image
  residenceAddress: { type: String }, // Alternative to residentialAddress
  otp: { type: String },
  otpExpiry: { type: Date },
  otpVerified: { type: Boolean, default: false },
  otpPurpose: { type: String },
  isAccountVerified: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  isDeactivated: { type: Boolean, default: false },
  lastLogin: { type: Date },
  isSuspended: { type: Boolean, default: false },
  jti: { type: String },
  deviceType: { type: String },
  deviceToken: { type: String },
  password: { type: String },

  //for admin(company) details
  companyName: { type: String },
  companyAddress: { type: String },
  companyPhone: { type: String },
  companyEmail: { type: String },
  companyWebsite: { type: String },
  companyLogo: { type: String },
  companyDescription: { type: String },

  // Enhanced company details
  contactPerson: { type: String },
  industry: { type: String },
  companySize: { type: String },
  companyCity: { type: String },
  companyState: { type: String },
  companyCountry: { type: String },

  // Internet providers array
  internetProviders: [{ type: String }],

  // Customer-specific fields for fiber network
  customerId: { type: String, unique: true, sparse: true },
  customerType: { type: String, enum: ["residential", "commercial", "enterprise"] },
  customerPower: { type: String, enum: ["on", "off", "standby"], default: "on" },
  bandwidth: { type: Number, min: 0 },
  planId: { type: String },
  installationDate: { type: Date },
  lastBillingDate: { type: Date },
  assignedEngineer: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  //This key is only for which company he come
  assignedCompany: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },



  // New fields from Excel sheet
  oltIp: { type: String }, // OLT_IP - Optical Line Terminal IP address
  mtceFranchise: { type: String }, // MTCE_FRANCHISE - Maintenance Franchise
  category: { type: String }, // CATEG - Category
  mobile: { type: String }, // MOBILE - Mobile Number (separate from phoneNumber)
  bbUserId: { type: String }, // BB_USER_ID - Broadband User ID
  bbPassword: { type: String }, // bbPassword
  ftthExchangePlan: { type: String }, // FTTH_EXCH_PLAN - Fiber to the Home Exchange Plan
  bbPlan: { type: String }, // BB_PLAN - Broadband Plan
  llInstallDate: { type: Date }, // LL_INSTALL - Landline Installation Date
  workingStatus: { type: String }, // WKG_ST - Working Status
  ruralUrban: { type: String }, // RURAL_UR - Rural/Urban
  acquisitionType: { type: String }, // ACQUISITION_TYPE
  modemUserName: { type: String },
  modemPassword: { type: String },
  assigned: { type: String }, // ASSIGNED

  addedBy: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  //for engineer under which admin
  parentCompany: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  isActivated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

//UNIQUE ID FOR ENGINEER,ADMIN,

// Pre-save middleware
UserSchema.pre('save', function (next) {
  // Auto-generate customerId for users with role "user" if not provided
  if (this.role === "user" && !this.customerId) {
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.customerId = `CUS${timestamp}${random}`;
  }

  // Sync lat/long with location GeoJSON if both are provided
  if (this.lat && this.long) {
    this.location = {
      type: "Point",
      coordinates: [this.long, this.lat] // GeoJSON uses [lng, lat] order
    };
  }

  next();
});

// Indexes for customer queries
// Note: unique: true fields automatically create indexes, so we don't need to declare them again
UserSchema.index({ role: 1 });
UserSchema.index({ "networkInput.id": 1 });
UserSchema.index({ "networkOutputs.id": 1 });

// Static methods for customer queries
UserSchema.statics.findCustomersByLocation = function (latitude: number, longitude: number, maxDistance: number = 10000) {
  return this.find({
    role: "user",
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

UserSchema.statics.findCustomersByStatus = function (status: string) {
  return this.find({ role: "user", status });
};

UserSchema.statics.findCustomersByType = function (customerType: string) {
  return this.find({ role: "user", customerType });
};

const UserModel: IUserModel = mongoose.model<IUser, IUserModel>("User", UserSchema);

export { UserModel, Role, AreaType, Mode };


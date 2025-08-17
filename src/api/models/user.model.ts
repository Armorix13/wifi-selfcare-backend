import mongoose, { Schema, Document, Model } from "mongoose";


enum Role {
  USER = "user",
  ENGINEER = "engineer",
  SUPERADMIN = "superadmin",
  ADMIN = "admin",
  MANAGER = "manager",
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
  billingAddress?: string;
  balanceDue?: number;
  activationDate?: Date;
  expirationDate?: Date;
  staticIp?: string;
  macIp?: string;
  type?: string;
  fatherName?: string;
  area?: AreaType;
  mode?: Mode;
  provider?: string;
  providerId?: string;
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
  email: { type: String},
  countryCode: { type: String },
  phoneNumber: { type: String },
  lat: { type: Number },
  long: { type: Number },
  role: { type: String, enum: Object.values(Role), default: Role.USER },
  profileImage: { type: String },
  location: { type: GeoPointSchema },
  language: { type: String },
  companyPreference: { type: String },
  country: { type: String},
  userName: { type: String },
  firstName: { type: String },
  lastName: { type: String},
  status: { type: String },
  group: { type: String },
  zone: { type: String },
  permanentAddress: { type: String },
  billingAddress: { type: String },
  balanceDue: { type: Number, default: 0 },
  activationDate: { type: Date },
  expirationDate: { type: Date },
  staticIp: { type: String },
  macIp: { type: String },
  type: { type: String },
  fatherName: { type: String },
  area: { type: String, enum: Object.values(AreaType) },
  mode: { type: String, enum: Object.values(Mode) },
  provider: { type: String },
  providerId: { type: String },
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
  password: { type: String }
}, {
  timestamps: true
});

const UserModel: Model<IUser> = mongoose.model<IUser>("User", UserSchema);

export { UserModel, Role, AreaType, Mode };


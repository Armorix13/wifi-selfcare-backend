import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInternetProvider extends Document {
  name: string;
  logo?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for InternetProvider Model with static methods
export interface IInternetProviderModel extends Model<IInternetProvider> {
  getActiveProviders(): Promise<IInternetProvider[]>;
  getInactiveProviders(): Promise<IInternetProvider[]>;
}

const InternetProviderSchema = new Schema<IInternetProvider>({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  logo: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
InternetProviderSchema.index({ name: 1 });
InternetProviderSchema.index({ isActive: 1 });

// Method to activate provider
InternetProviderSchema.methods.activate = function() {
  this.isActive = true;
  return this.save();
};

// Method to deactivate provider
InternetProviderSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Static method to get active providers
InternetProviderSchema.statics.getActiveProviders = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to get inactive providers
InternetProviderSchema.statics.getInactiveProviders = function() {
  return this.find({ isActive: false }).sort({ name: 1 });
};

const InternetProviderModel: IInternetProviderModel = mongoose.model<IInternetProvider, IInternetProviderModel>("InternetProvider", InternetProviderSchema);

export { InternetProviderModel };

import mongoose, { Schema, Document, Model } from "mongoose";


export interface ICustomer extends Document {
    userId: mongoose.Types.ObjectId;

    fdbId: mongoose.Types.ObjectId;
    oltId: mongoose.Types.ObjectId;


    installationDate?: Date;
    activationDate?: Date;
    expirationDate?: Date;


    balanceDue?: number;
    lastPaymentDate?: Date;
    lastPaymentAmount?: number;
    billingCycle?: string;
    attachments?: string[];
    isInstalled?: boolean;

    consumedWire?: number;
    remarks?: string;


    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for Customer Model with static methods
export interface ICustomerModel extends Model<ICustomer> {
    createOrUpdateCustomer(userId: mongoose.Types.ObjectId, customerData: Partial<ICustomer>): Promise<ICustomer>;
}

const CustomerSchema = new Schema<ICustomer>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },

    fdbId: {
        type: Schema.Types.ObjectId,
        ref: 'FDB'
    },
    oltId: {
        type: Schema.Types.ObjectId,
        ref: 'OLT'
    },

    installationDate: {
        type: Date
    },
    activationDate: {
        type: Date
    },
    expirationDate: {
        type: Date
    },

    balanceDue: {
        type: Number,
        min: 0,
        default: 0
    },
    lastPaymentDate: {
        type: Date
    },
    lastPaymentAmount: {
        type: Number,
        min: 0
    },
    billingCycle: {
        type: String
    },
    attachments:{
        type: [String]
    },
    isInstalled:{
        type: Boolean,
        default: false
    },
    remarks:{
        type: String
    },
    consumedWire:{
        type: Number
    }
}, {
    timestamps: true
});

// Indexes for better performance and data integrity
CustomerSchema.index({ userId: 1 }, { unique: true }); // Unique index on userId
CustomerSchema.index({ fdbId: 1 }); // Index for FDB lookups
CustomerSchema.index({ oltId: 1 }); // Index for OLT lookups
CustomerSchema.index({ isInstalled: 1 }); // Index for installation status


// Virtual for isOverdue
CustomerSchema.virtual('isOverdue').get(function () {
    if (!this.balanceDue || this.balanceDue <= 0) return false;
    if (!this.lastPaymentDate) return true;

    const daysSinceLastPayment = Math.floor((Date.now() - this.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceLastPayment > 30; // Consider overdue after 30 days
});

// Method to add payment
CustomerSchema.methods.addPayment = function (amount: number) {
    this.lastPaymentAmount = amount;
    this.lastPaymentDate = new Date();
    if (this.balanceDue) {
        this.balanceDue = Math.max(0, this.balanceDue - amount);
    }
    return this.save();
};

// Static method to safely create or update customer
CustomerSchema.statics.createOrUpdateCustomer = async function(userId: mongoose.Types.ObjectId, customerData: Partial<ICustomer>) {
    try {
        // Try to find existing customer
        const existingCustomer = await this.findOne({ userId });
        
        if (existingCustomer) {
            // Update existing customer
            Object.assign(existingCustomer, customerData);
            return await existingCustomer.save();
        } else {
            // Create new customer
            return await this.create({ userId, ...customerData });
        }
    } catch (error) {
        console.error('Error in createOrUpdateCustomer:', error);
        throw error;
    }
};


const CustomerModel: ICustomerModel = mongoose.model<ICustomer, ICustomerModel>("Customer", CustomerSchema);

export { CustomerModel };
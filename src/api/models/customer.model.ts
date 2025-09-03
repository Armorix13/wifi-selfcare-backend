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


    createdAt?: Date;
    updatedAt?: Date;
}

const CustomerSchema = new Schema<ICustomer>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
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
    }
}, {
    timestamps: true
});


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


const CustomerModel: Model<ICustomer> = mongoose.model<ICustomer>("Customer", CustomerSchema);

export { CustomerModel };
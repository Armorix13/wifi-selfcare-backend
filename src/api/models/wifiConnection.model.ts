import mongoose, { Document, Schema } from 'mongoose';

export interface IWifiConnection extends Document {
    userId: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    countryCode: string;
    status: 'inreview' | 'accepted' | 'rejected';
    remarks?: string;
    connectionType?: string;
    package?: string;
    installationAddress?: string;
    installationDate?: Date;
    activationDate?: Date;
    expiryDate?: Date;
    monthlyBill?: number;
    connectionSpeed?: string;
    assignedEngineer?: mongoose.Types.ObjectId;
    isActive?: boolean;
    isDeleted?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const WifiConnectionSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        firstName: {
            type: String
        },
        lastName: {
            type: String
        },
        phoneNumber: {
            type: String
        },
        countryCode: {
            type: String,
        },
        status: {
            type: String,
            enum: ['inreview', 'accepted', 'rejected'],
            default: 'inreview'
        },
        remarks: {
            type: String
        },
        connectionType: {
            type: String
        },
        package: {
            type: String
        },
        installationAddress: {
            type: String,
            required: true
        },
        installationDate: {
            type: Date
        },
        activationDate: {
            type: Date
        },
        expiryDate: {
            type: Date
        },
        monthlyBill: {
            type: Number,
            default: 0
        },
        connectionSpeed: {
            type: String
        },
        assignedEngineer: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        isActive: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
    },
    { timestamps: true }
);

// Pre-save middleware to ensure status is always valid
WifiConnectionSchema.pre('save', function (next) {
    // Ensure status is always one of the valid enum values
    if (this.isNew && (!this.status || !['inreview', 'accepted', 'rejected'].includes(this.status as string))) {
        this.status = 'inreview';
    }
    next();
});

// Index for better query performance
WifiConnectionSchema.index({ userId: 1 });
WifiConnectionSchema.index({ status: 1 });
WifiConnectionSchema.index({ assignedEngineer: 1 });

const WifiConnection = mongoose.model<IWifiConnection>('WifiConnection', WifiConnectionSchema);

export { WifiConnection };

import mongoose, { Document, Schema } from 'mongoose';

export interface FibreInstallationRequest extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    email: string;
    phoneNumber: string;
    countryCode: string;
    fibrePlanId?: mongoose.Types.ObjectId;
    status: 'inreview' | 'approved' | 'rejected';
    approvedDate?: Date;
    remarks?: string;
    createdAt: Date;
    updatedAt: Date;
    assignedEngineer?: mongoose.Types.ObjectId;
    installationAddress?: string;
    preferredInstallationDate?: Date;
    existingInternetProvider?: string;
    internetSpeed?: string;
    fibreType?: string;
    buildingType?: 'residential' | 'commercial' | 'apartment';
    floorNumber?: number;
    roomNumber?: string;
}

const FibreInstallationRequestSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phoneNumber: {
            type: String,
            required: true
        },
        countryCode: {
            type: String,
            required: true
        },
        fibrePlanId: {
            type: Schema.Types.ObjectId,
            ref: 'Plan'
        },
        status: {
            type: String,
            enum: ['inreview', 'approved', 'rejected'],
            default: 'inreview'
        },
        approvedDate: {
            type: Date
        },
        remarks: {
            type: String
        },
        assignedEngineer: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        installationAddress: {
            type: String
        },
        preferredInstallationDate: {
            type: Date
        },
        existingInternetProvider: {
            type: String
        },
        internetSpeed: {
            type: String
        },
        fibreType: {
            type: String,
        },
        buildingType: {
            type: String,
            enum: ['residential', 'commercial', 'apartment']
        },
        floorNumber: {
            type: Number
        },
        roomNumber: {
            type: String
        }
    },
    { timestamps: true }
);

// Pre-save middleware to ensure status is always valid
FibreInstallationRequestSchema.pre('save', function (next) {
    // Ensure status is always one of the valid enum values
    if (this.isNew && (!this.status || !['inreview', 'approved', 'rejected'].includes(this.status as string))) {
        this.status = 'inreview';
    }
    next();
});

const FibreInstallationRequest = mongoose.model<FibreInstallationRequest>('FibreInstallationRequest', FibreInstallationRequestSchema);

export { FibreInstallationRequest }; 
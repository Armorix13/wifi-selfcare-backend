import mongoose, { Schema, Document } from "mongoose";

export enum LeadStatus {
    INREVIEW = "inreview",
    ACCEPTED = "accepted",
    REJECTED = "rejected"
}

export enum LeadPlatform {
    FROM_CUSTOMER = "From Customer",
    FROM_ENGINEER = "From Engineer",
    FROM_WEBSITE = "From our website",
    FROM_APPLICATION = "From our application",
    FROM_ADMIN_PANEL = "From admin panel"
}

export interface ILeads extends Document {
    byUserId: mongoose.Types.ObjectId;
    byEngineerId?: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    countryCode: string;
    status: LeadStatus;
    remarks?: string;
    connectionType?: string;
    installationAddress?: string;
    leadPlatform: LeadPlatform;
    email?: string;
    companyName?: string;
    expectedInstallationDate?: Date;
    preferredTimeSlot?: string;
    additionalRequirements?: string;
    source?: string;
    priority?: 'low' | 'medium' | 'high';
    assignedTo?: mongoose.Types.ObjectId;
    estimatedCost?: number;
    // Tracking fields
    isTracked: boolean;
    trackingDate?: Date;
    trackingNotes?: string;
    lastContactDate?: Date;
    nextFollowUpDate?: Date;
    contactAttempts: number;
    createdAt: Date;
    updatedAt: Date;
}

const leadsSchema = new Schema<ILeads>(
    {
        byUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        byEngineerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        firstName: {
            type: String,
        },
        lastName: {
            type: String,
        },
        phoneNumber: {
            type: String,
        },
        countryCode: {
            type: String
        },
        status: {
            type: String,
            enum: Object.values(LeadStatus),
            default: LeadStatus.INREVIEW,
        },
        remarks: {
            type: String,
        },
        connectionType: {
            type: String,
        },
        installationAddress: {
            type: String,
        },
        leadPlatform: {
            type: String,
            enum: Object.values(LeadPlatform),
        },
        email: {
            type: String
        },
        companyName: {
            type: String,
        },
        expectedInstallationDate: {
            type: Date,
        },
        preferredTimeSlot: {
            type: String,
        },
        additionalRequirements: {
            type: String,
        },
        source: {
            type: String,
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        estimatedCost: {
            type: Number,
            min: 0,
        },
        // Tracking fields
        isTracked: {
            type: Boolean,
            default: false,
        },
        trackingDate: {
            type: Date,
        },
        trackingNotes: {
            type: String,
        },
        lastContactDate: {
            type: Date,
        },
        nextFollowUpDate: {
            type: Date,
        },
        contactAttempts: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
leadsSchema.index({ byUserId: 1 });
leadsSchema.index({ byEngineerId: 1 });
leadsSchema.index({ status: 1 });
leadsSchema.index({ leadPlatform: 1 });
leadsSchema.index({ createdAt: -1 });
leadsSchema.index({ phoneNumber: 1, countryCode: 1 });
leadsSchema.index({ isTracked: 1 });
leadsSchema.index({ nextFollowUpDate: 1 });

export const Leads = mongoose.model<ILeads>("Leads", leadsSchema);

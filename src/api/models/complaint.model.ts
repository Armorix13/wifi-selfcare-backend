import mongoose, { Schema, Document, Model } from "mongoose";
import { IStatusHistory } from "../../type/statusHistory.interface";

enum ComplaintStatus {
    PENDING = "pending",
    ASSIGNED = "assigned",
    IN_PROGRESS = "in_progress",
    VISITED = "visited",
    RESOLVED = "resolved",
    NOT_RESOLVED = "not_resolved",
    CANCELLED = "cancelled",
    REOPENED = "reopened",
    REVISIT = "re_visit"
}

enum Priority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    URGENT = "urgent"
}

enum ComplaintType {
    WIFI = "WIFI",
    CCTV = "CCTV"
}


export interface IComplaint extends Document {
    id: string; // Custom complaint ID (WIFI-XXXXX or CCTV-XXXXX)
    user: mongoose.Types.ObjectId; // Client/user who submitted the complaint
    engineer?: mongoose.Types.ObjectId; // Engineer assigned to handle the complaint
    assignedBy?: mongoose.Types.ObjectId; // Admin who assigned the engineer

    title: string;
    issueDescription: string;
    issueType: mongoose.Types.ObjectId;
    complaintType: string;
    type: ComplaintType; // Added type field
    phoneNumber: string;
    priority: Priority;
    status: ComplaintStatus;
    statusColor: string; // Added for color coding

    visitDate?: Date;
    resolved?: boolean;
    resolutionDate?: Date;
    notResolvedReason?: string;
    resolutionNotes?: string;

    remark?: string;
    attachments?: string[]; // URLs to uploaded files/images - can contain multiple images

    // Resolution attachments (2-4 images) uploaded by engineer when closing complaint
    resolutionAttachments?: string[];

    estimatedResolutionTime?: Date;
    actualResolutionTime?: Date;

    // Status History tracking
    statusHistory: IStatusHistory[];

    createdAt?: Date;
    updatedAt?: Date;

    // Customer Data
    fatherName?: string;
    alternativeNumber?: string;
    address?: string;
    landlineNumber?: string;

    // Modem Data
    modemName?: string;
    modemType?: string;
    macNumber?: string;
    modemUsername?: string;
    modemPassword?: string;
    serialNumber?: string;

    // Soft Details
    internetAccessId?: string;
    userIdSoft?: string;
    plan?: string;
    softPassword?: string;
    oltPort?: string;
    ponPort?: string;
    ontDistance?: string;
    portStatus?: string;
    ontTxPower?: string;
    ontRxPower?: string;

    // OTP for complaint resolution
    otp?: string;
    otpVerified?: boolean;
    otpVerifiedAt?: Date;

    // Re-complaint fields
    isReComplaint?: boolean;
    parentComplaintId?: mongoose.Types.ObjectId;

    // Custom methods
    assignEngineer(engineerId: mongoose.Types.ObjectId, assignedById: mongoose.Types.ObjectId): Promise<IComplaint>;
    updateStatus(newStatus: ComplaintStatus, notes?: string, updatedBy?: mongoose.Types.ObjectId): Promise<IComplaint>;
    addAttachments(attachmentUrls: string[]): Promise<IComplaint>;
    removeAttachment(attachmentUrl: string): Promise<IComplaint>;
    clearAttachments(): Promise<IComplaint>;
    getStatusHistory(): IStatusHistory[];
    initializeStatusHistory(userId: mongoose.Types.ObjectId): Promise<IComplaint>;
    getStatusHistorySummary(): any[];
    getFormattedStatusHistory(): any[];
    hasEngineerAssigned(): boolean;
    getEngineerAssignmentHistory(): any[];
    closeComplaint(otp: string, resolutionAttachments: string[], notes?: string, updatedBy?: mongoose.Types.ObjectId): Promise<IComplaint>;
    verifyOTP(otp: string): Promise<IComplaint>;
}

// Color mapping for each ComplaintStatus
const ComplaintStatusColor: Record<ComplaintStatus, string> = {
    [ComplaintStatus.PENDING]: "#FFA500",       // Orange
    [ComplaintStatus.ASSIGNED]: "#007BFF",      // Blue
    [ComplaintStatus.IN_PROGRESS]: "#17A2B8",   // Teal
    [ComplaintStatus.VISITED]: "#6F42C1",       // Purple
    [ComplaintStatus.RESOLVED]: "#28A745",      // Green
    [ComplaintStatus.NOT_RESOLVED]: "#DC3545",  // Red
    [ComplaintStatus.CANCELLED]: "#6C757D",     // Gray
    [ComplaintStatus.REOPENED]: "#FFC107",      // Yellow
    [ComplaintStatus.REVISIT]: "#FFC107"        // Yellow
};


const ComplaintSchema = new Schema<IComplaint>({
    id: {
        type: String,
        // required: true,
        unique: true,
        trim: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    engineer: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    assignedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },

    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    issueDescription: {
        type: String,
        required: true,
        trim: true
    },
    complaintType: {
        type: String,
    },
    type: {
        type: String,
        enum: Object.values(ComplaintType),
        required: true
    },
    issueType: {
        type: Schema.Types.ObjectId,
        ref: "IssueType",
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },
    priority: {
        type: String,
        enum: Object.values(Priority),
        default: Priority.MEDIUM
    },
    status: {
        type: String,
        enum: Object.values(ComplaintStatus),
        default: ComplaintStatus.PENDING
    },
    statusColor: {
        type: String,
        default: ComplaintStatusColor[ComplaintStatus.PENDING]
    },

    visitDate: {
        type: Date
    },
    resolved: {
        type: Boolean,
        default: false
    },
    resolutionDate: {
        type: Date
    },
    notResolvedReason: {
        type: String,
        trim: true
    },
    resolutionNotes: {
        type: String,
        trim: true
    },

    remark: {
        type: String,
        trim: true
    },
    // Customer Data
    fatherName: { type: String, trim: true },
    alternativeNumber: { type: String, trim: true },
    address: { type: String, trim: true },
    landlineNumber: { type: String, trim: true },
    // Modem Data
    modemName: { type: String, trim: true },
    modemType: { type: String, trim: true },
    macNumber: { type: String, trim: true },
    modemUsername: { type: String, trim: true },
    modemPassword: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    // Soft Details
    internetAccessId: { type: String, trim: true },
    userIdSoft: { type: String, trim: true },
    plan: { type: String, trim: true },
    softPassword: { type: String, trim: true },
    oltPort: { type: String, trim: true },
    ponPort: { type: String, trim: true },
    ontDistance: { type: String, trim: true },
    portStatus: { type: String, trim: true },
    ontTxPower: { type: String, trim: true },
    ontRxPower: { type: String, trim: true },
    // OTP
    otp: { type: String, trim: true },
    otpVerified: { type: Boolean, default: false },
    otpVerifiedAt: { type: Date },
    // Re-complaint
    isReComplaint: { type: Boolean, default: false },
    parentComplaintId: { type: Schema.Types.ObjectId, ref: "Complaint" },
    attachments: [{
        type: String
    }],

    // Resolution attachments (2-4 images) uploaded by engineer when closing complaint
    resolutionAttachments: [{
        type: String
    }],

    estimatedResolutionTime: {
        type: Date
    },
    actualResolutionTime: {
        type: Date
    },

    // Status History tracking
    statusHistory: [{
        status: {
            type: String,
            enum: Object.values(ComplaintStatus),
            required: true
        },
        remarks: {
            type: String,
            trim: true
        },
        metadata: {
            type: Schema.Types.Mixed
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        updatedAt: {
            type: Date,
            default: Date.now
        },
        previousStatus: {
            type: String,
            enum: Object.values(ComplaintStatus)
        },
        additionalInfo: {
            type: Schema.Types.Mixed
        }
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

ComplaintSchema.index({ user: 1 });
ComplaintSchema.index({ engineer: 1 });
ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ priority: 1 });
ComplaintSchema.index({ createdAt: -1 });
// Note: unique: true fields automatically create indexes, so we don't need to declare them again


ComplaintSchema.virtual('resolutionTimeInHours').get(function () {
    if (this.resolutionDate && this.createdAt) {
        return Math.round((this.resolutionDate.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
    }
    return null;
});

// Enforce min 1, max 4 attachments (photos) on save
ComplaintSchema.pre('save', async function (next) {
    // Generate custom complaint ID only for new documents
    if (this.isNew && !this.id) {
        let generatedId: string;
        let isUnique = false;

        while (!isUnique) {
            const randomNumber = Math.floor(10000 + Math.random() * 90000); // Generate 5-digit random number
            generatedId = `${this.type}-${randomNumber}`;

            // Check if this ID already exists
            const existingComplaint = await mongoose.model('Complaint').findOne({ id: generatedId });
            if (!existingComplaint) {
                isUnique = true;
            }
        }

        this.id = generatedId!;
    }

    if (this.attachments && this.attachments.length > 0) {
        if (this.attachments.length > 4) {
            return next(new Error('You can submit at most 4 photos.'));
        }
    }
    // Set statusColor based on status
    if (this.isModified('status')) {
        this.statusColor = ComplaintStatusColor[this.status];
    }
    if (this.isModified('status') && this.status === ComplaintStatus.RESOLVED && !this.resolutionDate) {
        this.resolutionDate = new Date();
        this.resolved = true;
    }
    next();
});

ComplaintSchema.statics.findByStatus = function (status: ComplaintStatus) {
    return this.find({ status });
};

ComplaintSchema.statics.findByEngineer = function (engineerId: mongoose.Types.ObjectId) {
    return this.find({ engineer: engineerId });
};

ComplaintSchema.methods.assignEngineer = function (engineerId: mongoose.Types.ObjectId, assignedById: mongoose.Types.ObjectId) {
    const previousStatus = this.status;

    this.engineer = engineerId;
    this.assignedBy = assignedById;
    this.status = ComplaintStatus.ASSIGNED;

    // Add to status history
    if (!this.statusHistory) {
        this.statusHistory = [];
    }

    this.statusHistory.push({
        status: ComplaintStatus.ASSIGNED,
        remarks: `Engineer assigned by admin`,
        updatedBy: assignedById,
        updatedAt: new Date(),
        previousStatus: previousStatus,
        metadata: {
            action: "engineer_assigned",
            engineerId: engineerId,
            assignedById: assignedById
        },
        additionalInfo: {
            oldStatus: previousStatus,
            newStatus: ComplaintStatus.ASSIGNED,
            timestamp: new Date()
        }
    });

    return this.save();
};

ComplaintSchema.methods.updateStatus = function (newStatus: ComplaintStatus, notes?: string, updatedBy?: mongoose.Types.ObjectId) {
    const previousStatus = this.status;

    // Add to status history
    if (!this.statusHistory) {
        this.statusHistory = [];
    }

    this.statusHistory.push({
        status: newStatus,
        remarks: notes,
        updatedBy: updatedBy || this.engineer || this.assignedBy,
        updatedAt: new Date(),
        previousStatus: previousStatus,
        metadata: {
            resolutionNotes: notes,
            visitDate: newStatus === ComplaintStatus.VISITED ? new Date() : this.visitDate,
            resolutionDate: newStatus === ComplaintStatus.RESOLVED ? new Date() : this.resolutionDate
        },
        additionalInfo: {
            oldStatus: previousStatus,
            newStatus: newStatus,
            timestamp: new Date()
        }
    });

    this.status = newStatus;
    if (notes) {
        this.resolutionNotes = notes;
    }

    if (newStatus === ComplaintStatus.VISITED && !this.visitDate) {
        this.visitDate = new Date();
    }

    if (newStatus === ComplaintStatus.RESOLVED) {
        this.resolutionDate = new Date();
        this.resolved = true;
    }

    return this.save();
};

ComplaintSchema.methods.addAttachments = function (attachmentUrls: string[]) {
    if (!this.attachments) {
        this.attachments = [];
    }
    this.attachments.push(...attachmentUrls);
    return this.save();
};

ComplaintSchema.methods.removeAttachment = function (attachmentUrl: string) {
    if (this.attachments) {
        this.attachments = this.attachments.filter((url: string) => url !== attachmentUrl);
    }
    return this.save();
};

ComplaintSchema.methods.clearAttachments = function () {
    this.attachments = [];
    return this.save();
};

// Method to get status history
ComplaintSchema.methods.getStatusHistory = function () {
    return this.statusHistory || [];
};

// Method to add initial status history entry
ComplaintSchema.methods.initializeStatusHistory = function (userId: mongoose.Types.ObjectId) {
    if (!this.statusHistory) {
        this.statusHistory = [];
    }

    this.statusHistory.push({
        status: this.status,
        remarks: "Complaint created",
        updatedBy: userId,
        updatedAt: new Date(),
        previousStatus: undefined,
        metadata: {
            action: "created",
            createdAt: this.createdAt
        },
        additionalInfo: {
            initialStatus: true,
            timestamp: new Date()
        }
    });

    return this.save();
};

// Method to get status history summary
ComplaintSchema.methods.getStatusHistorySummary = function () {
    if (!this.statusHistory || this.statusHistory.length === 0) {
        return [];
    }

    return this.statusHistory.map((entry: any) => ({
        status: entry.status,
        remarks: entry.remarks,
        updatedAt: entry.updatedAt,
        updatedBy: entry.updatedBy,
        previousStatus: entry.previousStatus,
        action: entry.metadata?.action || 'status_change'
    }));
};

// Method to get formatted status history for API response
ComplaintSchema.methods.getFormattedStatusHistory = function () {
    if (!this.statusHistory || this.statusHistory.length === 0) {
        return [];
    }

    return this.statusHistory.map((entry: any) => ({
        status: entry.status,
        remarks: entry.remarks || '',
        updatedAt: entry.updatedAt,
        previousStatus: entry.previousStatus || null,
        updatedBy: entry.updatedBy,
        metadata: entry.metadata || {},
        additionalInfo: entry.additionalInfo || {},
        action: entry.metadata?.action || 'status_change',
        timestamp: entry.updatedAt
    }));
};

ComplaintSchema.virtual('attachmentCount').get(function () {
    return this.attachments ? this.attachments.length : 0;
});

// Virtual for status history count
ComplaintSchema.virtual('statusHistoryCount').get(function () {
    return this.statusHistory ? this.statusHistory.length : 0;
});

// Virtual for resolution attachment count
ComplaintSchema.virtual('resolutionAttachmentCount').get(function () {
    return this.resolutionAttachments ? this.resolutionAttachments.length : 0;
});

// Virtual for latest status change
ComplaintSchema.virtual('latestStatusChange').get(function () {
    if (!this.statusHistory || this.statusHistory.length === 0) {
        return null;
    }

    const latest = this.statusHistory[this.statusHistory.length - 1];
    return {
        status: latest.status,
        remarks: latest.remarks,
        updatedAt: latest.updatedAt,
        updatedBy: latest.updatedBy
    };
});

// Method to check if complaint has been assigned to engineer
ComplaintSchema.methods.hasEngineerAssigned = function () {
    return this.engineer && this.statusHistory && 
           this.statusHistory.some((entry: any) => entry.metadata?.action === 'engineer_assigned');
};

// Method to get engineer assignment history
ComplaintSchema.methods.getEngineerAssignmentHistory = function () {
    if (!this.statusHistory) return [];
    
    return this.statusHistory
        .filter((entry: any) => entry.metadata?.action === 'engineer_assigned')
        .map((entry: any) => ({
            engineerId: entry.metadata.engineerId,
            assignedById: entry.metadata.assignedById,
            assignedAt: entry.updatedAt,
            status: entry.status,
            remarks: entry.remarks
        }));
};

// Method to close complaint with OTP and resolution attachments
ComplaintSchema.methods.closeComplaint = function (otp: string, resolutionAttachments: string[], notes?: string, updatedBy?: mongoose.Types.ObjectId) {
    // Generate 4-digit OTP
    const generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Set OTP
    this.otp = generatedOTP;
    
    // Add resolution attachments
    if (resolutionAttachments && resolutionAttachments.length > 0) {
        if (resolutionAttachments.length < 2 || resolutionAttachments.length > 4) {
            throw new Error('Resolution attachments must be between 2 and 4 images');
        }
        this.resolutionAttachments = resolutionAttachments;
    }
    
    // Update status to resolved
    this.status = ComplaintStatus.RESOLVED;
    this.resolved = true;
    this.resolutionDate = new Date();
    
    // Add to status history
    if (!this.statusHistory) {
        this.statusHistory = [];
    }
    
    this.statusHistory.push({
        status: ComplaintStatus.RESOLVED,
        remarks: notes || 'Complaint closed with OTP verification',
        updatedBy: updatedBy || this.engineer || this.assignedBy,
        updatedAt: new Date(),
        previousStatus: this.status,
        metadata: {
            action: "complaint_closed",
            otp: generatedOTP,
            resolutionAttachments: resolutionAttachments,
            resolutionNotes: notes
        },
        additionalInfo: {
            oldStatus: this.status,
            newStatus: ComplaintStatus.RESOLVED,
            timestamp: new Date(),
            closureMethod: "otp_verification"
        }
    });
    
    return this.save();
};

// Method to verify OTP and mark complaint as fully closed
ComplaintSchema.methods.verifyOTP = function (otp: string) {
    if (this.otp !== otp) {
        throw new Error('Invalid OTP');
    }
    
    // OTP is correct, mark as verified
    this.otpVerified = true;
    this.otpVerifiedAt = new Date();
    
    // Add to status history
    if (!this.statusHistory) {
        this.statusHistory = [];
    }
    
    this.statusHistory.push({
        status: ComplaintStatus.RESOLVED,
        remarks: 'OTP verified by customer - complaint fully closed',
        updatedBy: this.user, // Customer verified
        updatedAt: new Date(),
        previousStatus: ComplaintStatus.RESOLVED,
        metadata: {
            action: "otp_verified",
            otp: otp,
            verificationMethod: "customer_verification"
        },
        additionalInfo: {
            oldStatus: ComplaintStatus.RESOLVED,
            newStatus: ComplaintStatus.RESOLVED,
            timestamp: new Date(),
            verificationStatus: "verified"
        }
    });
    
    return this.save();
};

const ComplaintModel: Model<IComplaint> = mongoose.model<IComplaint>("Complaint", ComplaintSchema);

export {
    ComplaintModel,
    ComplaintStatus,
    Priority,
    ComplaintType,
    ComplaintStatusColor
};

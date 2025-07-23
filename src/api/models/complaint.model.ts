import mongoose, { Schema, Document, Model } from "mongoose";

enum ComplaintStatus {
    PENDING = "pending",
    ASSIGNED = "assigned",
    IN_PROGRESS = "in_progress",
    VISITED = "visited",
    RESOLVED = "resolved",
    NOT_RESOLVED = "not_resolved",
    CANCELLED = "cancelled",
    REOPENED = "reopened"
}

enum Priority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    URGENT = "urgent"
}


export interface IComplaint extends Document {
    user: mongoose.Types.ObjectId; // Client/user who submitted the complaint
    engineer?: mongoose.Types.ObjectId; // Engineer assigned to handle the complaint
    assignedBy?: mongoose.Types.ObjectId; // Admin who assigned the engineer

    title: string;
    issueDescription: string;
    issueType: mongoose.Types.ObjectId;
    phoneNumber: string;
    priority: Priority;
    status: ComplaintStatus;

    visitDate?: Date;
    resolved?: boolean;
    resolutionDate?: Date;
    notResolvedReason?: string;
    resolutionNotes?: string;

    remark?: string;
    attachments?: string[]; // URLs to uploaded files/images - can contain multiple images

    estimatedResolutionTime?: Date;
    actualResolutionTime?: Date;

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

    // Re-complaint fields
    isReComplaint?: boolean;
    parentComplaintId?: mongoose.Types.ObjectId;

    // Custom methods
    assignEngineer(engineerId: mongoose.Types.ObjectId, assignedById: mongoose.Types.ObjectId): Promise<IComplaint>;
    updateStatus(newStatus: ComplaintStatus, notes?: string): Promise<IComplaint>;
    addAttachments(attachmentUrls: string[]): Promise<IComplaint>;
    removeAttachment(attachmentUrl: string): Promise<IComplaint>;
    clearAttachments(): Promise<IComplaint>;
}



const ComplaintSchema = new Schema<IComplaint>({
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
    issueType: {
        type: Schema.Types.ObjectId,
        ref: "IssueType",
        required: true
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
    // Re-complaint
    isReComplaint: { type: Boolean, default: false },
    parentComplaintId: { type: Schema.Types.ObjectId, ref: "Complaint" },
    attachments: [{
        type: String
    }],

    estimatedResolutionTime: {
        type: Date
    },
    actualResolutionTime: {
        type: Date
    }
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


ComplaintSchema.virtual('resolutionTimeInHours').get(function () {
    if (this.resolutionDate && this.createdAt) {
        return Math.round((this.resolutionDate.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
    }
    return null;
});

// Enforce min 1, max 4 attachments (photos) on save
ComplaintSchema.pre('save', function (next) {
    if (this.attachments) {
        if (this.attachments.length < 1 || this.attachments.length > 4) {
            return next(new Error('You must submit at least 1 and at most 4 photos.'));
        }
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
    this.engineer = engineerId;
    this.assignedBy = assignedById;
    this.status = ComplaintStatus.ASSIGNED;
    return this.save();
};

ComplaintSchema.methods.updateStatus = function (newStatus: ComplaintStatus, notes?: string) {
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

ComplaintSchema.virtual('attachmentCount').get(function () {
    return this.attachments ? this.attachments.length : 0;
});

const ComplaintModel: Model<IComplaint> = mongoose.model<IComplaint>("Complaint", ComplaintSchema);

export {
    ComplaintModel,
    ComplaintStatus,
    Priority
};

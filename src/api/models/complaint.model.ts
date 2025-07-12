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

enum ComplaintType {
    CONNECTION_ISSUE = "connection_issue",
    SPEED_ISSUE = "speed_issue",
    BILLING_ISSUE = "billing_issue",
    TECHNICAL_ISSUE = "technical_issue",
    SERVICE_QUALITY = "service_quality",
    OTHER = "other"
}



export interface IComplaint extends Document {
    user: mongoose.Types.ObjectId; // Client/user who submitted the complaint
    engineer?: mongoose.Types.ObjectId; // Engineer assigned to handle the complaint
    assignedBy?: mongoose.Types.ObjectId; // Admin who assigned the engineer

    title: string;
    issueDescription: string;
    complaintType: ComplaintType;
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
    complaintType: {
        type: String,
        enum: Object.values(ComplaintType),
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

ComplaintSchema.pre('save', function (next) {
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
    Priority,
    ComplaintType
};

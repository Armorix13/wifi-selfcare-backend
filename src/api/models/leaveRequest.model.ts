import mongoose, { Schema, Document, Model } from "mongoose";

enum LeaveType {
    FULL_DAY = "full_day",
    HALF_DAY = "half_day",
    MULTIPLE_DAYS = "multiple_days"
}

enum LeaveStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    CANCELLED = "cancelled"
}

enum LeaveReason {
    PERSONAL = "personal",
    SICK = "sick",
    EMERGENCY = "emergency",
    VACATION = "vacation",
    MATERNITY = "maternity",
    PATERNITY = "paternity",
    BEREAVEMENT = "bereavement",
    OTHER = "other"
}

export interface ILeaveRequest extends Document {
    engineer: mongoose.Types.ObjectId; // Reference to User model (engineer)
    leaveType: LeaveType;
    fromDate: Date;
    toDate: Date;
    reason: LeaveReason;
    description: string; // Detailed reason
    totalDays?: number; // Calculated total leave days (optional since auto-calculated)
    status: LeaveStatus;
    approvedBy?: mongoose.Types.ObjectId; // Manager/Agent/Admin who approved/rejected
    approvedAt?: Date;
    rejectionReason?: string; // If rejected, why?
    documents?: string[]; // URLs to uploaded documents
    remarks?: string; // Additional remarks from approver
    createdAt: Date;
    updatedAt: Date;
}

// Interface for the model with static methods
export interface ILeaveRequestModel extends Model<ILeaveRequest> {
    getEngineerLeaveStats(engineerId: string, year: number, month: number): Promise<any>;
    getPendingLeaveRequests(): Promise<ILeaveRequest[]>;
    getApprovedLeaveRequests(engineerId: string, fromDate: Date, toDate: Date): Promise<ILeaveRequest[]>;
}

const leaveRequestSchema = new Schema<ILeaveRequest>({
    engineer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    leaveType: {
        type: String,
        enum: Object.values(LeaveType),
        required: true
    },
    fromDate: {
        type: Date,
        required: true,
        index: true
    },
    toDate: {
        type: Date,
        required: true,
        index: true
    },
    reason: {
        type: String,
        enum: Object.values(LeaveReason),
        required: true
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000
    },
    totalDays: {
        type: Number,
        required: false, // Changed from true to false
        min: 0.5,
        max: 365,
        default: 0
    },
    status: {
        type: String,
        enum: Object.values(LeaveStatus),
        required: true,
        default: LeaveStatus.PENDING,
        index: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        maxlength: 500
    },
    documents: [{
        type: String // URLs to uploaded documents
    }],
    remarks: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
leaveRequestSchema.index({ engineer: 1, fromDate: 1, toDate: 1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });
leaveRequestSchema.index({ approvedBy: 1, status: 1 });

// Pre-save middleware to calculate total days
leaveRequestSchema.pre('save', function(next) {
    if (this.fromDate && this.toDate) {
        const fromDate = new Date(this.fromDate);
        const toDate = new Date(this.toDate);
        
        // Calculate business days (excluding weekends)
        let businessDays = 0;
        const currentDate = new Date(fromDate);
        
        while (currentDate <= toDate) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
                businessDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Adjust for half-day leaves
        if (this.leaveType === LeaveType.HALF_DAY) {
            this.totalDays = businessDays * 0.5;
        } else {
            this.totalDays = businessDays;
        }
    }
    next();
});

// Pre-validate middleware to ensure totalDays is calculated before validation
leaveRequestSchema.pre('validate', function(next) {
    if (this.fromDate && this.toDate && !this.totalDays) {
        const fromDate = new Date(this.fromDate);
        const toDate = new Date(this.toDate);
        
        // Calculate business days (excluding weekends)
        let businessDays = 0;
        const currentDate = new Date(fromDate);
        
        while (currentDate <= toDate) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
                businessDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Adjust for half-day leaves
        if (this.leaveType === LeaveType.HALF_DAY) {
            this.totalDays = businessDays * 0.5;
        } else {
            this.totalDays = businessDays;
        }
    }
    next();
});

// Static method to get leave statistics for an engineer
leaveRequestSchema.statics.getEngineerLeaveStats = async function(engineerId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    const stats = await this.aggregate([
        {
            $match: {
                engineer: new mongoose.Types.ObjectId(engineerId),
                fromDate: { $gte: startDate, $lte: endDate },
                status: LeaveStatus.APPROVED
            }
        },
        {
            $group: {
                _id: '$leaveType',
                count: { $sum: 1 },
                totalDays: { $sum: '$totalDays' }
            }
        }
    ]);
    
    // Convert to object format
    const result: any = {
        full_day: { count: 0, totalDays: 0 },
        half_day: { count: 0, totalDays: 0 },
        multiple_days: { count: 0, totalDays: 0 }
    };
    
    stats.forEach((stat: any) => {
        result[stat._id] = { count: stat.count, totalDays: stat.totalDays };
    });
    
    return result;
};

// Static method to get pending leave requests
leaveRequestSchema.statics.getPendingLeaveRequests = async function() {
    return this.find({ status: LeaveStatus.PENDING })
        .populate('engineer', 'firstName lastName email phoneNumber')
        .sort({ createdAt: -1 });
};

// Static method to get approved leave requests for date range
leaveRequestSchema.statics.getApprovedLeaveRequests = async function(engineerId: string, fromDate: Date, toDate: Date) {
    return this.find({
        engineer: engineerId,
        status: LeaveStatus.APPROVED,
        $or: [
            { fromDate: { $gte: fromDate, $lte: toDate } },
            { toDate: { $gte: fromDate, $lte: toDate } },
            { $and: [{ fromDate: { $lte: fromDate } }, { toDate: { $gte: toDate } }] }
        ]
    }).sort({ fromDate: 1 });
};

export const LeaveRequestModel: ILeaveRequestModel = mongoose.model<ILeaveRequest, ILeaveRequestModel>('LeaveRequest', leaveRequestSchema);
export { LeaveType, LeaveStatus, LeaveReason };

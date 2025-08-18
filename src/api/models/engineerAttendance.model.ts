import mongoose, { Schema, Document, Model } from "mongoose";

enum AttendanceStatus {
    PRESENT = "present",
    ABSENT = "absent",
    HALF_DAY = "half_day",
    LEAVE = "leave",
    HOLIDAY = "holiday"
}

export interface IEngineerAttendance extends Document {
    engineer: mongoose.Types.ObjectId; // Reference to User model (engineer)
    date: Date; // Date of attendance
    status: AttendanceStatus; // Present, Absent, Half Day, Leave, Holiday
    checkInTime?: Date; // Check-in time
    checkOutTime?: Date; // Check-out time
    totalHours?: number; // Total working hours
    location?: string; // Location where attendance was marked
    deviceInfo?: string; // Device information
    remark?: string; // Any additional remarks
    markedBy: mongoose.Types.ObjectId; // Who marked the attendance (usually the engineer themselves)
    createdAt: Date;
    updatedAt: Date;
}

// Interface for the model with static methods
export interface IEngineerAttendanceModel extends Model<IEngineerAttendance> {
    getMonthlyAttendance(engineerId: string, year: number, month: number): Promise<IEngineerAttendance[]>;
    getMonthlyStats(engineerId: string, year: number, month: number): Promise<any>;
}

const engineerAttendanceSchema = new Schema<IEngineerAttendance>({
    engineer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: Object.values(AttendanceStatus),
        required: true,
        default: AttendanceStatus.ABSENT
    },
    checkInTime: {
        type: Date
    },
    checkOutTime: {
        type: Date
    },
    totalHours: {
        type: Number,
        min: 0,
        max: 24
    },
    location: {
        type: String
    },
    deviceInfo: {
        type: String
    },
    remark: {
        type: String,
        maxlength: 500
    },
    markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true
});

// Compound index to ensure one attendance record per engineer per date
engineerAttendanceSchema.index({ engineer: 1, date: 1 }, { unique: true });

// Pre-save middleware to calculate total hours if check-in and check-out times are provided
engineerAttendanceSchema.pre('save', function(next) {
    if (this.checkInTime && this.checkOutTime) {
        const diffMs = this.checkOutTime.getTime() - this.checkInTime.getTime();
        this.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimal places
    }
    next();
});

// Static method to get monthly attendance for an engineer
engineerAttendanceSchema.statics.getMonthlyAttendance = async function(engineerId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    return this.find({
        engineer: engineerId,
        date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
};

// Static method to get attendance statistics for a month
engineerAttendanceSchema.statics.getMonthlyStats = async function(engineerId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month - 1, 0, 23, 59, 59, 999);
    
    const stats = await this.aggregate([
        {
            $match: {
                engineer: new mongoose.Types.ObjectId(engineerId),
                date: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
    
    // Convert to object format
    const result: any = {
        present: 0,
        absent: 0,
        half_day: 0,
        leave: 0,
        holiday: 0
    };
    
    stats.forEach((stat: any) => {
        result[stat._id] = stat.count;
    });
    
    return result;
};

export const EngineerAttendanceModel: IEngineerAttendanceModel = mongoose.model<IEngineerAttendance, IEngineerAttendanceModel>('EngineerAttendance', engineerAttendanceSchema);
export { AttendanceStatus };

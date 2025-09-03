import mongoose, { Document, Schema } from 'mongoose';

export interface IModem extends Document {
    userId: mongoose.Types.ObjectId;
    modemName: string;           // MODEM (ONT) NAME
    ontType: 'DUAL_BAND' | 'SINGLE_BAND' | 'OTHERS';  // ONT TYPE
    modelNumber: string;         // MODEL NUMBER
    serialNumber: string;        // SERIAL NUMBER
    ontMac: string;              // ONT MAC
    username: string;            // MODEM(ONT) USERNAME
    password: string;            // MODEM(ONT) PASSWORD
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const modemSchema = new Schema<IModem>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    modemName: {
        type: String,
        required: [true, 'Modem name is required'],
        trim: true,
        maxlength: [100, 'Modem name cannot exceed 100 characters']
    },
    ontType: {
        type: String,
        required: [true, 'ONT type is required'],
        enum: {
            values: ['DUAL_BAND', 'SINGLE_BAND', 'OTHERS'],
            message: 'ONT type must be either DUAL_BAND, SINGLE_BAND, or OTHERS'
        }
    },
    modelNumber: {
        type: String,
        required: [true, 'Model number is required'],
        trim: true,
        maxlength: [50, 'Model number cannot exceed 50 characters']
    },
    serialNumber: {
        type: String,
        required: [true, 'Serial number is required'],
        trim: true,
        unique: true,
        maxlength: [50, 'Serial number cannot exceed 50 characters']
    },
    ontMac: {
        type: String,
        required: [true, 'ONT MAC address is required'],
        trim: true,
        unique: true,
        validate: {
            validator: function (v: string) {
                // Basic MAC address validation (XX:XX:XX:XX:XX:XX format)
                return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(v);
            },
            message: 'Please provide a valid MAC address format (XX:XX:XX:XX:XX:XX)'
        }
    },
    username: {
        type: String,
        required: [true, 'Username is required'],
        trim: true,
        maxlength: [50, 'Username cannot exceed 50 characters']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        trim: true,
        maxlength: [100, 'Password cannot exceed 100 characters']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'modems'
});

// Indexes for better query performance
modemSchema.index({ serialNumber: 1 });
modemSchema.index({ ontMac: 1 });
modemSchema.index({ modelNumber: 1 });
modemSchema.index({ isActive: 1 });

// Pre-save middleware to ensure MAC address is in uppercase
modemSchema.pre('save', function (next) {
    if (this.ontMac) {
        this.ontMac = this.ontMac.toUpperCase();
    }
    next();
});

// Static method to find active modems
modemSchema.statics.findActiveModems = function () {
    return this.find({ isActive: true });
};

// Instance method to deactivate modem
modemSchema.methods.deactivate = function () {
    this.isActive = false;
    return this.save();
};

// Instance method to activate modem
modemSchema.methods.activate = function () {
    this.isActive = true;
    return this.save();
};

// Export the model
export const Modem = mongoose.model<IModem>('Modem', modemSchema);

export default Modem; 
import mongoose, { Document, Schema } from 'mongoose';

export enum ClientUpdateStatus {
    PENDING = 'pending',
    VISITED_SITE = 'visited_site',
    DONE = 'done'
}

export interface IExistingClientUpdate extends Document {
    user: mongoose.Types.ObjectId;
    assignedBy: mongoose.Types.ObjectId;
    assignedEngineer?: mongoose.Types.ObjectId;
    status: ClientUpdateStatus;
    assignedAt: Date;
    visitDate?: Date;
    completedAt?: Date;
    remarks?: string;
    attachments?: string[];
    createdAt: Date;
    updatedAt: Date;
}

const ExistingClientUpdateSchema = new Schema<IExistingClientUpdate>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        assignedEngineer: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            index: true
        },
        status: {
            type: String,
            enum: Object.values(ClientUpdateStatus),
            default: ClientUpdateStatus.PENDING
        },
        assignedAt: {
            type: Date,
            default: Date.now
        },
        visitDate: {
            type: Date
        },
        completedAt: {
            type: Date
        },
        remarks: {
            type: String,
            trim: true
        },
        attachments: [
            {
                type: String,
                trim: true
            }
        ]
    },
    {
        timestamps: true
    }
);

ExistingClientUpdateSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        if (this.status === ClientUpdateStatus.VISITED_SITE && !this.visitDate) {
            this.visitDate = new Date();
        }

        if (this.status === ClientUpdateStatus.DONE && !this.completedAt) {
            this.completedAt = new Date();
        }
    }

    if (!this.assignedAt) {
        this.assignedAt = new Date();
    }

    next();
});

ExistingClientUpdateSchema.index({ status: 1, assignedAt: -1 });
ExistingClientUpdateSchema.index({ user: 1, status: 1 });

const ExistingClientUpdateModel = mongoose.model<IExistingClientUpdate>(
    'ExistingClientUpdate',
    ExistingClientUpdateSchema
);

export { ExistingClientUpdateModel };


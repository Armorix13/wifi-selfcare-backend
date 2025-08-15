import mongoose, { Document, Schema } from 'mongoose';

export interface IFAQ extends Document {
    question: string;
    answer: string;
    category: string;
    tags?: string[];
    status: 'active' | 'inactive';
    isDeleted?: boolean;
    createdBy?: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const FAQSchema: Schema = new Schema(
    {
        question: {
            type: String,
            required: true,
            trim: true
        },
        answer: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            required: true,
            trim: true
        },
        tags: [{
            type: String,
            trim: true
        }],
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active'
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    { timestamps: true }
);

// Pre-save middleware to ensure status is always valid
FAQSchema.pre('save', function (next) {
    // Ensure status is always one of the valid enum values
    if (this.isNew && (!this.status || !['active', 'inactive'].includes(this.status as string))) {
        this.status = 'active';
    }
    next();
});

// Index for better query performance
FAQSchema.index({ question: 'text', answer: 'text', category: 1 });
FAQSchema.index({ status: 1 });
FAQSchema.index({ category: 1 });
FAQSchema.index({ isDeleted: 1 });

const FAQ = mongoose.model<IFAQ>('FAQ', FAQSchema);

export { FAQ };

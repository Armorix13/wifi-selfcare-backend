import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IOttPlan extends Document {
    title: string;
    price: number;
    speedBeforeLimit: string;
    speedAfterLimit: string;
    dataLimitGB: number;
    isUnlimited: boolean;
    validity: string;
    ottApps: string[];
    callBenefit: string;
    provider: string;
    logo: string;
    description: string;
    planType: 'ott';
    createdAt: Date;
    updatedAt: Date;
}

const OttPlanSchema = new Schema<IOttPlan>(
    {
        title: { type: String, required: true },
        price: { type: Number, required: true },
        speedBeforeLimit: { type: String, required: true },
        speedAfterLimit: { type: String, required: true },
        dataLimitGB: { type: Number, required: true },
        isUnlimited: { type: Boolean, default: true },
        validity: { type: String, required: true },
        ottApps: [{ type: String, required: true }],
        callBenefit: { type: String, required: true },
        provider: { type: String, required: true },
        logo: { type: String, required: true },
        description: { type: String, required: true },
        planType: { type: String, default: 'ott' },
    },
    { timestamps: true }
);

const OttPlan: Model<IOttPlan> = mongoose.model<IOttPlan>('OttPlan', OttPlanSchema);

export { OttPlan };

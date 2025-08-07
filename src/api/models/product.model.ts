import mongoose, { Schema, Document, Types } from 'mongoose';


export interface IProduct extends Document {
    title: string;
    description: string;
    price: number;
    discount?: number;
    category: Types.ObjectId;
    images: string[];
    isActive: boolean;
    stock: number;
    sku: string;
    brand?: string;
    tags?: string[];
    attributes?: Record<string, any>;
    averageRating?: number;
    productType: 'user_sale' | 'engineer_only';
    createdAt: Date;
    updatedAt: Date;
}


const ProductSchema = new Schema<IProduct>({
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    images: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    stock: { type: Number, required: true, min: 0 },
    sku: { type: String, required: true, unique: true },
    brand: { type: String },
    tags: { type: [String], default: [], index: true },
    attributes: { type: Schema.Types.Mixed },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    productType: { type: String, enum: ['user_sale', 'engineer_only'], default: 'user_sale', index: true },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Virtual for final price after discount
ProductSchema.virtual('finalPrice').get(function (this: any) {
    if (!this.discount) return this.price;
    return Math.round((this.price * (1 - this.discount / 100)) * 100) / 100;
});

export default mongoose.model<IProduct>('Product', ProductSchema); 
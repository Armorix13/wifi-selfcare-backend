import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICartProduct {
  product: Types.ObjectId;
  quantity: number;
}

export interface ICart extends Document {
  user: Types.ObjectId;
  products: ICartProduct[];
  createdAt: Date;
  updatedAt: Date;
}

const CartProductSchema = new Schema<ICartProduct>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
}, { _id: false });

const CartSchema = new Schema<ICart>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  products: { type: [CartProductSchema], default: [] },
}, {
  timestamps: true,
});

export default mongoose.model<ICart>('Cart', CartSchema); 
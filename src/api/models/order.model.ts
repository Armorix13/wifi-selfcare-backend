import mongoose, { Schema, Document, Types } from 'mongoose';

export type PaymentMethod = 'cash_on_delivery' | 'online' | 'upi' | 'card';
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

export interface IOrderProduct {
  product: Types.ObjectId;
  quantity: number;
  price: number; // price at order time
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  products: IOrderProduct[];
  deliveryAddress?: string;
  name: string;
  phoneNumber: string;
  countryCode: string;
  state: string;
  district: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  orderStatus: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const OrderProductSchema = new Schema<IOrderProduct>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
}, { _id: false });

const OrderSchema = new Schema<IOrder>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  products: { type: [OrderProductSchema], required: true },
  deliveryAddress: { type: String },
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  countryCode: { type: String, required: true },
  state: { type: String, required: true },
  district: { type: String, required: true },
  pincode: { type: String, required: true },
  paymentMethod: { type: String, enum: ['cash_on_delivery', 'online', 'upi', 'card'], default: 'cash_on_delivery' },
  orderStatus: { type: String, enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'], default: 'pending' },
  totalAmount: { type: Number, required: true, min: 0 },
}, {
  timestamps: true,
});

export default mongoose.model<IOrder>('Order', OrderSchema); 
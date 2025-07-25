import mongoose, { Document, Schema } from 'mongoose';

export interface IAdvertisement extends Document {
  imageUrl: string;
  title?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdvertisementSchema: Schema = new Schema(
  {
    imageUrl: { type: String, required: true },
    title: { type: String },
    description: { type: String }
  },
  { timestamps: true }
);

const Advertisement = mongoose.model<IAdvertisement>('Advertisement', AdvertisementSchema);

export { Advertisement }; 
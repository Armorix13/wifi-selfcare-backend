import mongoose, { Schema, Document, model } from "mongoose";

export interface ICategory extends Document {
  name: string;
  description?: string;
  image: string; 
}

const CategorySchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String, required: true },
  },
  {
    timestamps: true
  }
);

export const CategoryModel = model<ICategory>("Category", CategorySchema);

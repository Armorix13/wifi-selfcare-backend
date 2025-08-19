import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage {
    message: string;
    timestamp: Date;
    isUser: boolean;
    options?: string[];
    selectedOption?: string;
}

export interface IChatSession extends Document {
    userId: string;
    sessionId: string;
    userName: string;
    messages: IChatMessage[];
    currentState: string;
    createdAt: Date;
    updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>({
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isUser: { type: Boolean, required: true },
    options: [{ type: String }],
    selectedOption: { type: String }
});

const chatSessionSchema = new Schema<IChatSession>({
    userId: { type: String, required: true },
    sessionId: { type: String, required: true, unique: true },
    userName: { type: String, required: true },
    messages: [chatMessageSchema],
    currentState: { type: String, default: 'waiting_for_name' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

chatSessionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export const ChatSession = mongoose.model<IChatSession>('ChatSession', chatSessionSchema);

import mongoose, { Document, Schema } from 'mongoose';

// Enum for notification types
enum NotificationType {
  ORDER_STATUS = 'order_status',
  PAYMENT = 'payment',
  INSTALLATION = 'installation',
  COMPLAINT = 'complaint',
  BILL = 'bill',
  PROMOTION = 'promotion',
  SYSTEM = 'system',
  MAINTENANCE = 'maintenance',
  PLAN_EXPIRY = 'plan_expiry',
  TECHNICAL_ISSUE = 'technical_issue',
  APPLICATION_STATUS = 'application_status',
  WIFI_INSTALLATION_STATUS = 'wifi_installation_status',
  FIBRE_INSTALLATION_STATUS = 'fibre_installation_status',
  IPTV_INSTALLATION_STATUS = 'iptv_installation_status'
}

// Enum for notification priority
enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Interface for notification metadata
interface INotificationMetadata {
  orderId?: string;
  planId?: string;
  complaintId?: string;
  amount?: number;
  dueDate?: Date;
  status?: string;
  actionUrl?: string;
  applicationId?: string;
  installationId?: string;
  installationType?: string;
  engineerId?: string;
  scheduledDate?: Date;
  completionDate?: Date;
  [key: string]: any; // Allow additional metadata fields
}

// Main notification interface
interface INotification extends Document {
  title: string;
  message: string;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  priority: NotificationPriority;
  metadata?: INotificationMetadata;
  isRead: boolean;
  isDeleted: boolean;
  readAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Schema for notification metadata
const NotificationMetadataSchema = new Schema<INotificationMetadata>({
  orderId: { type: String },
  planId: { type: String },
  complaintId: { type: String },
  amount: { type: Number },
  dueDate: { type: Date },
  status: { type: String },
  actionUrl: { type: String },
  applicationId: { type: String },
  installationId: { type: String },
  installationType: { type: String },
  engineerId: { type: String },
  scheduledDate: { type: Date },
  completionDate: { type: Date }
}, { _id: false });

// Main notification schema
const NotificationSchema: Schema = new Schema(
  {
    title: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 200
    },
    message: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 1000
    },
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true
    },
    type: { 
      type: String, 
      enum: Object.values(NotificationType), 
      required: true,
      index: true
    },
    priority: { 
      type: String, 
      enum: Object.values(NotificationPriority), 
      default: NotificationPriority.MEDIUM,
      index: true
    },
    metadata: { 
      type: NotificationMetadataSchema,
      default: {}
    },
    isRead: { 
      type: Boolean, 
      default: false,
      index: true
    },
    isDeleted: { 
      type: Boolean, 
      default: false,
      index: true
    },
    readAt: { 
      type: Date 
    },
    expiresAt: { 
      type: Date,
      index: true
    }
  },
  { 
    timestamps: true 
  }
);

// Indexes for better query performance
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, isRead: 1 });
NotificationSchema.index({ type: 1, priority: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for expired notifications

// Static method to create notification with type-specific metadata
NotificationSchema.statics.createNotification = function(data: {
  title: string;
  message: string;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  priority?: NotificationPriority;
  metadata?: INotificationMetadata;
  expiresAt?: Date;
}) {
  return this.create({
    ...data,
    priority: data.priority || NotificationPriority.MEDIUM,
    metadata: data.metadata || {}
  });
};

// Instance method to mark as read
NotificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Instance method to mark as unread
NotificationSchema.methods.markAsUnread = function() {
  this.isRead = false;
  this.readAt = undefined;
  return this.save();
};

// Instance method to soft delete
NotificationSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

const NotificationModel = mongoose.model<INotification>('Notification', NotificationSchema);

export { NotificationModel, NotificationType, NotificationPriority, INotificationMetadata };

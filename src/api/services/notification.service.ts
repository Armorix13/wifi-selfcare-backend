import { NotificationModel, NotificationType, NotificationPriority, INotificationMetadata } from '../models/notification.model';
import mongoose from 'mongoose';

// Define the notification interface locally since it's not exported from the model
interface INotification extends mongoose.Document {
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

export class NotificationService {
  
  /**
   * Create a new notification
   */
  static async createNotification(data: {
    title: string;
    message: string;
    userId: mongoose.Types.ObjectId;
    type: NotificationType;
    priority?: NotificationPriority;
    metadata?: INotificationMetadata;
    expiresAt?: Date;
  }): Promise<INotification> {
    try {
      const notification = await NotificationModel.create(data);
      return notification as INotification;
    } catch (error: any) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Create multiple notifications for multiple users
   */
  static async createBulkNotifications(data: {
    title: string;
    message: string;
    userIds: mongoose.Types.ObjectId[];
    type: NotificationType;
    priority?: NotificationPriority;
    metadata?: INotificationMetadata;
    expiresAt?: Date;
  }): Promise<INotification[]> {
    try {
      const notifications = data.userIds.map(userId => ({
        title: data.title,
        message: data.message,
        userId,
        type: data.type,
        priority: data.priority || NotificationPriority.MEDIUM,
        metadata: data.metadata || {},
        expiresAt: data.expiresAt
      }));

      const createdNotifications = await NotificationModel.insertMany(notifications);
      return createdNotifications as INotification[];
    } catch (error: any) {
      throw new Error(`Failed to create bulk notifications: ${error.message}`);
    }
  }

  /**
   * Create application status notification
   */
  static async createApplicationStatusNotification(data: {
    userId: mongoose.Types.ObjectId;
    applicationId: string;
    status: string;
    message: string;
    priority?: NotificationPriority;
  }): Promise<INotification> {
    return this.createNotification({
      title: `Application Status Update`,
      message: data.message,
      userId: data.userId,
      type: NotificationType.APPLICATION_STATUS,
      priority: data.priority || NotificationPriority.MEDIUM,
      metadata: {
        applicationId: data.applicationId,
        status: data.status
      }
    });
  }

  /**
   * Create WiFi installation status notification
   */
  static async createWifiInstallationNotification(data: {
    userId: mongoose.Types.ObjectId;
    installationId: string;
    status: string;
    message: string;
    engineerId?: string;
    scheduledDate?: Date;
    completionDate?: Date;
    priority?: NotificationPriority;
  }): Promise<INotification> {
    return this.createNotification({
      title: `WiFi Installation Update`,
      message: data.message,
      userId: data.userId,
      type: NotificationType.WIFI_INSTALLATION_STATUS,
      priority: data.priority || NotificationPriority.MEDIUM,
      metadata: {
        installationId: data.installationId,
        installationType: 'wifi',
        status: data.status,
        engineerId: data.engineerId,
        scheduledDate: data.scheduledDate,
        completionDate: data.completionDate
      }
    });
  }

  /**
   * Create fibre installation status notification
   */
  static async createFibreInstallationNotification(data: {
    userId: mongoose.Types.ObjectId;
    installationId: string;
    status: string;
    message: string;
    engineerId?: string;
    scheduledDate?: Date;
    completionDate?: Date;
    priority?: NotificationPriority;
  }): Promise<INotification> {
    return this.createNotification({
      title: `Fibre Installation Update`,
      message: data.message,
      userId: data.userId,
      type: NotificationType.FIBRE_INSTALLATION_STATUS,
      priority: data.priority || NotificationPriority.MEDIUM,
      metadata: {
        installationId: data.installationId,
        installationType: 'fibre',
        status: data.status,
        engineerId: data.engineerId,
        scheduledDate: data.scheduledDate,
        completionDate: data.completionDate
      }
    });
  }

  /**
   * Create IPTV installation status notification
   */
  static async createIptvInstallationNotification(data: {
    userId: mongoose.Types.ObjectId;
    installationId: string;
    status: string;
    message: string;
    engineerId?: string;
    scheduledDate?: Date;
    completionDate?: Date;
    priority?: NotificationPriority;
  }): Promise<INotification> {
    return this.createNotification({
      title: `IPTV Installation Update`,
      message: data.message,
      userId: data.userId,
      type: NotificationType.IPTV_INSTALLATION_STATUS,
      priority: data.priority || NotificationPriority.MEDIUM,
      metadata: {
        installationId: data.installationId,
        installationType: 'iptv',
        status: data.status,
        engineerId: data.engineerId,
        scheduledDate: data.scheduledDate,
        completionDate: data.completionDate
      }
    });
  }

  /**
   * Create payment notification
   */
  static async createPaymentNotification(data: {
    userId: mongoose.Types.ObjectId;
    amount: number;
    status: string;
    message: string;
    orderId?: string;
    priority?: NotificationPriority;
  }): Promise<INotification> {
    return this.createNotification({
      title: `Payment ${data.status}`,
      message: data.message,
      userId: data.userId,
      type: NotificationType.PAYMENT,
      priority: data.priority || NotificationPriority.HIGH,
      metadata: {
        orderId: data.orderId,
        amount: data.amount,
        status: data.status
      }
    });
  }

  /**
   * Create complaint status notification
   */
  static async createComplaintNotification(data: {
    userId: mongoose.Types.ObjectId;
    complaintId: string;
    status: string;
    message: string;
    priority?: NotificationPriority;
  }): Promise<INotification> {
    return this.createNotification({
      title: `Complaint Status Update`,
      message: data.message,
      userId: data.userId,
      type: NotificationType.COMPLAINT,
      priority: data.priority || NotificationPriority.MEDIUM,
      metadata: {
        complaintId: data.complaintId,
        status: data.status
      }
    });
  }

  /**
   * Create bill notification
   */
  static async createBillNotification(data: {
    userId: mongoose.Types.ObjectId;
    amount: number;
    dueDate: Date;
    message: string;
    priority?: NotificationPriority;
  }): Promise<INotification> {
    return this.createNotification({
      title: `Bill Due`,
      message: data.message,
      userId: data.userId,
      type: NotificationType.BILL,
      priority: data.priority || NotificationPriority.HIGH,
      metadata: {
        amount: data.amount,
        dueDate: data.dueDate
      }
    });
  }

  /**
   * Create plan expiry notification
   */
  static async createPlanExpiryNotification(data: {
    userId: mongoose.Types.ObjectId;
    planId: string;
    planName: string;
    expiryDate: Date;
    message: string;
    priority?: NotificationPriority;
  }): Promise<INotification> {
    return this.createNotification({
      title: `Plan Expiry Warning`,
      message: data.message,
      userId: data.userId,
      type: NotificationType.PLAN_EXPIRY,
      priority: data.priority || NotificationPriority.HIGH,
      metadata: {
        planId: data.planId,
        planName: data.planName,
        dueDate: data.expiryDate
      }
    });
  }

  /**
   * Create system notification
   */
  static async createSystemNotification(data: {
    userId: mongoose.Types.ObjectId;
    title: string;
    message: string;
    priority?: NotificationPriority;
    metadata?: INotificationMetadata;
  }): Promise<INotification> {
    return this.createNotification({
      title: data.title,
      message: data.message,
      userId: data.userId,
      type: NotificationType.SYSTEM,
      priority: data.priority || NotificationPriority.MEDIUM,
      metadata: data.metadata
    });
  }

  /**
   * Create maintenance notification
   */
  static async createMaintenanceNotification(data: {
    userId: mongoose.Types.ObjectId;
    scheduledDate: Date;
    duration: string;
    message: string;
    priority?: NotificationPriority;
  }): Promise<INotification> {
    return this.createNotification({
      title: `Scheduled Maintenance`,
      message: data.message,
      userId: data.userId,
      type: NotificationType.MAINTENANCE,
      priority: data.priority || NotificationPriority.MEDIUM,
      metadata: {
        scheduledDate: data.scheduledDate,
        duration: data.duration
      }
    });
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(userId: mongoose.Types.ObjectId, options: {
    limit?: number;
    skip?: number;
    isRead?: boolean;
    type?: NotificationType;
    priority?: NotificationPriority;
  } = {}): Promise<{ notifications: INotification[]; total: number }> {
    try {
      const { limit = 20, skip = 0, isRead, type, priority } = options;
      
      const filter: any = { userId, isDeleted: false };
      if (isRead !== undefined) filter.isRead = isRead;
      if (type) filter.type = type;
      if (priority) filter.priority = priority;

      const [notifications, total] = await Promise.all([
        NotificationModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        NotificationModel.countDocuments(filter)
      ]);

      return { notifications: notifications as INotification[], total };
    } catch (error: any) {
      throw new Error(`Failed to get user notifications: ${error.message}`);
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: mongoose.Types.ObjectId): Promise<INotification> {
    try {
      const notification = await NotificationModel.findById(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }
      // Update the notification directly since markAsRead method doesn't exist
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
      return notification as INotification;
    } catch (error: any) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  /**
   * Mark all user notifications as read
   */
  static async markAllAsRead(userId: mongoose.Types.ObjectId): Promise<{ modifiedCount: number }> {
    try {
      const result = await NotificationModel.updateMany(
        { userId, isRead: false, isDeleted: false },
        { 
          $set: { 
            isRead: true, 
            readAt: new Date() 
          } 
        }
      );
      return { modifiedCount: result.modifiedCount };
    } catch (error: any) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  /**
   * Get unread notification count for user
   */
  static async getUnreadCount(userId: mongoose.Types.ObjectId): Promise<number> {
    try {
      return await NotificationModel.countDocuments({
        userId,
        isRead: false,
        isDeleted: false
      });
    } catch (error: any) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }
  }

  /**
   * Delete notification (soft delete)
   */
  static async deleteNotification(notificationId: mongoose.Types.ObjectId): Promise<INotification> {
    try {
      const notification = await NotificationModel.findById(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }
      // Update the notification directly since softDelete method doesn't exist
      notification.isDeleted = true;
      await notification.save();
      return notification as INotification;
    } catch (error: any) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  }

  /**
   * Delete expired notifications
   */
  static async deleteExpiredNotifications(): Promise<{ deletedCount: number }> {
    try {
      const result = await NotificationModel.deleteMany({
        expiresAt: { $lt: new Date() }
      });
      return { deletedCount: result.deletedCount };
    } catch (error: any) {
      throw new Error(`Failed to delete expired notifications: ${error.message}`);
    }
  }
}

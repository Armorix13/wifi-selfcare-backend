export interface IStatusHistory {
  status: string;
  remarks?: string;
  metadata?: Record<string, any>;
  updatedBy?: string; // User ID who made the change
  updatedAt: Date;
  previousStatus?: string; // Previous status for reference
  additionalInfo?: Record<string, any>; // Any other relevant information
}

export interface IStatusHistoryDocument extends IStatusHistory, Document {}

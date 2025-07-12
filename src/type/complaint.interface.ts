import { ComplaintStatus, ComplaintType, Priority } from "../api/models/complaint.model";

export interface CreateComplaintBody {
  title: string;
  issueDescription: string;
  complaintType: ComplaintType;
  phoneNumber: string;
  attachments?: string[];
}

export interface UpdateStatusBody {
  status: ComplaintStatus;
  resolved?: boolean;
  remark?: string;
  notResolvedReason?: string;
  resolutionNotes?: string;
}

export interface AssignEngineerBody {
  engineerId: string;
  priority?: Priority; // Admin can set priority when assigning
}
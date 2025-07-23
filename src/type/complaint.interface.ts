import { ComplaintStatus, Priority } from "../api/models/complaint.model";

export interface CreateComplaintBody {
  title: string;
  issueDescription: string;
  issueType: string;
  phoneNumber: string;
  attachments?: string[];

  // Customer Data
  fatherName?: string;
  alternativeNumber?: string;
  address?: string;
  landlineNumber?: string;

  // Modem Data
  modemName?: string;
  modemType?: string;
  macNumber?: string;
  modemUsername?: string;
  modemPassword?: string;
  serialNumber?: string;

  // Soft Details
  internetAccessId?: string;
  userIdSoft?: string;
  plan?: string;
  softPassword?: string;
  oltPort?: string;
  ponPort?: string;
  ontDistance?: string;
  portStatus?: string;
  ontTxPower?: string;
  ontRxPower?: string;

  // OTP for complaint resolution
  otp?: string;

  // Re-complaint fields
  isReComplaint?: boolean;
  parentComplaintId?: string;
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
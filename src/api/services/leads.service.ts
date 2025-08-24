import { Leads, ILeads, LeadStatus, LeadPlatform } from "../models/leads.model";
import { IUser } from "../models/user.model";

// Check if a phone number already exists in leads
export const isPhoneNumberExists = async (phoneNumber: string, countryCode: string, excludeId?: string): Promise<boolean> => {
  const filter: any = { phoneNumber, countryCode };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  
  const existingLead = await Leads.findOne(filter);
  return !!existingLead;
};

// Get leads count by status
export const getLeadsCountByStatus = async (): Promise<{ [key: string]: number }> => {
  const result = await Leads.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);

  const statusCounts: { [key: string]: number } = {};
  result.forEach(item => {
    statusCounts[item._id] = item.count;
  });

  // Ensure all statuses are present
  Object.values(LeadStatus).forEach(status => {
    if (!statusCounts[status]) {
      statusCounts[status] = 0;
    }
  });

  return statusCounts;
};

// Get leads count by platform
export const getLeadsCountByPlatform = async (): Promise<{ [key: string]: number }> => {
  const result = await Leads.aggregate([
    {
      $group: {
        _id: "$leadPlatform",
        count: { $sum: 1 }
      }
    }
  ]);

  const platformCounts: { [key: string]: number } = {};
  result.forEach(item => {
    platformCounts[item._id] = item.count;
  });

  return platformCounts;
};

// Get leads by date range
export const getLeadsByDateRange = async (startDate: Date, endDate: Date): Promise<ILeads[]> => {
  return await Leads.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate("byUserId", "firstName lastName email phoneNumber")
    .populate("byEngineerId", "firstName lastName email phoneNumber")
    .populate("assignedTo", "firstName lastName email phoneNumber")
    .sort({ createdAt: -1 });
};

// Get leads summary for dashboard
export const getLeadsSummary = async (): Promise<{
  totalLeads: number;
  todayLeads: number;
  thisWeekLeads: number;
  thisMonthLeads: number;
  pendingLeads: number;
  acceptedLeads: number;
  rejectedLeads: number;
}> => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalLeads,
    todayLeads,
    thisWeekLeads,
    thisMonthLeads,
    pendingLeads,
    acceptedLeads,
    rejectedLeads
  ] = await Promise.all([
    Leads.countDocuments(),
    Leads.countDocuments({ createdAt: { $gte: startOfDay } }),
    Leads.countDocuments({ createdAt: { $gte: startOfWeek } }),
    Leads.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Leads.countDocuments({ status: LeadStatus.INREVIEW }),
    Leads.countDocuments({ status: LeadStatus.ACCEPTED }),
    Leads.countDocuments({ status: LeadStatus.REJECTED })
  ]);

  return {
    totalLeads,
    todayLeads,
    thisWeekLeads,
    thisMonthLeads,
    pendingLeads,
    acceptedLeads,
    rejectedLeads
  };
};

// Assign lead to engineer
export const assignLeadToEngineer = async (leadId: string, engineerId: string): Promise<ILeads | null> => {
  // Check if engineer exists and has engineer role
  const engineer = await Leads.findById(engineerId);
  if (!engineer || (engineer as any).role !== "engineer") {
    throw new Error("Invalid engineer ID or user is not an engineer");
  }

  // Update lead with assigned engineer
  const updatedLead = await Leads.findByIdAndUpdate(
    leadId,
    { assignedTo: engineerId },
    { new: true, runValidators: true }
  ).populate("byUserId", "firstName lastName email phoneNumber")
    .populate("byEngineerId", "firstName lastName email phoneNumber")
    .populate("assignedTo", "firstName lastName email phoneNumber");

  return updatedLead;
};

// Get leads assigned to specific engineer
export const getLeadsAssignedToEngineer = async (engineerId: string, status?: LeadStatus): Promise<ILeads[]> => {
  const filter: any = { assignedTo: engineerId };
  if (status) {
    filter.status = status;
  }

  return await Leads.find(filter)
    .populate("byUserId", "firstName lastName email phoneNumber")
    .populate("byEngineerId", "firstName lastName email phoneNumber")
    .populate("assignedTo", "firstName lastName email phoneNumber")
    .sort({ createdAt: -1 });
};

// Get leads by priority
export const getLeadsByPriority = async (priority: 'low' | 'medium' | 'high'): Promise<ILeads[]> => {
  return await Leads.find({ priority })
    .populate("byUserId", "firstName lastName email phoneNumber")
    .populate("byEngineerId", "firstName lastName email phoneNumber")
    .populate("assignedTo", "firstName lastName email phoneNumber")
    .sort({ createdAt: -1 });
};

// Search leads with advanced filters
export const searchLeads = async (query: string, filters: any = {}): Promise<ILeads[]> => {
  const searchQuery: any = {
    $or: [
      { firstName: { $regex: query, $options: "i" } },
      { lastName: { $regex: query, $options: "i" } },
      { phoneNumber: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
      { companyName: { $regex: query, $options: "i" } },
      { installationAddress: { $regex: query, $options: "i" } }
    ]
  };

  // Merge with additional filters
  const finalQuery = { ...searchQuery, ...filters };

  return await Leads.find(finalQuery)
    .populate("byUserId", "firstName lastName email phoneNumber")
    .populate("byEngineerId", "firstName lastName email phoneNumber")
    .populate("assignedTo", "firstName lastName email phoneNumber")
    .sort({ createdAt: -1 });
};

// Get leads that need follow-up (older than 7 days with inreview status)
export const getLeadsNeedingFollowUp = async (): Promise<ILeads[]> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return await Leads.find({
    status: LeadStatus.INREVIEW,
    createdAt: { $lte: sevenDaysAgo }
  }).populate("byUserId", "firstName lastName email phoneNumber")
    .populate("byEngineerId", "firstName lastName email phoneNumber")
    .populate("assignedTo", "firstName lastName email phoneNumber")
    .sort({ createdAt: 1 });
};

// Export leads to CSV format (basic structure)
export const exportLeadsToCSV = async (filters: any = {}): Promise<string> => {
  const leads = await Leads.find(filters)
    .populate("byUserId", "firstName lastName email phoneNumber")
    .populate("byEngineerId", "firstName lastName email phoneNumber")
    .populate("assignedTo", "firstName lastName email phoneNumber")
    .sort({ createdAt: -1 });

  // CSV header
  const headers = [
    "ID",
    "First Name",
    "Last Name",
    "Phone Number",
    "Country Code",
    "Email",
    "Status",
    "Lead Platform",
    "Connection Type",
    "Installation Address",
    "Company Name",
    "Priority",
    "Created Date",
    "By User",
    "By Engineer",
    "Assigned To"
  ];

  // CSV rows
  const rows = leads.map(lead => [
    lead._id,
    lead.firstName,
    lead.lastName,
    lead.phoneNumber,
    lead.countryCode,
    lead.email || "",
    lead.status,
    lead.leadPlatform,
    lead.connectionType || "",
    lead.installationAddress || "",
    lead.companyName || "",
    lead.priority,
    lead.createdAt.toISOString(),
    lead.byUserId ? `${(lead.byUserId as any).firstName} ${(lead.byUserId as any).lastName}` : "",
    lead.byEngineerId ? `${(lead.byEngineerId as any).firstName} ${(lead.byEngineerId as any).lastName}` : "",
    lead.assignedTo ? `${(lead.assignedTo as any).firstName} ${(lead.assignedTo as any).lastName}` : ""
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(","))
    .join("\n");

  return csvContent;
};

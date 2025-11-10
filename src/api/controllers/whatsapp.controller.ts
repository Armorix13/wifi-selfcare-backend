import { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/helper";
import { UserModel } from "../models/user.model";
import { Leads, LeadStatus, LeadPlatform } from "../models/leads.model";

export const addLeadUsingWhatsapp = async (req: Request, res: Response): Promise<any> => {
    try {
        const { name, email, address, phoneNumber, companyPhone, countryCode } = req.body;

        console.log("WhatsApp lead request body:", req.body);

        // Validate required fields
        if (!name || !phoneNumber || !companyPhone || !address) {
            return sendError(res, 'Name, phone number, company phone, and address are required', 400);
        }

        // Find company by companyPhone
        const findCompany = await UserModel.findOne({ companyPhone });
        if (!findCompany) {
            return sendError(res, 'Company not found with the provided phone number', 404);
        }

        // Split name into firstName and lastName
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || name;
        const lastName = nameParts.slice(1).join(' ') || '';

        // Extract countryCode from phoneNumber if not provided
        let finalCountryCode = countryCode;
        if (!finalCountryCode && phoneNumber) {
            // Try to extract country code from phone number (basic extraction)
            if (phoneNumber.startsWith('+')) {
                const match = phoneNumber.match(/^\+(\d{1,3})/);
                if (match) {
                    finalCountryCode = `+${match[1]}`;
                }
            }
        }

        // If still no countryCode, require it
        if (!finalCountryCode) {
            return sendError(res, 'Country code is required', 400);
        }

        // Create new lead
        const newLead = new Leads({
            byCompanyId: findCompany._id,
            firstName,
            lastName,
            phoneNumber,
            countryCode: finalCountryCode,
            email: email || undefined,
            installationAddress: address,
            leadPlatform: LeadPlatform.FROM_WHATSAPP,
            status: LeadStatus.UNTRACKED,
            isTracked: false,
            contactAttempts: 0,
            priority: 'medium',
            lastContactDate: new Date(),
        });

        await newLead.save();

        return sendSuccess(res, newLead, 'Lead created successfully from WhatsApp', 201);
    } catch (error: any) {
        console.error('Error in addLeadUsingWhatsapp:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return sendError(res, 'Validation error: ' + error.message, 400);
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            return sendError(res, 'Lead with this phone number already exists', 409);
        }

        return sendError(res, 'Internal server error', 500, error.message || error);
    }
}

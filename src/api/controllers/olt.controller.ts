import { Request, Response } from "express";
import { OLTModel } from "../models/olt.model";
import { MSModel } from "../models/ms.model";
import { SUBMSModel } from "../models/subms.model";
import { FDBModel } from "../models/fdb.model";
import { X2Model } from "../models/x2.model";
import { UserModel } from "../models/user.model";

// ==================== OLT FUNCTIONS ====================

// Create OLT
export const createOLT = async (req: Request, res: Response): Promise<any> => {
  try {
    const oltData = req.body;
    
    // Extract location array if provided
    if (oltData.location && Array.isArray(oltData.location)) {
      oltData.latitude = oltData.location[0];
      oltData.longitude = oltData.location[1];
      delete oltData.location;
    }
    
    const olt = new OLTModel(oltData);
    const savedOLT = await olt.save();
    
    res.status(201).json({
      success: true,
      message: "OLT created successfully",
      data: savedOLT
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating OLT",
      error: error.message
    });
  }
};

// Get all OLTs
export const getAllOLTs = async (req: Request, res: Response): Promise<any> => {
  try {
    const olts = await OLTModel.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: olts.length,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching OLTs",
      error: error.message
    });
  }
};

// Get OLT by ID
export const getOLTById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const olt = await OLTModel.findById(id);
    
    if (!olt) {
      return res.status(404).json({
        success: false,
        message: "OLT not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: olt
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching OLT",
      error: error.message
    });
  }
};

// Update OLT
export const updateOLT = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Handle location update
    if (updateData.location && Array.isArray(updateData.location)) {
      updateData.latitude = updateData.location[0];
      updateData.longitude = updateData.location[1];
      delete updateData.location;
    }
    
    const olt = await OLTModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!olt) {
      return res.status(404).json({
        success: false,
        message: "OLT not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "OLT updated successfully",
      data: olt
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating OLT",
      error: error.message
    });
  }
};

// Delete OLT
export const deleteOLT = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const olt = await OLTModel.findByIdAndDelete(id);
    
    if (!olt) {
      return res.status(404).json({
        success: false,
        message: "OLT not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "OLT deleted successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting OLT",
      error: error.message
    });
  }
};

// Get OLT network topology
export const getOLTNetworkTopology = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const olt = await OLTModel.findById(id);
    
    if (!olt) {
      return res.status(404).json({
        success: false,
        message: "OLT not found"
      });
    }

    // Get connected MS devices
    const connectedMS = await MSModel.find({
      "input.type": "olt",
      "input.id": olt.oltId
    });

    // Get connected FDB devices
    const connectedFDB = await FDBModel.find({
      "input.type": "olt",
      "input.id": olt.oltId
    });

    const topology = {
      olt,
      connectedDevices: {
        ms: connectedMS,
        fdb: connectedFDB
      }
    };

    res.status(200).json({
      success: true,
      data: topology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching network topology",
      error: error.message
    });
  }
};

// Search OLTs by location
export const searchOLTsByLocation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { latitude, longitude, radius = 10000 } = req.query; // radius in meters
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    const olts = await OLTModel.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude as string), parseFloat(latitude as string)]
          },
          $maxDistance: parseInt(radius as string)
        }
      }
    });

    res.status(200).json({
      success: true,
      count: olts.length,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by location",
      error: error.message
    });
  }
};

// ==================== MS FUNCTIONS ====================

// Create MS
export const createMS = async (req: Request, res: Response): Promise<any> => {
  try {
    const msData = req.body;
    
    // Extract location array if provided
    if (msData.location && Array.isArray(msData.location)) {
      msData.latitude = msData.location[0];
      msData.longitude = msData.location[1];
      delete msData.location;
    }
    
    const ms = new MSModel(msData);
    const savedMS = await ms.save();
    
    res.status(201).json({
      success: true,
      message: "MS created successfully",
      data: savedMS
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating MS",
      error: error.message
    });
  }
};

// Get all MS devices
export const getAllMS = async (req: Request, res: Response): Promise<any> => {
  try {
    const msDevices = await MSModel.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: msDevices.length,
      data: msDevices
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching MS devices",
      error: error.message
    });
  }
};

// Get MS by ID
export const getMSById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const ms = await MSModel.findById(id);
    
    if (!ms) {
      return res.status(404).json({
        success: false,
        message: "MS not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: ms
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching MS",
      error: error.message
    });
  }
};

// Update MS
export const updateMS = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Handle location update
    if (updateData.location && Array.isArray(updateData.location)) {
      updateData.latitude = updateData.location[0];
      updateData.longitude = updateData.location[1];
      delete updateData.location;
    }
    
    const ms = await MSModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!ms) {
      return res.status(404).json({
        success: false,
        message: "MS not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "MS updated successfully",
      data: ms
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating MS",
      error: error.message
    });
  }
};

// Delete MS
export const deleteMS = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const ms = await MSModel.findByIdAndDelete(id);
    
    if (!ms) {
      return res.status(404).json({
        success: false,
        message: "MS not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "MS deleted successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting MS",
      error: error.message
    });
  }
};

// Get MS network topology
export const getMSNetworkTopology = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const ms = await MSModel.findById(id);
    
    if (!ms) {
      return res.status(404).json({
        success: false,
        message: "MS not found"
      });
    }

    // Get input device (OLT or other MS)
    let inputDevice = null;
    if (ms.input.type === "olt") {
      inputDevice = await OLTModel.findOne({ oltId: ms.input.id });
    } else if (ms.input.type === "ms") {
      inputDevice = await MSModel.findOne({ msId: ms.input.id });
    }

    // Get connected SUBMS devices
    const connectedSUBMS = await SUBMSModel.find({
      "input.type": "ms",
      "input.id": ms.msId
    });

    // Get connected FDB devices
    const connectedFDB = await FDBModel.find({
      "input.type": "ms",
      "input.id": ms.msId
    });

    const topology = {
      ms,
      inputDevice,
      connectedDevices: {
        subms: connectedSUBMS,
        fdb: connectedFDB
      }
    };

    res.status(200).json({
      success: true,
      data: topology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching MS network topology",
      error: error.message
    });
  }
};

// ==================== SUBMS FUNCTIONS ====================

// Create SUBMS
export const createSUBMS = async (req: Request, res: Response): Promise<any> => {
  try {
    const submsData = req.body;
    
    // Extract location array if provided
    if (submsData.location && Array.isArray(submsData.location)) {
      submsData.latitude = submsData.location[0];
      submsData.longitude = submsData.location[1];
      delete submsData.location;
    }
    
    const subms = new SUBMSModel(submsData);
    const savedSUBMS = await subms.save();
    
    res.status(201).json({
      success: true,
      message: "SUBMS created successfully",
      data: savedSUBMS
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating SUBMS",
      error: error.message
    });
  }
};

// Get all SUBMS devices
export const getAllSUBMS = async (req: Request, res: Response): Promise<any> => {
  try {
    const submsDevices = await SUBMSModel.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: submsDevices.length,
      data: submsDevices
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching SUBMS devices",
      error: error.message
    });
  }
};

// Get SUBMS by ID
export const getSUBMSById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const subms = await SUBMSModel.findById(id);
    
    if (!subms) {
      return res.status(404).json({
        success: false,
        message: "SUBMS not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: subms
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching SUBMS",
      error: error.message
    });
  }
};

// Update SUBMS
export const updateSUBMS = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Handle location update
    if (updateData.location && Array.isArray(updateData.location)) {
      updateData.latitude = updateData.location[0];
      updateData.longitude = updateData.location[1];
      delete updateData.location;
    }
    
    const subms = await SUBMSModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!subms) {
      return res.status(404).json({
        success: false,
        message: "SUBMS not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "SUBMS updated successfully",
      data: subms
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating SUBMS",
      error: error.message
    });
  }
};

// Delete SUBMS
export const deleteSUBMS = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const subms = await SUBMSModel.findByIdAndDelete(id);
    
    if (!subms) {
      return res.status(404).json({
        success: false,
        message: "SUBMS not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "SUBMS deleted successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting SUBMS",
      error: error.message
    });
  }
};

// ==================== FDB FUNCTIONS ====================

// Create FDB
export const createFDB = async (req: Request, res: Response): Promise<any> => {
  try {
    const fdbData = req.body;
    
    // Extract location array if provided
    if (fdbData.location && Array.isArray(fdbData.location)) {
      fdbData.latitude = fdbData.location[0];
      fdbData.longitude = fdbData.location[1];
      delete fdbData.location;
    }
    
    const fdb = new FDBModel(fdbData);
    const savedFDB = await fdb.save();
    
    res.status(201).json({
      success: true,
      message: "FDB created successfully",
      data: savedFDB
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating FDB",
      error: error.message
    });
  }
};

// Get all FDB devices
export const getAllFDB = async (req: Request, res: Response): Promise<any> => {
  try {
    const fdbDevices = await FDBModel.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: fdbDevices.length,
      data: fdbDevices
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching FDB devices",
      error: error.message
    });
  }
};

// Get FDB by ID
export const getFDBById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const fdb = await FDBModel.findById(id);
    
    if (!fdb) {
      return res.status(404).json({
        success: false,
        message: "FDB not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: fdb
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching FDB",
      error: error.message
    });
  }
};

// Update FDB
export const updateFDB = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Handle location update
    if (updateData.location && Array.isArray(updateData.location)) {
      updateData.latitude = updateData.location[0];
      updateData.longitude = updateData.location[1];
      delete updateData.location;
    }
    
    const fdb = await FDBModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!fdb) {
      return res.status(404).json({
        success: false,
        message: "FDB not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "FDB updated successfully",
      data: fdb
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating FDB",
      error: error.message
    });
  }
};

// Delete FDB
export const deleteFDB = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const fdb = await FDBModel.findByIdAndDelete(id);
    
    if (!fdb) {
      return res.status(404).json({
        success: false,
        message: "FDB not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "FDB deleted successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting FDB",
      error: error.message
    });
  }
};

// Get FDB network topology
export const getFDBNetworkTopology = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const fdb = await FDBModel.findById(id);
    
    if (!fdb) {
      return res.status(404).json({
        success: false,
        message: "FDB not found"
      });
    }

    // Get input device
    let inputDevice = null;
    if (fdb.input.type === "olt") {
      inputDevice = await OLTModel.findOne({ oltId: fdb.input.id });
    } else if (fdb.input.type === "ms") {
      inputDevice = await MSModel.findOne({ msId: fdb.input.id });
    }

    // Get connected X2 devices
    const connectedX2 = await X2Model.find({
      "input.type": "fdb",
      "input.id": fdb.fdbId
    });

    const topology = {
      fdb,
      inputDevice,
      connectedDevices: {
        x2: connectedX2
      }
    };

    res.status(200).json({
      success: true,
      data: topology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching FDB network topology",
      error: error.message
    });
  }
};

// ==================== X2 FUNCTIONS ====================

// Create X2
export const createX2 = async (req: Request, res: Response): Promise<any> => {
  try {
    const x2Data = req.body;
    
    // Extract location array if provided
    if (x2Data.location && Array.isArray(x2Data.location)) {
      x2Data.latitude = x2Data.location[0];
      x2Data.longitude = x2Data.location[1];
      delete x2Data.location;
    }
    
    const x2 = new X2Model(x2Data);
    const savedX2 = await x2.save();
    
    res.status(201).json({
      success: true,
      message: "X2 created successfully",
      data: savedX2
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating X2",
      error: error.message
    });
  }
};

// Get all X2 devices
export const getAllX2 = async (req: Request, res: Response): Promise<any> => {
  try {
    const x2Devices = await X2Model.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: x2Devices.length,
      data: x2Devices
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching X2 devices",
      error: error.message
    });
  }
};

// Get X2 by ID
export const getX2ById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const x2 = await X2Model.findById(id);
    
    if (!x2) {
      return res.status(404).json({
        success: false,
        message: "X2 not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: x2
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching X2",
      error: error.message
    });
  }
};

// Update X2
export const updateX2 = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Handle location update
    if (updateData.location && Array.isArray(updateData.location)) {
      updateData.latitude = updateData.location[0];
      updateData.longitude = updateData.location[1];
      delete updateData.location;
    }
    
    const x2 = await X2Model.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!x2) {
      return res.status(404).json({
        success: false,
        message: "X2 not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "X2 updated successfully",
      data: x2
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating X2",
      error: error.message
    });
  }
};

// Delete X2
export const deleteX2 = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const x2 = await X2Model.findByIdAndDelete(id);
    
    if (!x2) {
      return res.status(404).json({
        success: false,
        message: "X2 not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "X2 deleted successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting X2",
      error: error.message
    });
  }
};

// Get X2 network topology
export const getX2NetworkTopology = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const x2 = await X2Model.findById(id);
    
    if (!x2) {
      return res.status(404).json({
        success: false,
        message: "X2 not found"
      });
    }

    // Get input device
    let inputDevice = null;
    if (x2.input.type === "fdb") {
      inputDevice = await FDBModel.findOne({ fdbId: x2.input.id });
    } else if (x2.input.type === "ms") {
      inputDevice = await MSModel.findOne({ msId: x2.input.id });
    }

    const topology = {
      x2,
      inputDevice,
      connectedCustomers: x2.outputs?.filter(output => output.type === "customer") || []
    };

    res.status(200).json({
      success: true,
      data: topology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching X2 network topology",
      error: error.message
    });
  }
};

// ==================== CUSTOMER FUNCTIONS ====================

// Create Customer (User with role "user")
export const createCustomer = async (req: Request, res: Response): Promise<any> => {
  try {
    const customerData = req.body;
    
    // Set role to "user" for customers
    customerData.role = "user";
    
    // Handle location array format
    if (Array.isArray(customerData.location)) {
      customerData.lat = customerData.location[0];
      customerData.long = customerData.location[1];
    }

    const customer = new UserModel(customerData);
    const savedCustomer = await customer.save();
    
    res.status(201).json({
      success: true,
      data: savedCustomer
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all Customers (Users with role "user")
export const getAllCustomers = async (req: Request, res: Response): Promise<any> => {
  try {
    const customers = await UserModel.find({ role: "user" });
    res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Customer by ID
export const getCustomerById = async (req: Request, res: Response): Promise<any> => {
  try {
    const customer = await UserModel.findOne({ _id: req.params.id, role: "user" });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }
    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Customer
export const updateCustomer = async (req: Request, res: Response): Promise<any> => {
  try {
    const customerData = req.body;
    
    // Handle location array format
    if (Array.isArray(customerData.location)) {
      customerData.lat = customerData.location[0];
      customerData.long = customerData.location[1];
    }

    const customer = await UserModel.findOneAndUpdate(
      { _id: req.params.id, role: "user" },
      customerData,
      { new: true, runValidators: true }
    );
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Customer
export const deleteCustomer = async (req: Request, res: Response): Promise<any> => {
  try {
    const customer = await UserModel.findOneAndDelete({ _id: req.params.id, role: "user" });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }
    res.status(200).json({
      success: true,
      message: "Customer deleted successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Customer network topology
export const getCustomerNetworkTopology = async (req: Request, res: Response): Promise<any> => {
  try {
    const customer = await UserModel.findOne({ _id: req.params.id, role: "user" });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const topology = {
      customer,
      networkInput: customer.networkInput,
      networkOutputs: customer.networkOutputs
    };

    res.status(200).json({
      success: true,
      data: topology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Search Customers by location
export const searchCustomersByLocation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { latitude, longitude, maxDistance = 10000 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    const customers = await UserModel.findCustomersByLocation(
      parseFloat(latitude as string),
      parseFloat(longitude as string),
      parseInt(maxDistance as string)
    );

    res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Search Customers by status
export const searchCustomersByStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status } = req.params;
    const customers = await UserModel.findCustomersByStatus(status);
    
    res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Search Customers by type
export const searchCustomersByType = async (req: Request, res: Response): Promise<any> => {
  try {
    const { type } = req.params;
    const customers = await UserModel.findCustomersByType(type);
    
    res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== NETWORK TOPOLOGY FUNCTIONS ====================

// Get complete network topology from OLT
export const getCompleteNetworkTopology = async (req: Request, res: Response): Promise<any> => {
  try {
    const { oltId } = req.params;
    
    // Find OLT
    const olt = await OLTModel.findOne({ oltId });
    if (!olt) {
      return res.status(404).json({
        success: false,
        message: "OLT not found"
      });
    }

    // Get all connected devices recursively
    const topology = await buildNetworkTopology(olt);
    
    res.status(200).json({
      success: true,
      data: topology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching complete network topology",
      error: error.message
    });
  }
};

// Get network statistics
export const getNetworkStatistics = async (req: Request, res: Response): Promise<any> => {
  try {
    const stats = {
      totalOLTs: await OLTModel.countDocuments(),
      totalMS: await MSModel.countDocuments(),
      totalSUBMS: await SUBMSModel.countDocuments(),
      totalFDB: await FDBModel.countDocuments(),
      totalX2: await X2Model.countDocuments(),
      totalCustomers: await UserModel.countDocuments({ role: "user" }),
      activeOLTs: await OLTModel.countDocuments({ status: "active" }),
      activeMS: await MSModel.countDocuments({ status: "active" }),
      activeSUBMS: await SUBMSModel.countDocuments({ status: "active" }),
      activeFDB: await FDBModel.countDocuments({ status: "active" }),
      activeX2: await X2Model.countDocuments({ status: "active" }),
      activeCustomers: await UserModel.countDocuments({ role: "user", status: "active" })
    };
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching network statistics",
      error: error.message
    });
  }
};

// Helper function to build network topology
async function buildNetworkTopology(olt: any) {
  const topology: any = {
    olt,
    connectedDevices: {
      ms: [],
      fdb: []
    }
  };

  // Get connected MS devices
  const msDevices = await MSModel.find({
    "input.type": "olt",
    "input.id": olt.oltId
  });

  for (const ms of msDevices) {
    const msTopology: any = {
      ms,
      connectedDevices: {
        subms: [],
        fdb: []
      }
    };

    // Get connected SUBMS devices
    const submsDevices = await SUBMSModel.find({
      "input.type": "ms",
      "input.id": ms.msId
    });
    msTopology.connectedDevices.subms = submsDevices;

    // Get connected FDB devices
    const fdbDevices = await FDBModel.find({
      "input.type": "ms",
      "input.id": ms.msId
    });

    for (const fdb of fdbDevices) {
      const fdbTopology: any = {
        fdb,
        connectedDevices: {
          x2: []
        }
      };

      // Get connected X2 devices
      const x2Devices = await X2Model.find({
        "input.type": "fdb",
        "input.id": fdb.fdbId
      });
      fdbTopology.connectedDevices.x2 = x2Devices;

      // Get connected customers for each X2
      for (const x2 of x2Devices) {
        const customers = await UserModel.find({
          role: "user",
          "networkInput.type": "x2",
          "networkInput.id": x2.x2Id
        });
        if (customers.length > 0) {
          fdbTopology.connectedDevices.customers = customers;
        }
      }

      msTopology.connectedDevices.fdb.push(fdbTopology);
    }

    topology.connectedDevices.ms.push(msTopology);
  }

  // Get directly connected FDB devices
  const directFDB = await FDBModel.find({
    "input.type": "olt",
    "input.id": olt.oltId
  });

  for (const fdb of directFDB) {
    const fdbTopology: any = {
      fdb,
      connectedDevices: {
        x2: []
      }
    };

    // Get connected X2 devices
    const x2Devices = await X2Model.find({
      "input.type": "fdb",
      "input.id": fdb.fdbId
    });
    fdbTopology.connectedDevices.x2 = x2Devices;

    // Get connected customers for each X2
    for (const x2 of x2Devices) {
      const customers = await UserModel.find({
        role: "user",
        "networkInput.type": "x2",
        "networkInput.id": x2.x2Id
      });
      if (customers.length > 0) {
        fdbTopology.connectedDevices.customers = customers;
      }
    }

    topology.connectedDevices.fdb.push(fdbTopology);
  }

  return topology;
}

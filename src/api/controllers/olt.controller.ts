import { Request, Response } from "express";
import { OLTModel } from "../models/olt.model";
import { MSModel } from "../models/ms.model";
import { SUBMSModel } from "../models/subms.model";
import { FDBModel } from "../models/fdb.model";
import { X2Model } from "../models/x2.model";
import { 
  calculateTopology, 
  validateTopology, 
  generateRecommendations, 
  createTopologyDiagram, 
  getSplitterLoss,
  TOPOLOGY_RULES, 
  TopologyType 
} from "../services/topology.service";
import { UserModel } from "../models/user.model";

// ==================== OLT FUNCTIONS ====================

// Create OLT
export const createOLT = async (req: Request, res: Response): Promise<any> => {
  try {
    const oltData = req.body;

    console.log(req.body);
    
    // Handle uploaded images
    if (req.files && Array.isArray(req.files)) {
      if (req.files.length < 4) {
        return res.status(400).json({
          success: false,
          message: "At least 4 images are required for OLT"
        });
      }
      
      // Convert uploaded files to attachment URLs
      const attachments = req.files ? (req.files as Express.Multer.File[]).map(f => `/view/image/${f.filename}`) : [];
      
      oltData.attachments = attachments;
    } else {
      return res.status(400).json({
        success: false,
        message: "Images are required for OLT creation"
      });
    }
    
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

// ==================== OLT SEARCH FUNCTIONS ====================

// Search OLTs by Serial Number
export const searchOLTsBySerialNumber = async (req: Request, res: Response): Promise<any> => {
  try {
    const { serialNumber } = req.params;
    
    if (!serialNumber) {
      return res.status(400).json({
        success: false,
        message: "Serial number is required"
      });
    }

    const olts = await OLTModel.find({
      serialNumber: { $regex: serialNumber, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      serialNumber,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by serial number",
      error: error.message
    });
  }
};

// Search OLTs by Name
export const searchOLTsByName = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    const olts = await OLTModel.find({
      name: { $regex: name, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      name,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by name",
      error: error.message
    });
  }
};

// Search OLTs by OLT ID
export const searchOLTsByOLTId = async (req: Request, res: Response): Promise<any> => {
  try {
    const { oltId } = req.params;
    
    if (!oltId) {
      return res.status(400).json({
        success: false,
        message: "OLT ID is required"
      });
    }

    const olts = await OLTModel.find({
      oltId: { $regex: oltId, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      oltId,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by OLT ID",
      error: error.message
    });
  }
};

// Search OLTs by IP Address
export const searchOLTsByIP = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ip } = req.params;
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        message: "IP address is required"
      });
    }

    const olts = await OLTModel.find({
      oltIp: { $regex: ip, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      ip,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by IP address",
      error: error.message
    });
  }
};

// Search OLTs by MAC Address
export const searchOLTsByMAC = async (req: Request, res: Response): Promise<any> => {
  try {
    const { mac } = req.params;
    
    if (!mac) {
      return res.status(400).json({
        success: false,
        message: "MAC address is required"
      });
    }

    const olts = await OLTModel.find({
      macAddress: { $regex: mac, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      mac,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by MAC address",
      error: error.message
    });
  }
};

// Search OLTs by Manufacturer
export const searchOLTsByManufacturer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { manufacturer } = req.params;
    
    if (!manufacturer) {
      return res.status(400).json({
        success: false,
        message: "Manufacturer is required"
      });
    }

    const olts = await OLTModel.find({
      manufacturer: { $regex: manufacturer, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      manufacturer,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by manufacturer",
      error: error.message
    });
  }
};

// Search OLTs by Model
export const searchOLTsByModel = async (req: Request, res: Response): Promise<any> => {
  try {
    const { model } = req.params;
    
    if (!model) {
      return res.status(400).json({
        success: false,
        message: "Model is required"
      });
    }

    const olts = await OLTModel.find({
      oltModel: { $regex: model, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      model,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by model",
      error: error.message
    });
  }
};

// Search OLTs by Status
export const searchOLTsByStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status } = req.params;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const olts = await OLTModel.find({
      status: { $regex: status, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      status,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by status",
      error: error.message
    });
  }
};

// Search OLTs by Power Status
export const searchOLTsByPowerStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { powerStatus } = req.params;
    
    if (!powerStatus) {
      return res.status(400).json({
        success: false,
        message: "Power status is required"
      });
    }

    const olts = await OLTModel.find({
      powerStatus: { $regex: powerStatus, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      powerStatus,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by power status",
      error: error.message
    });
  }
};

// Search OLTs by City
export const searchOLTsByCity = async (req: Request, res: Response): Promise<any> => {
  try {
    const { city } = req.params;
    
    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required"
      });
    }

    const olts = await OLTModel.find({
      city: { $regex: city, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      city,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by city",
      error: error.message
    });
  }
};

// Search OLTs by State
export const searchOLTsByState = async (req: Request, res: Response): Promise<any> => {
  try {
    const { state } = req.params;
    
    if (!state) {
      return res.status(400).json({
        success: false,
        message: "State is required"
      });
    }

    const olts = await OLTModel.find({
      state: { $regex: state, $options: 'i' }
    }).populate('ownedBy', 'name email company');

    res.status(200).json({
      success: true,
      count: olts.length,
      state,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by state",
      error: error.message
    });
  }
};

// Advanced Search OLTs with multiple criteria
export const advancedSearchOLTs = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      name,
      serialNumber,
      oltId,
      oltIp,
      macAddress,
      manufacturer,
      oltModel,
      status,
      powerStatus,
      city,
      state,
      country,
      oltType,
      ownedBy,
      assignedEngineer,
      assignedCompany,
      minPorts,
      maxPorts,
      minTemperature,
      maxTemperature,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build search filter
    const filter: any = {};

    // Text-based searches with regex
    if (name) filter.name = { $regex: name, $options: 'i' };
    if (serialNumber) filter.serialNumber = { $regex: serialNumber, $options: 'i' };
    if (oltId) filter.oltId = { $regex: oltId, $options: 'i' };
    if (oltIp) filter.oltIp = { $regex: oltIp, $options: 'i' };
    if (macAddress) filter.macAddress = { $regex: macAddress, $options: 'i' };
    if (manufacturer) filter.manufacturer = { $regex: manufacturer, $options: 'i' };
    if (oltModel) filter.oltModel = { $regex: oltModel, $options: 'i' };
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (state) filter.state = { $regex: state, $options: 'i' };
    if (country) filter.country = { $regex: country, $options: 'i' };

    // Exact matches
    if (status) filter.status = status;
    if (powerStatus) filter.powerStatus = powerStatus;
    if (oltType) filter.oltType = oltType;
    if (ownedBy) filter.ownedBy = ownedBy;
    if (assignedEngineer) filter.assignedEngineer = assignedEngineer;
    if (assignedCompany) filter.assignedCompany = assignedCompany;

    // Range searches
    if (minPorts || maxPorts) {
      filter.totalPorts = {};
      if (minPorts) filter.totalPorts.$gte = parseInt(minPorts as string);
      if (maxPorts) filter.totalPorts.$lte = parseInt(maxPorts as string);
    }

    if (minTemperature || maxTemperature) {
      filter.temperature = {};
      if (minTemperature) filter.temperature.$gte = parseInt(minTemperature as string);
      if (maxTemperature) filter.temperature.$lte = parseInt(maxTemperature as string);
    }

    // Pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Execute search
    const [olts, total] = await Promise.all([
      OLTModel.find(filter)
        .populate('ownedBy', 'name email company')
        .populate('assignedEngineer', 'name email')
        .populate('assignedCompany', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit as string)),
      OLTModel.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: olts.length,
      total,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string))
      },
      filters: req.query,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error performing advanced search",
      error: error.message
    });
  }
};

// Get OLT Statistics
export const getOLTStatistics = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ownedBy } = req.query;
    
    const filter: any = {};
    if (ownedBy) filter.ownedBy = ownedBy;

    const [
      totalOLTs,
      activeOLTs,
      inactiveOLTs,
      maintenanceOLTs,
      offlineOLTs,
      errorOLTs,
      onPowerOLTs,
      offPowerOLTs,
      standbyPowerOLTs,
      gponOLTs,
      eponOLTs,
      xgsponOLTs,
      xgponOLTs,
      otherTypeOLTs
    ] = await Promise.all([
      OLTModel.countDocuments(filter),
      OLTModel.countDocuments({ ...filter, status: 'active' }),
      OLTModel.countDocuments({ ...filter, status: 'inactive' }),
      OLTModel.countDocuments({ ...filter, status: 'maintenance' }),
      OLTModel.countDocuments({ ...filter, status: 'offline' }),
      OLTModel.countDocuments({ ...filter, status: 'error' }),
      OLTModel.countDocuments({ ...filter, powerStatus: 'on' }),
      OLTModel.countDocuments({ ...filter, powerStatus: 'off' }),
      OLTModel.countDocuments({ ...filter, powerStatus: 'standby' }),
      OLTModel.countDocuments({ ...filter, oltType: 'gpon' }),
      OLTModel.countDocuments({ ...filter, oltType: 'epon' }),
      OLTModel.countDocuments({ ...filter, oltType: 'xgspon' }),
      OLTModel.countDocuments({ ...filter, oltType: 'xgpon' }),
      OLTModel.countDocuments({ ...filter, oltType: 'other' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalOLTs,
        byStatus: {
          active: activeOLTs,
          inactive: inactiveOLTs,
          maintenance: maintenanceOLTs,
          offline: offlineOLTs,
          error: errorOLTs
        },
        byPowerStatus: {
          on: onPowerOLTs,
          off: offPowerOLTs,
          standby: standbyPowerOLTs
        },
        byType: {
          gpon: gponOLTs,
          epon: eponOLTs,
          xgspon: xgsponOLTs,
          xgpon: xgponOLTs,
          other: otherTypeOLTs
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching OLT statistics",
      error: error.message
    });
  }
};

// ==================== MS FUNCTIONS ====================

// Create MS
export const createMS = async (req: Request, res: Response): Promise<any> => {
  try {
    const msData = req.body;
    
    // Handle uploaded images
    if (req.files && Array.isArray(req.files)) {
      if (req.files.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 images are required for MS"
        });
      }
      
      // Convert uploaded files to attachment URLs
      const attachments = req.files ? (req.files as Express.Multer.File[]).map(f => `/view/image/${f.filename}`) : [];
      
      msData.attachments = attachments;
    } else {
      return res.status(400).json({
        success: false,
        message: "Images are required for MS creation"
      });
    }
    
    // Handle nested input object from FormData
    if (req.body.inputType && req.body.inputId) {
      msData.input = {
        type: req.body.inputType,
        id: req.body.inputId,
        port: req.body.inputPort ? parseInt(req.body.inputPort) : undefined
      };
    }
    
    // Validate required fields
    if (!msData.msName || !msData.msType || !msData.ownedBy) {
      return res.status(400).json({
        success: false,
        message: "msName, msType, and ownedBy are required fields"
      });
    }
    
    // Validate input connection
    if (!msData.input || !msData.input.type || !msData.input.id) {
      return res.status(400).json({
        success: false,
        message: "Input connection with type and id is required"
      });
    }
    
    
    // Extract location array if provided
    if (msData.location && Array.isArray(msData.location)) {
      msData.latitude = msData.location[0];
      msData.longitude = msData.location[1];
      delete msData.location;
    }
    
    // Ensure outputs is an aqqrray
    if (!msData.outputs) {
      msData.outputs = [];
    }
    
    // Set default values if not provided
    if (!msData.addedBy) {
      msData.addedBy = msData.ownedBy;
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
    
    // Handle uploaded images
    if (req.files && Array.isArray(req.files)) {
      if (req.files.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 images are required for SUBMS"
        });
      }
      
      // Convert uploaded files to attachment URLs
      const attachments = req.files ? (req.files as Express.Multer.File[]).map(f => `/view/image/${f.filename}`) : [];
      
      submsData.attachments = attachments;
    } else {
      return res.status(400).json({
        success: false,
        message: "Images are required for SUBMS creation"
      });
    }
    
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
    
    // Handle uploaded images
    if (req.files && Array.isArray(req.files)) {
      if (req.files.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 images are required for FDB"
        });
      }
      
      // Convert uploaded files to attachment URLs
      const attachments = req.files ? (req.files as Express.Multer.File[]).map(f => `/view/image/${f.filename}`) : [];
      
      fdbData.attachments = attachments;
    } else {
      return res.status(400).json({
        success: false,
        message: "Images are required for FDB creation"
      });
    }
    
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
    
    // Handle uploaded images
    if (req.files && Array.isArray(req.files)) {
      if (req.files.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 images are required for X2"
        });
      }
      
      // Convert uploaded files to attachment URLs
      const attachments = req.files ? (req.files as Express.Multer.File[]).map(f => `/view/image/${f.filename}`) : [];
      
      x2Data.attachments = attachments;
    } else {
      return res.status(400).json({
        success: false,
        message: "Images are required for X2 creation"
      });
    }
    
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

// ==================== CUSTOMER MANAGEMENT FUNCTIONS ====================



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

// ==================== NETWORK ATTACHMENT FUNCTIONS ====================

// Attach customer to network component (X2, FDB, SUBMS)
export const attachCustomerToNetwork = async (req: Request, res: Response): Promise<any> => {
  try {
    const { customerId, networkComponentType, networkComponentId } = req.body;
    
    if (!customerId || !networkComponentType || !networkComponentId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID, network component type, and network component ID are required"
      });
    }

    // Validate network component type
    const validTypes = ["x2", "fdb", "subms"];
    if (!validTypes.includes(networkComponentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid network component type. Use: x2, fdb, or subms"
      });
    }

    // Check if customer exists
    const customer = await UserModel.findOne({ _id: customerId, role: "user" });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Check if network component exists
    let networkComponent;
    switch (networkComponentType) {
      case "x2":
        networkComponent = await X2Model.findById(networkComponentId);
        break;
      case "fdb":
        networkComponent = await FDBModel.findById(networkComponentId);
        break;
      case "subms":
        networkComponent = await SUBMSModel.findById(networkComponentId);
        break;
    }

    if (!networkComponent) {
      return res.status(404).json({
        success: false,
        message: `${networkComponentType.toUpperCase()} component not found`
      });
    }

    // Update customer's network input
    const updatedCustomer = await UserModel.findByIdAndUpdate(
      customerId,
      {
        networkInput: {
          type: networkComponentType,
          id: networkComponentId
        }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: `Customer attached to ${networkComponentType.toUpperCase()} successfully`,
      data: updatedCustomer
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error attaching customer to network",
      error: error.message
    });
  }
};

// Detach customer from network
export const detachCustomerFromNetwork = async (req: Request, res: Response): Promise<any> => {
  try {
    const { customerId } = req.params;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required"
      });
    }

    // Check if customer exists
    const customer = await UserModel.findOne({ _id: customerId, role: "user" });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Remove network input
    const updatedCustomer = await UserModel.findByIdAndUpdate(
      customerId,
      {
        $unset: { networkInput: 1 }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Customer detached from network successfully",
      data: updatedCustomer
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error detaching customer from network",
      error: error.message
    });
  }
};

// Get all customers connected to a specific network component
export const getCustomersByNetworkComponent = async (req: Request, res: Response): Promise<any> => {
  try {
    const { componentType, componentId } = req.params;
    
    if (!componentType || !componentId) {
      return res.status(400).json({
        success: false,
        message: "Component type and component ID are required"
      });
    }

    // Validate component type
    const validTypes = ["x2", "fdb", "subms"];
    if (!validTypes.includes(componentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid component type. Use: x2, fdb, or subms"
      });
    }

    // Find customers connected to this component
    const customers = await UserModel.find({
      role: "user",
      "networkInput.type": componentType,
      "networkInput.id": componentId
    });

    res.status(200).json({
      success: true,
      count: customers.length,
      componentType,
      componentId,
      data: customers
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching customers by network component",
      error: error.message
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

// ==================== COMPANY-BASED QUERIES ====================

// Get all OLTs by Company ID
export const getOLTsByCompany = async (req: Request, res: Response): Promise<any> => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required"
      });
    }

    const olts = await OLTModel.find({ ownedBy: companyId })
      .populate('ownedBy', 'name email company')
      .populate('assignedEngineer', 'name email')
      .populate('assignedCompany', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: olts.length,
      companyId,
      data: olts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching OLTs by company",
      error: error.message
    });
  }
};

// Get all FDBs by Company ID
export const getFDBsByCompany = async (req: Request, res: Response): Promise<any> => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required"
      });
    }

    const fdbs = await FDBModel.find({ ownedBy: companyId })
      .populate('ownedBy', 'name email company')
      .populate('assignedEngineer', 'name email')
      .populate('assignedCompany', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: fdbs.length,
      companyId,
      data: fdbs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching FDBs by company",
      error: error.message
    });
  }
};

// Get all MS devices by Company ID
export const getMSByCompany = async (req: Request, res: Response): Promise<any> => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required"
      });
    }

    const msDevices = await MSModel.find({ ownedBy: companyId })
      .populate('ownedBy', 'name email company')
      .populate('assignedEngineer', 'name email')
      .populate('assignedCompany', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: msDevices.length,
      companyId,
      data: msDevices
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching MS devices by company",
      error: error.message
    });
  }
};

// Get all SUBMS devices by Company ID
export const getSUBMSByCompany = async (req: Request, res: Response): Promise<any> => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required"
      });
    }

    const submsDevices = await SUBMSModel.find({ ownedBy: companyId })
      .populate('ownedBy', 'name email company')
      .populate('assignedEngineer', 'name email')
      .populate('assignedCompany', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: submsDevices.length,
      companyId,
      data: submsDevices
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching SUBMS devices by company",
      error: error.message
    });
  }
};

// Get all X2 devices by Company ID
export const getX2ByCompany = async (req: Request, res: Response): Promise<any> => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required"
      });
    }

    const x2Devices = await X2Model.find({ ownedBy: companyId })
      .populate('ownedBy', 'name email company')
      .populate('assignedEngineer', 'name email')
      .populate('assignedCompany', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: x2Devices.length,
      companyId,
      data: x2Devices
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching X2 devices by company",
      error: error.message
    });
  }
};

// Get all network components by Company ID (summary)
export const getAllNetworkComponentsByCompany = async (req: Request, res: Response): Promise<any> => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required"
      });
    }

    const [olts, fdbs, ms, subms, x2] = await Promise.all([
      OLTModel.find({ ownedBy: companyId }).countDocuments(),
      FDBModel.find({ ownedBy: companyId }).countDocuments(),
      MSModel.find({ ownedBy: companyId }).countDocuments(),
      SUBMSModel.find({ ownedBy: companyId }).countDocuments(),
      X2Model.find({ ownedBy: companyId }).countDocuments()
    ]);

    res.status(200).json({
      success: true,
      companyId,
      summary: {
        totalDevices: olts + fdbs + ms + subms + x2,
        olts: { count: olts },
        fdbs: { count: fdbs },
        ms: { count: ms },
        subms: { count: subms },
        x2: { count: x2 }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching network components summary by company",
      error: error.message
    });
  }
};

// Get all network components by Company ID (detailed)
export const getDetailedNetworkComponentsByCompany = async (req: Request, res: Response): Promise<any> => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 50, type } = req.query;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required"
      });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const companyFilter = { ownedBy: companyId };

    let result: any = {};

    if (!type || type === 'all') {
      // Get all types with pagination
      const [olts, fdbs, ms, subms, x2] = await Promise.all([
        OLTModel.find(companyFilter)
          .populate('ownedBy', 'name email company')
          .populate('assignedEngineer', 'name email')
          .populate('assignedCompany', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        FDBModel.find(companyFilter)
          .populate('ownedBy', 'name email company')
          .populate('assignedEngineer', 'name email')
          .populate('assignedCompany', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        MSModel.find(companyFilter)
          .populate('ownedBy', 'name email company')
          .populate('assignedEngineer', 'name email')
          .populate('assignedCompany', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        SUBMSModel.find(companyFilter)
          .populate('ownedBy', 'name email company')
          .populate('assignedEngineer', 'name email')
          .populate('assignedCompany', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        X2Model.find(companyFilter)
          .populate('ownedBy', 'name email company')
          .populate('assignedEngineer', 'name email')
          .populate('assignedCompany', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit as string))
      ]);

      result = {
        olts: { count: olts.length, data: olts },
        fdbs: { count: fdbs.length, data: fdbs },
        ms: { count: ms.length, data: ms },
        subms: { count: subms.length, data: subms },
        x2: { count: x2.length, data: x2 }
      };
    } else {
      // Get specific type with pagination
      let model: any;
      let typeName: string;

      switch (type) {
        case 'olt':
          model = OLTModel;
          typeName = 'OLTs';
          break;
        case 'fdb':
          model = FDBModel;
          typeName = 'FDBs';
          break;
        case 'ms':
          model = MSModel;
          typeName = 'MS devices';
          break;
        case 'subms':
          model = SUBMSModel;
          typeName = 'SUBMS devices';
          break;
        case 'x2':
          model = X2Model;
          typeName = 'X2 devices';
          break;
        default:
          return res.status(400).json({
            success: false,
            message: "Invalid type. Use: olt, fdb, ms, subms, x2, or all"
          });
      }

      const devices = await model.find(companyFilter)
        .populate('ownedBy', 'name email company')
        .populate('assignedEngineer', 'name email')
        .populate('assignedCompany', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));

      result = {
        type,
        typeName,
        count: devices.length,
        data: devices
      };
    }

    res.status(200).json({
      success: true,
      companyId,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        skip
      },
      ...result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching detailed network components by company",
      error: error.message
    });
  }
};

// ==================== TOPOLOGY PLANNING FUNCTIONS ====================

// Plan topology based on subscriber count and OLT type
export const planTopology = async (req: Request, res: Response): Promise<any> => {
  try {
    const { subscriberCount, oltType } = req.body;
    
    if (!subscriberCount || !oltType) {
      return res.status(400).json({
        success: false,
        message: "Subscriber count and OLT type are required"
      });
    }

    if (subscriberCount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Subscriber count must be greater than 0"
      });
    }

    // Calculate topology using EXACT rules
    const topology = calculateTopology(subscriberCount, oltType);
    
    // Validate topology
    const validation = validateTopology(topology);
    
    // Generate recommendations
    const recommendations = generateRecommendations(subscriberCount, oltType);
    
    // Create topology diagram
    const diagram = createTopologyDiagram(topology);

    res.status(200).json({
      success: true,
      data: {
        topology,
        validation,
        recommendations,
        diagram,
        rules: TOPOLOGY_RULES
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error planning topology",
      error: error.message
    });
  }
};

// Get topology rules and constants
export const getTopologyRules = async (req: Request, res: Response): Promise<any> => {
  try {
    res.status(200).json({
      success: true,
      data: {
        rules: TOPOLOGY_RULES,
        description: "Exact topology rules for splitter losses, PON capacity, and tube system"
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching topology rules",
      error: error.message
    });
  }
};

// Validate existing topology
export const validateExistingTopology = async (req: Request, res: Response): Promise<any> => {
  try {
    const { oltId } = req.params;
    
    if (!oltId) {
      return res.status(400).json({
        success: false,
        message: "OLT ID is required"
      });
    }

    const olt = await OLTModel.findById(oltId)
      .populate('outputs.id')
      .populate('ownedBy', 'name email company');

    if (!olt) {
      return res.status(404).json({
        success: false,
        message: "OLT not found"
      });
    }

    // Analyze existing topology
    const topologyAnalysis = await analyzeExistingTopology(olt);
    
    res.status(200).json({
      success: true,
      data: {
        olt,
        topologyAnalysis
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error validating existing topology",
      error: error.message
    });
  }
};

// Analyze existing topology for compliance with rules
async function analyzeExistingTopology(olt: any) {
  const analysis: {
    totalLoss: number;
    stages: Array<{
      stage: number;
      deviceType: string;
      deviceId: any;
      splitterType: string;
      loss: number;
      cumulativeLoss: number;
    }>;
    compliance: {
      isValid: boolean;
      errors: string[];
      warnings: string[];
    };
    recommendations: string[];
  } = {
    totalLoss: 0,
    stages: [],
    compliance: {
      isValid: true,
      errors: [],
      warnings: []
    },
    recommendations: []
  };

  try {
    // Calculate total loss from existing devices
    let currentLoss = 0;
    let stageCount = 0;

    // Check outputs and calculate losses
    if (olt.outputs && olt.outputs.length > 0) {
      for (const output of olt.outputs) {
        if (output.type === 'ms') {
          const ms = await MSModel.findById(output.id);
          if (ms) {
            const loss = getSplitterLoss(ms.msType);
            currentLoss += loss;
            stageCount++;
            
            analysis.stages.push({
              stage: stageCount,
              deviceType: 'ms',
              deviceId: ms._id,
              splitterType: ms.msType,
              loss: loss,
              cumulativeLoss: currentLoss
            });
          }
        } else if (output.type === 'subms') {
          const subms = await SUBMSModel.findById(output.id);
          if (subms) {
            const loss = getSplitterLoss(subms.submsType);
            currentLoss += loss;
            stageCount++;
            
            analysis.stages.push({
              stage: stageCount,
              deviceType: 'subms',
              deviceId: subms._id,
              splitterType: subms.submsType,
              loss: loss,
              cumulativeLoss: currentLoss
            });
          }
        }
      }
    }

    analysis.totalLoss = currentLoss;

    // Check compliance with rules
    if (currentLoss > TOPOLOGY_RULES.MAX_PASSIVE_LOSS) {
      analysis.compliance.isValid = false;
      analysis.compliance.errors.push(`Total loss ${currentLoss} dB exceeds maximum allowed ${TOPOLOGY_RULES.MAX_PASSIVE_LOSS} dB`);
    }

    if (currentLoss === TOPOLOGY_RULES.MAX_PASSIVE_LOSS) {
      analysis.compliance.warnings.push('Total loss is at maximum limit (20 dB). No further passive elements can be added.');
    }

    // Generate recommendations
    if (currentLoss < TOPOLOGY_RULES.MAX_PASSIVE_LOSS) {
      const remainingLoss = TOPOLOGY_RULES.MAX_PASSIVE_LOSS - currentLoss;
      analysis.recommendations.push(`Can add more passive elements. Remaining loss budget: ${remainingLoss} dB`);
    } else {
      analysis.recommendations.push('Cannot add more passive elements. Loss limit reached.');
    }

    // Check topology type compliance
    if (stageCount === 0) {
      analysis.recommendations.push('Direct topology - no passive elements');
    } else if (stageCount === 2 && 
               analysis.stages[0]?.splitterType === '1x16' && 
               analysis.stages[1]?.splitterType === '1x4') {
      analysis.recommendations.push('Tube system topology detected - compliant with rules');
    } else {
      analysis.compliance.warnings.push('Topology does not follow standard tube system pattern');
    }

  } catch (error:any) {
    analysis.compliance.errors.push(`Error analyzing topology: ${error.message}`);
    analysis.compliance.isValid = false;
  }

  return analysis;
}

// Get topology examples for different scenarios
export const getTopologyExamples = async (req: Request, res: Response): Promise<any> => {
  try {
    const examples = [
      {
        scenario: "Small Network (< 12 subscribers)",
        subscriberCount: 8,
        oltType: "gpon",
        topology: calculateTopology(8, "gpon"),
        description: "Direct connection - no passive elements needed"
      },
      {
        scenario: "Medium Network (12-64 subscribers)",
        subscriberCount: 24,
        oltType: "gpon",
        topology: calculateTopology(24, "gpon"),
        description: "Tube system: 1×16 → 4×1×4 (total loss: 20 dB)"
      },
      {
        scenario: "Large Network (64 subscribers)",
        subscriberCount: 64,
        oltType: "gpon",
        topology: calculateTopology(64, "gpon"),
        description: "Tube system at capacity - no more passive elements allowed"
      },
      {
        scenario: "EPON Network (64 ONU limit)",
        subscriberCount: 64,
        oltType: "epon",
        topology: calculateTopology(64, "epon"),
        description: "EPON capacity limit reached"
      },
      {
        scenario: "GPON Network (128 ONU limit)",
        subscriberCount: 128,
        oltType: "gpon",
        topology: calculateTopology(128, "gpon"),
        description: "GPON capacity limit reached"
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        examples,
        rules: TOPOLOGY_RULES
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching topology examples",
      error: error.message
    });
  }
};

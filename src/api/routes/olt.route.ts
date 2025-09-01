import { Router, Request, Response } from "express";
import { 
  createOLT,
  getAllOLTs,
  getOLTById,
  updateOLT,
  deleteOLT,
  getOLTNetworkTopology,
  searchOLTsByLocation,
  // OLT Search Functions
  searchOLTsBySerialNumber,
  searchOLTsByName,
  searchOLTsByOLTId,
  searchOLTsByIP,
  searchOLTsByMAC,
  searchOLTsByManufacturer,
  searchOLTsByModel,
  searchOLTsByStatus,
  searchOLTsByPowerStatus,
  searchOLTsByCity,
  searchOLTsByState,
  advancedSearchOLTs,
  getOLTStatistics,
  createMS,
  getAllMS,
  getMSById,
  updateMS,
  deleteMS,
  getMSNetworkTopology,
  createSUBMS,
  getAllSUBMS,
  getSUBMSById,
  updateSUBMS,
  deleteSUBMS,
  createFDB,
  getAllFDB,
  getFDBById,
  updateFDB,
  deleteFDB,
  getFDBNetworkTopology,
  createX2,
  getAllX2,
  getX2ById,
  updateX2,
  deleteX2,
  getX2NetworkTopology,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  getCustomerNetworkTopology,
  searchCustomersByLocation,
  searchCustomersByStatus,
  searchCustomersByType,
  attachCustomerToNetwork,
  detachCustomerFromNetwork,
  getCustomersByNetworkComponent,
  getCompleteNetworkTopology,
  getNetworkStatistics,
  // New company-based functions
  getOLTsByCompany,
  getFDBsByCompany,
  getMSByCompany,
  getSUBMSByCompany,
  getX2ByCompany,
  getAllNetworkComponentsByCompany,
  getDetailedNetworkComponentsByCompany,
  // New topology planning functions
  planTopology,
  getTopologyRules,
  validateExistingTopology,
  getTopologyExamples,
  fdbInput,
  selectNodeAdmin
} from "../controllers/olt.controller";
import { OLTModel } from "../models/olt.model";
import { MSModel } from "../models/ms.model";
import { SUBMSModel } from "../models/subms.model";
import { FDBModel } from "../models/fdb.model";
import { X2Model } from "../models/x2.model";
import { UserModel } from "../models/user.model";
import { upload } from '../services/upload.service';
import authenticate from "../../middleware/auth.middleware";

const router = Router();

// ==================== OLT ROUTES ====================

// Create OLT with image uploads (minimum 4 images required)
router.post("/olt", upload.array('images', 10), createOLT);

// Get all OLTs
router.get("/olt", getAllOLTs);

// Get OLT by ID
router.get("/olt/:id", getOLTById);

// Update OLT
router.put("/olt/:id", updateOLT);

// Delete OLT
router.delete("/olt/:id", deleteOLT);

// Get OLT network topology
router.get("/olt/:id/topology", getOLTNetworkTopology);

// Search OLTs by location
router.get("/olt/search/location", searchOLTsByLocation);

// ==================== OLT SEARCH ROUTES ====================

// Individual Search Routes
router.get("/olt/search/serial/:serialNumber", searchOLTsBySerialNumber);
router.get("/olt/search/name/:name", searchOLTsByName);
router.get("/olt/search/id/:oltId", searchOLTsByOLTId);
router.get("/olt/search/ip/:ip", searchOLTsByIP);
router.get("/olt/search/mac/:mac", searchOLTsByMAC);
router.get("/olt/search/manufacturer/:manufacturer", searchOLTsByManufacturer);
router.get("/olt/search/model/:model", searchOLTsByModel);
router.get("/olt/search/status/:status", searchOLTsByStatus);
router.get("/olt/search/power/:powerStatus", searchOLTsByPowerStatus);
router.get("/olt/search/city/:city", searchOLTsByCity);
router.get("/olt/search/state/:state", searchOLTsByState);

// Advanced Search and Statistics
router.get("/olt/search/advanced", advancedSearchOLTs);
router.get("/olt/statistics", getOLTStatistics);

// ==================== MS ROUTES ====================

// Create MS with image uploads (minimum 2 images required)
router.post("/ms", upload.array('images', 10), createMS);

// Get all MS devices
router.get("/ms", getAllMS);

// Get MS by ID
router.get("/ms/:id", getMSById);

// Update MS
router.put("/ms/:id", updateMS);

// Delete MS
router.delete("/ms/:id", deleteMS);

// Get MS network topology
router.get("/ms/:id/topology", getMSNetworkTopology);

// ==================== SUBMS ROUTES ====================

// Create SUBMS with image uploads (minimum 2 images required)
router.post("/subms", upload.array('images', 10), createSUBMS);

// Get all SUBMS devices
router.get("/subms", getAllSUBMS);

// Get SUBMS by ID
router.get("/subms/:id", getSUBMSById);

// Update SUBMS
router.put("/subms/:id", updateSUBMS);

// Delete SUBMS
router.delete("/subms/:id", deleteSUBMS);

// ==================== FDB ROUTES ====================

// Create FDB with image uploads (minimum 2 images required)
router.post("/fdb", upload.array('images', 10), createFDB);

// Get all FDB devices
router.get("/fdb", getAllFDB);

// Get FDB by ID
router.get("/fdb/:id", getFDBById);

// Update FDB
router.put("/fdb/:id", updateFDB);

// Delete FDB
router.delete("/fdb/:id", deleteFDB);

// Get FDB network topology
router.get("/fdb/:id/topology", getFDBNetworkTopology);

// ==================== X2 ROUTES ====================

// Create X2 with image uploads (minimum 2 images required)
router.post("/x2", upload.array('images', 10), createX2);

// Get all X2 devices
router.get("/x2", getAllX2);

// Get X2 by ID
router.get("/x2/:id", getX2ById);

// Update X2
router.put("/x2/:id", updateX2);

// Delete X2
router.delete("/x2/:id", deleteX2);

// Get X2 network topology
router.get("/x2/:id/topology", getX2NetworkTopology);

// ==================== CUSTOMER MANAGEMENT ROUTES ====================

// Get all Customers
router.get("/customer", getAllCustomers);

// Get Customer by ID
router.get("/customer/:id", getCustomerById);

// Update Customer
router.put("/customer/:id", updateCustomer);

// Get Customer network topology
router.get("/customer/:id/topology", getCustomerNetworkTopology);

// Search Customers by location
router.get("/customer/search/location", searchCustomersByLocation);

// Search Customers by status
router.get("/customer/status/:status", searchCustomersByStatus);

// Search Customers by type
router.get("/customer/type/:type", searchCustomersByType);

// ==================== NETWORK ATTACHMENT ROUTES ====================

// Attach customer to network component
router.post("/customer/attach", attachCustomerToNetwork);

// Detach customer from network
router.delete("/customer/:customerId/detach", detachCustomerFromNetwork);

// Get customers by network component
router.get("/network/:componentType/:componentId/customers", getCustomersByNetworkComponent);

// ==================== NETWORK TOPOLOGY ROUTES ====================

// Get complete network topology from OLT
router.get("/network/topology/:oltId", getCompleteNetworkTopology);

// Get network statistics
router.get("/network/statistics", getNetworkStatistics);

// ==================== BULK OPERATIONS ====================

// Bulk create OLTsd
router.post("/olt/bulk", async (req, res): Promise<any> => {
  try {
    const { olts } = req.body;
    
    if (!Array.isArray(olts)) {
      return res.status(400).json({
        success: false,
        message: "OLTs must be an array"
      });
    }

    const createdOLTs = [];
    for (const oltData of olts) {
      // Extract location array if provided
      if (oltData.location && Array.isArray(oltData.location)) {
        oltData.latitude = oltData.location[0];
        oltData.longitude = oltData.location[1];
        delete oltData.location;
      }
      
      const olt = new OLTModel(oltData);
      const savedOLT = await olt.save();
      createdOLTs.push(savedOLT);
    }

    res.status(201).json({
      success: true,
      message: `${createdOLTs.length} OLTs created successfully`,
      count: createdOLTs.length,
      data: createdOLTs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating OLTs in bulk",
      error: error.message
    });
  }
});

// Bulk create MS devices
router.post("/ms/bulk", async (req, res): Promise<any> => {
  try {
    const { mss } = req.body;
    
    if (!Array.isArray(mss)) {
      return res.status(400).json({
        success: false,
        message: "MS devices must be an array"
      });
    }

    const createdMS = [];
    for (const msData of mss) {
      // Extract location array if provided
      if (msData.location && Array.isArray(msData.location)) {
        msData.latitude = msData.location[0];
        msData.longitude = msData.location[1];
        delete msData.location;
      }
      
      const ms = new MSModel(msData);
      const savedMS = await ms.save();
      createdMS.push(savedMS);
    }

    res.status(201).json({
      success: true,
      message: `${createdMS.length} MS devices created successfully`,
      count: createdMS.length,
      data: createdMS
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating MS devices in bulk",
      error: error.message
    });
  }
});

// Bulk create SUBMS devices
router.post("/subms/bulk", async (req, res): Promise<any> => {
  try {
    const { subms } = req.body;
    
    if (!Array.isArray(subms)) {
      return res.status(400).json({
        success: false,
        message: "SUBMS devices must be an array"
      });
    }

    const createdSUBMS = [];
    for (const submsData of subms) {
      // Extract location array if provided
      if (submsData.location && Array.isArray(submsData.location)) {
        submsData.latitude = submsData.location[0];
        submsData.longitude = submsData.location[1];
        delete submsData.location;
      }
      
      const subms = new SUBMSModel(submsData);
      const savedSUBMS = await subms.save();
      createdSUBMS.push(savedSUBMS);
    }

    res.status(201).json({
      success: true,
      message: `${createdSUBMS.length} SUBMS devices created successfully`,
      count: createdSUBMS.length,
      data: createdSUBMS
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating SUBMS devices in bulk",
      error: error.message
    });
  }
});

// Bulk create FDB devices
router.post("/fdb/bulk", async (req, res): Promise<any> => {
  try {
    const { fdb } = req.body;
    
    if (!Array.isArray(fdb)) {
      return res.status(400).json({
        success: false,
        message: "FDB devices must be an array"
      });
    }

    const createdFDB = [];
    for (const fdbData of fdb) {
      // Extract location array if provided
      if (fdbData.location && Array.isArray(fdbData.location)) {
        fdbData.latitude = fdbData.location[0];
        fdbData.longitude = fdbData.location[1];
        delete fdbData.location;
      }
      
      const fdbDevice = new FDBModel(fdbData);
      const savedFDB = await fdbDevice.save();
      createdFDB.push(savedFDB);
    }

    res.status(201).json({
      success: true,
      message: `${createdFDB.length} FDB devices created successfully`,
      count: createdFDB.length,
      data: createdFDB
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating FDB devices in bulk",
      error: error.message
    });
  }
});

// Bulk create X2 devices
router.post("/x2/bulk", async (req, res): Promise<any> => {
  try {
    const { x2 } = req.body;
    
    if (!Array.isArray(x2)) {
      return res.status(400).json({
        success: false,
        message: "X2 devices must be an array"
      });
    }

    const createdX2 = [];
    for (const x2Data of x2) {
      // Extract location array if provided
      if (x2Data.location && Array.isArray(x2Data.location)) {
        x2Data.latitude = x2Data.location[0];
        x2Data.longitude = x2Data.location[1];
        delete x2Data.location;
      }
      
      const x2Device = new X2Model(x2Data);
      const savedX2 = await x2Device.save();
      createdX2.push(savedX2);
    }

    res.status(201).json({
      success: true,
      message: `${createdX2.length} X2 devices created successfully`,
      count: createdX2.length,
      data: createdX2
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating X2 devices in bulk",
      error: error.message
    });
  }
});

// Bulk create Customers
router.post("/customer/bulk", async (req, res): Promise<any> => {
  try {
    const { customers } = req.body;
    
    if (!Array.isArray(customers)) {
      return res.status(400).json({
        success: false,
        message: "Customers must be an array"
      });
    }

    const createdCustomers = [];
    for (const customerData of customers) {
      // Extract location array if provided
      if (customerData.location && Array.isArray(customerData.location)) {
        customerData.latitude = customerData.location[0];
        customerData.longitude = customerData.location[1];
        delete customerData.location;
      }
      
      const customer = new UserModel(customerData);
      const savedCustomer = await customer.save();
      createdCustomers.push(savedCustomer);
    }

    res.status(201).json({
      success: true,
      message: `${createdCustomers.length} Customers created successfully`,
      count: createdCustomers.length,
      data: createdCustomers
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating Customers in bulk",
      error: error.message
    });
  }
});

// ==================== ADVANCED QUERIES ====================

// Get devices by status
router.get("/devices/status/:status", async (req, res): Promise<any> => {
  try {
    const { status } = req.params;
    
    const [olts, ms, subms, fdb, x2, customers] = await Promise.all([
      OLTModel.find({ status }),
      MSModel.find({ status }),
      SUBMSModel.find({ status }),
      FDBModel.find({ status }),
      X2Model.find({ status }),
      UserModel.find({ role: "user", status })
    ]);

    res.status(200).json({
      success: true,
      data: {
        olts: { count: olts.length, devices: olts },
        ms: { count: ms.length, devices: ms },
        subms: { count: subms.length, devices: subms },
        fdb: { count: fdb.length, devices: fdb },
        x2: { count: x2.length, devices: x2 },
        customers: { count: customers.length, devices: customers }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching devices by status",
      error: error.message
    });
  }
});

// Get devices by location range
router.get("/devices/location-range", async (req, res): Promise<any> => {
  try {
    const { 
      minLat, maxLat, minLng, maxLng 
    } = req.query;

    if (!minLat || !maxLat || !minLng || !maxLng) {
      return res.status(400).json({
        success: false,
        message: "All location bounds are required"
      });
    }

    const locationQuery = {
      latitude: { $gte: parseFloat(minLat as string), $lte: parseFloat(maxLat as string) },
      longitude: { $gte: parseFloat(minLng as string), $lte: parseFloat(maxLng as string) }
    };

    const [olts, ms, subms, fdb, x2, customers] = await Promise.all([
      OLTModel.find(locationQuery),
      MSModel.find(locationQuery),
      SUBMSModel.find(locationQuery),
      FDBModel.find(locationQuery),
      X2Model.find(locationQuery),
      UserModel.find({ role: "user", ...locationQuery })
    ]);

    res.status(200).json({
      success: true,
      data: {
        olts: { count: olts.length, devices: olts },
        ms: { count: ms.length, devices: ms },
        subms: { count: subms.length, devices: subms },
        fdb: { count: fdb.length, devices: fdb },
        x2: { count: x2.length, devices: x2 },
        customers: { count: customers.length, devices: customers }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching devices by location range",
      error: error.message
    });
  }
});

// ==================== COMPANY-BASED ROUTES ====================

// Get all OLTs by Company ID
router.get("/company/:companyId/olt", getOLTsByCompany);

// Get all FDBs by Company ID
router.get("/company/:companyId/fdb", getFDBsByCompany);

// Get all MS devices by Company ID
router.get("/company/:companyId/ms", getMSByCompany);

// Get all SUBMS devices by Company ID
router.get("/company/:companyId/subms", getSUBMSByCompany);

// Get all X2 devices by Company ID
router.get("/company/:companyId/x2", getX2ByCompany);

// Get summary of all network components by Company ID
router.get("/company/:companyId/summary", getAllNetworkComponentsByCompany);

// Get detailed network components by Company ID (with pagination and filtering)
router.get("/company/:companyId/components", getDetailedNetworkComponentsByCompany);

// ==================== TOPOLOGY PLANNING ROUTES ====================

// Plan topology based on subscriber count and OLT type
router.post("/topology/plan", planTopology);

// Get topology rules and constants
router.get("/topology/rules", getTopologyRules);

// Validate existing topology for an OLT
router.get("/topology/validate/:oltId", validateExistingTopology);

// Get topology examples for different scenarios
router.get("/topology/examples", getTopologyExamples);

router.get("/fdb/input/:companyId", fdbInput);

router.get("/olt/select/node", authenticate,selectNodeAdmin);

export default router;

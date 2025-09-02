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

// ==================== UTILITY FUNCTIONS ====================

// Helper function to handle MongoDB duplicate key errors
const handleDuplicateKeyError = (error: any, entityType: string) => {
  const field = Object.keys(error.keyPattern)[0];
  const value = error.keyValue[field];

  let fieldName = field;
  let message = '';

  // Map common field names to user-friendly names
  const fieldNameMap: { [key: string]: string } = {
    oltId: 'OLT ID',
    oltIp: 'IP Address',
    macAddress: 'MAC Address',
    serialNumber: 'Serial Number',
    msId: 'MS ID',
    msName: 'MS Name',
    submsId: 'SUBMS ID',
    submsName: 'SUBMS Name',
    fdbId: 'FDB ID',
    fdbName: 'FDB Name',
    x2Id: 'X2 ID',
    x2Name: 'X2 Name'
  };

  fieldName = fieldNameMap[field] || field.charAt(0).toUpperCase() + field.slice(1);
  message = `${fieldName} "${value}" is already in use by another ${entityType}. Please use a different ${fieldName.toLowerCase()}.`;

  return {
    status: 400,
    response: {
      success: false,
      message: message,
      error: {
        type: 'DUPLICATE_KEY',
        field: fieldName,
        value: value,
        details: `This ${fieldName.toLowerCase()} is already in use by another ${entityType} device.`
      }
    }
  };
};

// Helper function to handle validation errors
const handleValidationError = (error: any) => {
  const validationErrors = Object.values(error.errors).map((err: any) => err.message);
  return {
    status: 400,
    response: {
      success: false,
      message: "Validation failed. Please check your input.",
      error: {
        type: 'VALIDATION_ERROR',
        details: validationErrors
      }
    }
  };
};

// Helper function to handle general errors
const handleGeneralError = (error: any, operation: string) => {
  console.error(`Error ${operation}:`, error);
  return {
    status: 500,
    response: {
      success: false,
      message: `Error ${operation}. Please try again later.`,
      error: {
        type: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.'
      }
    }
  };
};

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
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const errorInfo = handleDuplicateKeyError(error, 'OLT');
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errorInfo = handleValidationError(error);
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle other errors
    const errorInfo = handleGeneralError(error, 'creating OLT');
    res.status(errorInfo.status).json(errorInfo.response);
  }
};

// Get all OLTs
export const getAllOLTs = async (req: Request, res: Response): Promise<any> => {
  try {
    const olts = await OLTModel.find().sort({ createdAt: -1 });

    // For each OLT, get all connected devices
    const oltsWithTopology = await Promise.all(olts.map(async (olt) => {
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

      // Get connected SUBMS devices
      const connectedSUBMS = await SUBMSModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      });

      // Get connected X2 devices
      const connectedX2 = await X2Model.find({
        "input.type": "olt",
        "input.id": olt.oltId
      });

      return {
        ...olt.toObject(),
        outputs: [
          ...connectedMS.map(ms => ({ type: "ms", id: ms.msId, data: ms })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb })),
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
        ]
      };
    }));

    res.status(200).json({
      success: true,
      count: oltsWithTopology.length,
      data: oltsWithTopology
    });
  } catch (error: any) {
    const errorInfo = handleGeneralError(error, 'fetching OLTs');
    res.status(errorInfo.status).json(errorInfo.response);
  }
};

// Get all OLTs with complete outputs format
export const getAllOLTsWithOutputs = async (req: Request, res: Response): Promise<any> => {
  try {
    const olts = await OLTModel.find().sort({ createdAt: -1 });

    // For each OLT, get all connected devices with complete topology
    const oltsWithOutputs = await Promise.all(olts.map(async (olt) => {
      // Get all connected devices
      const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
        MSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        FDBModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        SUBMSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        X2Model.find({
          "input.type": "olt",
          "input.id": olt.oltId
        })
      ]);

      // Build complete topology for MS devices
      const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
        // Get SUBMS devices connected to this MS
        const connectedSUBMS = await SUBMSModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });

        // Get FDB devices connected to this MS
        const connectedFDB = await FDBModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });

        // Build SUBMS topology
        const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
          // Get X2 devices connected to this SUBMS
          const connectedX2 = await X2Model.find({
            "input.type": "subms",
            "input.id": subms.submsId
          });

          // Get customers connected to X2 devices
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            subms_id: subms.submsId,
            subms_name: subms.submsName,
            subms_power: subms.submsType || 0,
            location: [subms.latitude, subms.longitude],
            input: { type: "ms", id: ms.msId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2,
            customers: customersFromX2.flat()
          };
        }));

        // Build FDB topology
        const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
          // Get X2 devices connected to this FDB
          const connectedX2 = await X2Model.find({
            "input.type": "fdb",
            "input.id": fdb.fdbId
          });

          // Get customers connected to X2 devices
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            fdb_id: fdb.fdbId,
            fdb_name: fdb.fdbName,
            fdb_power: fdb.fdbPower || 0,
            location: [fdb.latitude, fdb.longitude],
            input: { type: "ms", id: ms.msId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2,
            customers: customersFromX2.flat()
          };
        }));

        return {
          ms_id: ms.msId,
          ms_name: ms.msName,
          ms_power: ms.msType || 0,
          location: [ms.latitude, ms.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
            ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
          ],
          subms_devices: submsWithTopology,
          fdb_devices: fdbWithTopology
        };
      }));

      // Build complete topology for FDB devices
      const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
        // Get X2 devices connected to this FDB
        const connectedX2 = await X2Model.find({
          "input.type": "fdb",
          "input.id": fdb.fdbId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          fdb_id: fdb.fdbId,
          fdb_name: fdb.fdbName,
          fdb_power: fdb.fdbPower || 0,
          location: [fdb.latitude, fdb.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2,
          customers: customersFromX2.flat()
        };
      }));

      // Build complete topology for SUBMS devices
      const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
        // Get X2 devices connected to this SUBMS
        const connectedX2 = await X2Model.find({
          "input.type": "subms",
          "input.id": subms.submsId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          subms_id: subms.submsId,
          subms_name: subms.submsName,
          subms_power: subms.submsType || 0,
          location: [subms.latitude, subms.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2.map((x2, index) => ({
            x2_id: x2.x2Id,
            x2_name: x2.x2Name,
            x2_power: x2.x2Power || 0,
            location: [x2.latitude, x2.longitude],
            input: { type: "subms", id: subms.submsId },
            outputs: [
              ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
            ],
            customers: customersFromX2[index]
          })),
          customers: customersFromX2.flat()
        };
      }));

      // Build complete topology for X2 devices
      const x2WithTopology = await Promise.all(connectedX2.map(async (x2) => {
        // Get customers connected to this X2
        const customers = await UserModel.find({
          role: "user",
          "networkInput.type": "x2",
          "networkInput.id": x2.x2Id
        });

        return {
          x2_id: x2.x2Id,
          x2_name: x2.x2Name,
          x2_power: x2.x2Power || 0,
          location: [x2.latitude, x2.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...customers.map(customer => ({ type: "customer", id: customer._id }))
          ],
          customers: customers
        };
      }));

      // Format the response similar to your example
      return {
        olt_id: olt.oltId,
        olt_model: olt.oltModel || olt.manufacturer,
        ip_address: olt.oltIp,
        mac_address: olt.macAddress,
        serial_number: olt.serialNumber,
        olt_power: olt.oltPower || 0,
        location: [olt.latitude, olt.longitude],
        outputs: [
          ...connectedMS.map(ms => ({ type: "ms", id: ms.msId })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId })),
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
        ],
        // Include complete topology data for each device type
        ms_devices: msWithTopology,
        fdb_devices: fdbWithTopology,
        subms_devices: submsWithTopology,
        x2_devices: x2WithTopology
      };
    }));

    res.status(200).json({
      success: true,
      count: oltsWithOutputs.length,
      data: oltsWithOutputs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching OLTs with outputs",
      error: error.message
    });
  }
};

// Get OLT by ID
export const getOLTById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params; //id can be mongoose_id or oltId : "OLT8280"

    // Try to find OLT by _id first, then by oltId if not found
    let olt = await OLTModel.findById(id);

    if (!olt) {
      // If not found by _id, try to find by oltId
      olt = await OLTModel.findOne({ oltId: id });
    }

    if (!olt) {
      return res.status(404).json({
        success: false,
        message: "OLT not found"
      });
    }

    // Get all connected devices
    const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
      MSModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      }),
      FDBModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      }),
      SUBMSModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      }),
      X2Model.find({
        "input.type": "olt",
        "input.id": olt.oltId
      })
    ]);

    const oltWithTopology = {
      ...olt.toObject(),
      outputs: [
        ...connectedMS.map(ms => ({ type: "ms", id: ms.msId, data: ms })),
        ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb })),
        ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
        ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
      ]
    };

    res.status(200).json({
      success: true,
      data: oltWithTopology
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

    // Get connected MS devices with their nested devices
    const connectedMS = await MSModel.find({
      "input.type": "olt",
      "input.id": olt.oltId
    });

    const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
      // Get SUBMS devices connected to this MS
      const connectedSUBMS = await SUBMSModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });

      // Get FDB devices connected to this MS
      const connectedFDB = await FDBModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });

      return {
        ...ms.toObject(),
        outputs: [
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb }))
        ]
      };
    }));

    // Get connected FDB devices with their nested devices
    const connectedFDB = await FDBModel.find({
      "input.type": "olt",
      "input.id": olt.oltId
    });

    const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
      // Get X2 devices connected to this FDB
      const connectedX2 = await X2Model.find({
        "input.type": "fdb",
        "input.id": fdb.fdbId
      });

      return {
        ...fdb.toObject(),
        outputs: [
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
        ]
      };
    }));

    // Get connected SUBMS devices with their nested devices
    const connectedSUBMS = await SUBMSModel.find({
      "input.type": "olt",
      "input.id": olt.oltId
    });

    const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
      // Get X2 devices connected to this SUBMS
      const connectedX2 = await X2Model.find({
        "input.type": "subms",
        "input.id": subms.submsId
      });

      return {
        ...subms.toObject(),
        outputs: [
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
        ]
      };
    }));

    // Get connected X2 devices
    const connectedX2 = await X2Model.find({
      "input.type": "olt",
      "input.id": olt.oltId
    });

    const topology = {
      olt,
      connectedDevices: {
        ms: msWithTopology,
        fdb: fdbWithTopology,
        subms: submsWithTopology,
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
      message: "Error fetching network topology",
      error: error.message
    });
  }
};

// Get OLT with complete outputs data (MS, SUBMS, FDB, X2)
export const getOLTWithOutputs = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const olt = await OLTModel.findById(id);

    if (!olt) {
      return res.status(404).json({
        success: false,
        message: "OLT not found"
      });
    }

    // Get all connected devices with complete topology
    const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
      MSModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      }),
      FDBModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      }),
      SUBMSModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      }),
      X2Model.find({
        "input.type": "olt",
        "input.id": olt.oltId
      })
    ]);

    // Build complete topology for MS devices
    const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
      // Get SUBMS devices connected to this MS
      const connectedSUBMS = await SUBMSModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });

      // Get FDB devices connected to this MS
      const connectedFDB = await FDBModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });

      // Build SUBMS topology
      const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
        // Get X2 devices connected to this SUBMS
        const connectedX2 = await X2Model.find({
          "input.type": "subms",
          "input.id": subms.submsId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          subms_id: subms.submsId,
          subms_name: subms.submsName,
          subms_power: subms.submsType || 0,
          location: [subms.latitude, subms.longitude],
          input: { type: "ms", id: ms.msId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2,
          customers: customersFromX2.flat()
        };
      }));

      // Build FDB topology
      const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
        // Get X2 devices connected to this FDB
        const connectedX2 = await X2Model.find({
          "input.type": "fdb",
          "input.id": fdb.fdbId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          fdb_id: fdb.fdbId,
          fdb_name: fdb.fdbName,
          fdb_power: fdb.fdbPower || 0,
          location: [fdb.latitude, fdb.longitude],
          input: { type: "ms", id: ms.msId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2,
          customers: customersFromX2.flat()
        };
      }));

      return {
        ms_id: ms.msId,
        ms_name: ms.msName,
        ms_power: ms.msType || 0,
        location: [ms.latitude, ms.longitude],
        input: { type: "olt", id: olt.oltId },
        outputs: [
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
        ],
        subms_devices: submsWithTopology,
        fdb_devices: fdbWithTopology
      };
    }));

    // Build complete topology for FDB devices
    const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
      // Get X2 devices connected to this FDB
      const connectedX2 = await X2Model.find({
        "input.type": "fdb",
        "input.id": fdb.fdbId
      });

      // Get customers connected to X2 devices
      const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
        const customers = await UserModel.find({
          role: "user",
          "networkInput.type": "x2",
          "networkInput.id": x2.x2Id
        });
        return customers;
      }));

      return {
        fdb_id: fdb.fdbId,
        fdb_name: fdb.fdbName,
        fdb_power: fdb.fdbPower || 0,
        location: [fdb.latitude, fdb.longitude],
        input: { type: "olt", id: olt.oltId },
        outputs: [
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
        ],
        x2_devices: connectedX2.map((x2, index) => ({
          x2_id: x2.x2Id,
          x2_name: x2.x2Name,
          x2_power: x2.x2Power || 0,
          location: [x2.latitude, x2.longitude],
          input: { type: "fdb", id: fdb.fdbId },
          outputs: [
            ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
          ],
          customers: customersFromX2[index]
        })),
        customers: customersFromX2.flat()
      };
    }));

    // Build complete topology for SUBMS devices
    const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
      // Get X2 devices connected to this SUBMS
      const connectedX2 = await X2Model.find({
        "input.type": "subms",
        "input.id": subms.submsId
      });

      // Get customers connected to X2 devices
      const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
        const customers = await UserModel.find({
          role: "user",
          "networkInput.type": "x2",
          "networkInput.id": x2.x2Id
        });
        return customers;
      }));

      return {
        subms_id: subms.submsId,
        subms_name: subms.submsName,
        subms_power: subms.submsType || 0,
        location: [subms.latitude, subms.longitude],
        input: { type: "olt", id: olt.oltId },
        outputs: [
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
        ],
        x2_devices: connectedX2.map((x2, index) => ({
          x2_id: x2.x2Id,
          x2_name: x2.x2Name,
          x2_power: x2.x2Power || 0,
          location: [x2.latitude, x2.longitude],
          input: { type: "subms", id: subms.submsId },
          outputs: [
            ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
          ],
          customers: customersFromX2[index]
        })),
        customers: customersFromX2.flat()
      };
    }));

    // Build complete topology for X2 devices
    const x2WithTopology = await Promise.all(connectedX2.map(async (x2) => {
      // Get customers connected to this X2
      const customers = await UserModel.find({
        role: "user",
        "networkInput.type": "x2",
        "networkInput.id": x2.x2Id
      });

      return {
        x2_id: x2.x2Id,
        x2_name: x2.x2Name,
        x2_power: x2.x2Power || 0,
        location: [x2.latitude, x2.longitude],
        input: { type: "olt", id: olt.oltId },
        outputs: [
          ...customers.map(customer => ({ type: "customer", id: customer._id }))
        ],
        customers: customers
      };
    }));

    // Format the response similar to your example
    const oltWithOutputs = {
      olt_id: olt.oltId,
      olt_model: olt.oltModel || olt.manufacturer,
      ip_address: olt.oltIp,
      mac_address: olt.macAddress,
      serial_number: olt.serialNumber,
      olt_power: olt.oltPower || 0,
      location: [olt.latitude, olt.longitude],
      outputs: [
        ...connectedMS.map(ms => ({ type: "ms", id: ms.msId })),
        ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId })),
        ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
        ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
      ],
      // Include complete topology data for each device type
      ms_devices: msWithTopology,
      fdb_devices: fdbWithTopology,
      subms_devices: submsWithTopology,
      x2_devices: x2WithTopology
    };

    res.status(200).json({
      success: true,
      count: 1,
      serialNumber: olt.serialNumber,
      data: [oltWithOutputs]
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching OLT with outputs",
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
    const { companyId } = req.params;

    const olts = await OLTModel.find({
      ownedBy: companyId
    }).populate('ownedBy', 'name email company');

    // For each OLT, get all connected devices with simplified topology
    const oltsWithTopology = await Promise.all(olts.map(async (olt) => {
      // Get all connected devices
      const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
        MSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        FDBModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        SUBMSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        X2Model.find({
          "input.type": "olt",
          "input.id": olt.oltId
        })
      ]);

      // Build simplified topology for MS devices
      const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
        // Get SUBMS devices connected to this MS
        const connectedSUBMS = await SUBMSModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });
        //get FDB devices connected to this MS
        const connectedFDB = await FDBModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });

        return {
          ms_id: ms.msId,
          ms_name: ms.msName,
          ms_power: ms.msType || 0,
          location: [ms.latitude, ms.longitude],
          input: { type: "olt", id: olt.oltId },
          attachments: ms.attachments,
          outputs: [
            ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
            ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
          ]
        };
      }));

      // Get all FDB devices connected to any MS of this OLT
      const allConnectedFDB = await Promise.all(connectedMS.map(async (ms) => {
        const connectedFDB = await FDBModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });
        return connectedFDB;
      }));
      const flattenedFDB = allConnectedFDB.flat();

      // Get all SUBMS devices connected to any MS of this OLT
      const allConnectedSUBMS = await Promise.all(connectedMS.map(async (ms) => {
        const connectedSUBMS = await SUBMSModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });
        return connectedSUBMS;
      }));
      const flattenedSUBMS = allConnectedSUBMS.flat();

      // Get all FDB devices connected to SUBMS devices
      const allConnectedFDBFromSUBMS = await Promise.all(flattenedSUBMS.map(async (subms) => {
        const connectedFDB = await FDBModel.find({
          "input.type": "subms",
          "input.id": subms.submsId
        });
        return connectedFDB;
      }));
      const flattenedFDBFromSUBMS = allConnectedFDBFromSUBMS.flat();

      // Build simplified topology for FDB devices (both direct OLT connections, MS connections, and SUBMS connections)
      const fdbWithTopology = await Promise.all([...connectedFDB, ...flattenedFDB, ...flattenedFDBFromSUBMS].map(async (fdb) => {
        // Get X2 devices connected to this FDB
        const connectedX2 = await X2Model.find({
          "input.type": "fdb",
          "input.id": fdb.fdbId
        })
        return {
          fdb_id: fdb.fdbId,
          fdb_name: fdb.fdbName,
          fdb_power: fdb.fdbPower || 0,
          location: [fdb.latitude, fdb.longitude],
          input: fdb.input, // Keep the original input (either "olt", "ms", or "subms")
          attachments: fdb.attachments,
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ]
        };
      }));

      // Build simplified topology for SUBMS devices
      const submsWithTopology = await Promise.all(flattenedSUBMS.map(async (subms) => {
        const connectedFDB = await FDBModel.find({
          "input.type": "subms",
          "input.id": subms.submsId
        });
        return {
          subms_id: subms.submsId,
          subms_name: subms.submsName,
          subms_power: subms.submsType || 0,
          location: [subms.latitude, subms.longitude],
          input: { type: "ms", id: subms.input.id },
          attachments: subms.attachments,
          outputs: [
            ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
          ]
        };
      }));

      // Get all X2 devices connected to any FDB of this OLT (both direct, MS-connected, and SUBMS-connected FDBs)
      const allConnectedX2 = await Promise.all([...connectedFDB, ...flattenedFDB, ...flattenedFDBFromSUBMS].map(async (fdb) => {
        const connectedX2 = await X2Model.find({
          "input.type": "fdb",
          "input.id": fdb.fdbId
        });
        return connectedX2;
      }));
      const flattenedX2 = allConnectedX2.flat();

      // Build simplified topology for X2 devices
      const x2WithTopology = await Promise.all(flattenedX2.map(async (x2) => {
        return {
          x2_id: x2.x2Id,
          x2_name: x2.x2Name,
          x2_power: x2.x2Power || 0,
          location: [x2.latitude, x2.longitude],
          input: { type: "fdb", id: x2.input.id },
          attachments: x2.attachments,
          outputs: []
        };
      }));

      console.log("fdbWithTopology", fdbWithTopology);


      return {
        ...olt.toObject(),
        outputs: [
          ...connectedMS.map(ms => ({ type: "ms", id: ms.msId })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId })),
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
        ],
        // Include simplified topology data for each device type
        ms_devices: msWithTopology,
        fdb_devices: fdbWithTopology,
        subms_devices: submsWithTopology,
        x2_devices: x2WithTopology
      };
    }));

    res.status(200).json({
      success: true,
      count: oltsWithTopology.length,
      data: oltsWithTopology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by serial number",
      error: error.message
    });
  }
};

// Search OLTs by Serial Number with complete outputs format
export const searchOLTsBySerialNumberWithOutputs = async (req: Request, res: Response): Promise<any> => {
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

    // For each OLT, get all connected devices with complete topology
    const oltsWithOutputs = await Promise.all(olts.map(async (olt) => {
      // Get all connected devices
      const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
        MSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        FDBModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        SUBMSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        X2Model.find({
          "input.type": "olt",
          "input.id": olt.oltId
        })
      ]);

      // Build complete topology for MS devices
      const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
        // Get SUBMS devices connected to this MS
        const connectedSUBMS = await SUBMSModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });

        // Get FDB devices connected to this MS
        const connectedFDB = await FDBModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });

        // Build SUBMS topology
        const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
          // Get X2 devices connected to this SUBMS
          const connectedX2 = await X2Model.find({
            "input.type": "subms",
            "input.id": subms.submsId
          });

          // Get customers connected to X2 devices
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            subms_id: subms.submsId,
            subms_name: subms.submsName,
            subms_power: subms.submsType,
            location: [subms.latitude, subms.longitude],
            input: { type: "ms", id: ms.msId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2,
            customers: customersFromX2.flat()
          };
        }));

        // Build FDB topology
        const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
          // Get X2 devices connected to this FDB
          const connectedX2 = await X2Model.find({
            "input.type": "fdb",
            "input.id": fdb.fdbId
          });

          // Get customers connected to X2 devices
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            fdb_id: fdb.fdbId,
            fdb_name: fdb.fdbName,
            fdb_power: fdb.fdbPower,
            location: [fdb.latitude, fdb.longitude],
            input: { type: "ms", id: ms.msId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2,
            customers: customersFromX2.flat()
          };
        }));

        return {
          ms_id: ms.msId,
          ms_name: ms.msName,
          ms_power: ms.msType || 0,
          location: [ms.latitude, ms.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
            ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
          ],
          subms_devices: submsWithTopology,
          fdb_devices: fdbWithTopology
        };
      }));

      // Build complete topology for FDB devices
      const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
        // Get X2 devices connected to this FDB
        const connectedX2 = await X2Model.find({
          "input.type": "fdb",
          "input.id": fdb.fdbId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          fdb_id: fdb.fdbId,
          fdb_name: fdb.fdbName,
          fdb_power: fdb.fdbPower || 0,
          location: [fdb.latitude, fdb.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2,
          customers: customersFromX2.flat()
        };
      }));

      // Build complete topology for SUBMS devices
      const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
        // Get X2 devices connected to this SUBMS
        const connectedX2 = await X2Model.find({
          "input.type": "subms",
          "input.id": subms.submsId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          subms_id: subms.submsId,
          subms_name: subms.submsName,
          subms_power: subms.submsType,
          location: [subms.latitude, subms.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2.map((x2, index) => ({
            x2_id: x2.x2Id,
            x2_name: x2.x2Name,
            x2_power: x2.x2Power || 0,
            location: [x2.latitude, x2.longitude],
            input: { type: "subms", id: subms.submsId },
            outputs: [
              ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
            ],
            customers: customersFromX2[index]
          })),
          customers: customersFromX2.flat()
        };
      }));

      // Build complete topology for X2 devices
      const x2WithTopology = await Promise.all(connectedX2.map(async (x2) => {
        // Get customers connected to this X2
        const customers = await UserModel.find({
          role: "user",
          "networkInput.type": "x2",
          "networkInput.id": x2.x2Id
        });

        return {
          x2_id: x2.x2Id,
          x2_name: x2.x2Name,
          x2_power: x2.x2Power || 0,
          location: [x2.latitude, x2.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...customers.map(customer => ({ type: "customer", id: customer._id }))
          ],
          customers: customers
        };
      }));

      // Format the response similar to your example
      return {
        olt_id: olt.oltId,
        olt_model: olt.oltModel || olt.manufacturer,
        ip_address: olt.oltIp,
        mac_address: olt.macAddress,
        serial_number: olt.serialNumber,
        olt_power: olt.oltPower || 0,
        location: [olt.latitude, olt.longitude],
        outputs: [
          ...connectedMS.map(ms => ({ type: "ms", id: ms.msId })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId })),
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
        ],
        // Include complete topology data for each device type
        ms_devices: msWithTopology,
        fdb_devices: fdbWithTopology,
        subms_devices: submsWithTopology,
        x2_devices: x2WithTopology
      };
    }));

    res.status(200).json({
      success: true,
      count: oltsWithOutputs.length,
      serialNumber,
      data: oltsWithOutputs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by serial number with outputs",
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

    // For each OLT, get all connected devices
    const oltsWithTopology = await Promise.all(olts.map(async (olt) => {
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

      // Get connected SUBMS devices
      const connectedSUBMS = await SUBMSModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      });

      // Get connected X2 devices
      const connectedX2 = await X2Model.find({
        "input.type": "olt",
        "input.id": olt.oltId
      });

      return {
        ...olt.toObject(),
        outputs: [
          ...connectedMS.map(ms => ({ type: "ms", id: ms.msId, data: ms })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb })),
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
        ]
      };
    }));

    res.status(200).json({
      success: true,
      count: oltsWithTopology.length,
      oltId,
      data: oltsWithTopology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by OLT ID",
      error: error.message
    });
  }
};

// Search OLTs by OLT ID with complete outputs format
export const searchOLTsByOLTIdWithOutputs = async (req: Request, res: Response): Promise<any> => {
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

    // For each OLT, get all connected devices
    const oltsWithOutputs = await Promise.all(olts.map(async (olt) => {
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

      // Get connected SUBMS devices
      const connectedSUBMS = await SUBMSModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      });

      // Get connected X2 devices
      const connectedX2 = await X2Model.find({
        "input.type": "olt",
        "input.id": olt.oltId
      });

      // Format the response similar to your example
      return {
        olt_id: olt.oltId,
        olt_model: olt.oltModel || olt.manufacturer,
        ip_address: olt.oltIp,
        mac_address: olt.macAddress,
        serial_number: olt.serialNumber,
        olt_power: olt.oltPower || 0,
        location: [olt.latitude, olt.longitude],
        outputs: [
          ...connectedMS.map(ms => ({ type: "ms", id: ms.msId })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId })),
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
        ],
        // Include full data for each device type
        ms_devices: connectedMS,
        fdb_devices: connectedFDB,
        subms_devices: connectedSUBMS,
        x2_devices: connectedX2
      };
    }));

    res.status(200).json({
      success: true,
      count: oltsWithOutputs.length,
      oltId,
      data: oltsWithOutputs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error searching OLTs by OLT ID with outputs",
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
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const errorInfo = handleDuplicateKeyError(error, 'MS');
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errorInfo = handleValidationError(error);
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle other errors
    const errorInfo = handleGeneralError(error, 'creating MS');
    res.status(errorInfo.status).json(errorInfo.response);
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
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const errorInfo = handleDuplicateKeyError(error, 'SUBMS');
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errorInfo = handleValidationError(error);
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle other errors
    const errorInfo = handleGeneralError(error, 'creating SUBMS');
    res.status(errorInfo.status).json(errorInfo.response);
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
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const errorInfo = handleDuplicateKeyError(error, 'FDB');
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errorInfo = handleValidationError(error);
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle other errors
    const errorInfo = handleGeneralError(error, 'creating FDB');
    res.status(errorInfo.status).json(errorInfo.response);
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
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const errorInfo = handleDuplicateKeyError(error, 'X2');
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errorInfo = handleValidationError(error);
      return res.status(errorInfo.status).json(errorInfo.response);
    }

    // Handle other errors
    const errorInfo = handleGeneralError(error, 'creating X2');
    res.status(errorInfo.status).json(errorInfo.response);
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

    // For each OLT, get all connected devices with complete topology
    const oltsWithTopology = await Promise.all(olts.map(async (olt) => {
      // Get all connected devices
      const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
        MSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        FDBModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        SUBMSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        X2Model.find({
          "input.type": "olt",
          "input.id": olt.oltId
        })
      ]);

      // Build complete topology for MS devices
      const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
        // Get SUBMS devices connected to this MS
        const connectedSUBMS = await SUBMSModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });

        // Get FDB devices connected to this MS
        const connectedFDB = await FDBModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });

        // Build SUBMS topology
        const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
          // Get X2 devices connected to this SUBMS
          const connectedX2 = await X2Model.find({
            "input.type": "subms",
            "input.id": subms.submsId
          });

          // Get customers connected to X2 devices
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            subms_id: subms.submsId,
            subms_name: subms.submsName,
            subms_power: subms.submsType || 0,
            location: [subms.latitude, subms.longitude],
            input: { type: "ms", id: ms.msId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2,
            customers: customersFromX2.flat()
          };
        }));

        // Build FDB topology
        const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
          // Get X2 devices connected to this FDB
          const connectedX2 = await X2Model.find({
            "input.type": "fdb",
            "input.id": fdb.fdbId
          });

          // Get customers connected to X2 devices
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            fdb_id: fdb.fdbId,
            fdb_name: fdb.fdbName,
            fdb_power: fdb.fdbPower || 0,
            location: [fdb.latitude, fdb.longitude],
            input: { type: "ms", id: ms.msId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2,
            customers: customersFromX2.flat()
          };
        }));

        return {
          ms_id: ms.msId,
          ms_name: ms.msName,
          ms_power: ms.msType || 0,
          location: [ms.latitude, ms.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
            ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
          ],
          subms_devices: submsWithTopology,
          fdb_devices: fdbWithTopology
        };
      }));

      // Build complete topology for FDB devices
      const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
        // Get X2 devices connected to this FDB
        const connectedX2 = await X2Model.find({
          "input.type": "fdb",
          "input.id": fdb.fdbId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          fdb_id: fdb.fdbId,
          fdb_name: fdb.fdbName,
          fdb_power: fdb.fdbPower || 0,
          location: [fdb.latitude, fdb.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2,
          customers: customersFromX2.flat()
        };
      }));

      // Build complete topology for SUBMS devices
      const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
        // Get X2 devices connected to this SUBMS
        const connectedX2 = await X2Model.find({
          "input.type": "subms",
          "input.id": subms.submsId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          subms_id: subms.submsId,
          subms_name: subms.submsName,
          subms_power: subms.submsType || 0,
          location: [subms.latitude, subms.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2,
          customers: customersFromX2.flat()
        };
      }));

      // Build complete topology for X2 devices
      const x2WithTopology = await Promise.all(connectedX2.map(async (x2) => {
        // Get customers connected to this X2
        const customers = await UserModel.find({
          role: "user",
          "networkInput.type": "x2",
          "networkInput.id": x2.x2Id
        });

        return {
          x2_id: x2.x2Id,
          x2_name: x2.x2Name,
          x2_power: x2.x2Power || 0,
          location: [x2.latitude, x2.longitude],
          input: { type: "olt", id: olt.oltId },
          outputs: [
            ...customers.map(customer => ({ type: "customer", id: customer._id }))
          ],
          customers: customers
        };
      }));

      return {
        ...olt.toObject(),
        outputs: [
          ...connectedMS.map(ms => ({ type: "ms", id: ms.msId, data: ms })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb })),
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
        ],
        // Include complete topology data for each device type
        ms_devices: msWithTopology,
        fdb_devices: fdbWithTopology,
        subms_devices: submsWithTopology,
        x2_devices: x2WithTopology
      };
    }));

    res.status(200).json({
      success: true,
      count: oltsWithTopology.length,
      companyId,
      data: oltsWithTopology
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

    // For each FDB, get all connected devices with complete topology
    const fdbsWithTopology = await Promise.all(fdbs.map(async (fdb) => {
      // Get X2 devices connected to this FDB
      const connectedX2 = await X2Model.find({
        "input.type": "fdb",
        "input.id": fdb.fdbId
      });

      // Get customers connected to X2 devices
      const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
        const customers = await UserModel.find({
          role: "user",
          "networkInput.type": "x2",
          "networkInput.id": x2.x2Id
        });
        return customers;
      }));

      // Get input device (OLT or MS)
      let inputDevice = null;
      if (fdb.input && fdb.input.type && fdb.input.id) {
        if (fdb.input.type === "olt") {
          inputDevice = await OLTModel.findOne({ oltId: fdb.input.id });
        } else if (fdb.input.type === "ms") {
          inputDevice = await MSModel.findOne({ msId: fdb.input.id });
        }
      }

      return {
        ...fdb.toObject(),
        input_device: inputDevice,
        outputs: [
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
        ],
        x2_devices: connectedX2.map((x2, index) => ({
          x2_id: x2.x2Id,
          x2_name: x2.x2Name,
          x2_power: x2.x2Power || 0,
          location: [x2.latitude, x2.longitude],
          input: { type: "fdb", id: fdb.fdbId },
          outputs: [
            ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
          ],
          customers: customersFromX2[index]
        })),
        customers: customersFromX2.flat()
      };
    }));

    res.status(200).json({
      success: true,
      count: fdbsWithTopology.length,
      companyId,
      data: fdbsWithTopology
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

    // For each MS device, get all connected devices with complete topology
    const msWithTopology = await Promise.all(msDevices.map(async (ms) => {
      // Get SUBMS devices connected to this MS
      const connectedSUBMS = await SUBMSModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });

      // Get FDB devices connected to this MS
      const connectedFDB = await FDBModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });

      // Build SUBMS topology
      const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
        // Get X2 devices connected to this SUBMS
        const connectedX2 = await X2Model.find({
          "input.type": "subms",
          "input.id": subms.submsId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          subms_id: subms.submsId,
          subms_name: subms.submsName,
          subms_power: subms.submsType || 0,
          location: [subms.latitude, subms.longitude],
          input: { type: "ms", id: ms.msId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2,
          customers: customersFromX2.flat()
        };
      }));

      // Build FDB topology
      const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
        // Get X2 devices connected to this FDB
        const connectedX2 = await X2Model.find({
          "input.type": "fdb",
          "input.id": fdb.fdbId
        });

        // Get customers connected to X2 devices
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        return {
          fdb_id: fdb.fdbId,
          fdb_name: fdb.fdbName,
          fdb_power: fdb.fdbPower || 0,
          location: [fdb.latitude, fdb.longitude],
          input: { type: "ms", id: ms.msId },
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ],
          x2_devices: connectedX2,
          customers: customersFromX2.flat()
        };
      }));

      // Get input device (OLT)
      let inputDevice = null;
      if (ms.input && ms.input.type && ms.input.id) {
        if (ms.input.type === "olt") {
          inputDevice = await OLTModel.findOne({ oltId: ms.input.id });
        }
      }

      return {
        ...ms.toObject(),
        input_device: inputDevice,
        outputs: [
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb }))
        ],
        subms_devices: submsWithTopology,
        fdb_devices: fdbWithTopology
      };
    }));

    res.status(200).json({
      success: true,
      count: msWithTopology.length,
      companyId,
      data: msWithTopology
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

    // For each SUBMS device, get all connected devices with complete topology
    const submsWithTopology = await Promise.all(submsDevices.map(async (subms) => {
      // Get X2 devices connected to this SUBMS
      const connectedX2 = await X2Model.find({
        "input.type": "subms",
        "input.id": subms.submsId
      });

      // Get customers connected to X2 devices
      const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
        const customers = await UserModel.find({
          role: "user",
          "networkInput.type": "x2",
          "networkInput.id": x2.x2Id
        });
        return customers;
      }));

      // Get input device (OLT or MS)
      let inputDevice = null;
      if (subms.input && subms.input.type && subms.input.id) {
        if (subms.input.type === "olt") {
          inputDevice = await OLTModel.findOne({ oltId: subms.input.id });
        } else if (subms.input.type === "ms") {
          inputDevice = await MSModel.findOne({ msId: subms.input.id });
        }
      }

      return {
        ...subms.toObject(),
        input_device: inputDevice,
        outputs: [
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
        ],
        x2_devices: connectedX2.map((x2, index) => ({
          x2_id: x2.x2Id,
          x2_name: x2.x2Name,
          x2_power: x2.x2Power || 0,
          location: [x2.latitude, x2.longitude],
          input: { type: "subms", id: subms.submsId },
          outputs: [
            ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
          ],
          customers: customersFromX2[index]
        })),
        customers: customersFromX2.flat()
      };
    }));

    res.status(200).json({
      success: true,
      count: submsWithTopology.length,
      companyId,
      data: submsWithTopology
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

    // For each X2 device, get all connected customers with complete topology
    const x2WithTopology = await Promise.all(x2Devices.map(async (x2) => {
      // Get customers connected to this X2
      const customers = await UserModel.find({
        role: "user",
        "networkInput.type": "x2",
        "networkInput.id": x2.x2Id
      });

      // Get input device (OLT, MS, SUBMS, or FDB)
      let inputDevice = null;
      if (x2.input && x2.input.type && x2.input.id) {
        if (x2.input.type === "olt") {
          inputDevice = await OLTModel.findOne({ oltId: x2.input.id });
        } else if (x2.input.type === "ms") {
          inputDevice = await MSModel.findOne({ msId: x2.input.id });
        } else if (x2.input.type === "subms") {
          inputDevice = await SUBMSModel.findOne({ submsId: x2.input.id });
        } else if (x2.input.type === "fdb") {
          inputDevice = await FDBModel.findOne({ fdbId: x2.input.id });
        }
      }

      return {
        ...x2.toObject(),
        input_device: inputDevice,
        outputs: [
          ...customers.map(customer => ({ type: "customer", id: customer._id, data: customer }))
        ],
        customers: customers
      };
    }));

    res.status(200).json({
      success: true,
      count: x2WithTopology.length,
      companyId,
      data: x2WithTopology
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

      // Build complete topology for each device type
      const oltsWithTopology = await Promise.all(olts.map(async (olt) => {
        const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
          MSModel.find({ "input.type": "olt", "input.id": olt.oltId }),
          FDBModel.find({ "input.type": "olt", "input.id": olt.oltId }),
          SUBMSModel.find({ "input.type": "olt", "input.id": olt.oltId }),
          X2Model.find({ "input.type": "olt", "input.id": olt.oltId })
        ]);

        // Build MS topology
        const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
          const [connectedSUBMS, connectedFDB] = await Promise.all([
            SUBMSModel.find({ "input.type": "ms", "input.id": ms.msId }),
            FDBModel.find({ "input.type": "ms", "input.id": ms.msId })
          ]);

          // Build SUBMS topology
          const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
            const connectedX2 = await X2Model.find({ "input.type": "subms", "input.id": subms.submsId });
            const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
              const customers = await UserModel.find({
                role: "user",
                "networkInput.type": "x2",
                "networkInput.id": x2.x2Id
              });
              return customers;
            }));

            return {
              subms_id: subms.submsId,
              subms_name: subms.submsName,
              subms_power: subms.submsType || 0,
              location: [subms.latitude, subms.longitude],
              input: { type: "ms", id: ms.msId },
              outputs: [
                ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
              ],
              x2_devices: connectedX2.map((x2, index) => ({
                x2_id: x2.x2Id,
                x2_name: x2.x2Name,
                x2_power: x2.x2Power || 0,
                location: [x2.latitude, x2.longitude],
                input: { type: "subms", id: subms.submsId },
                outputs: [
                  ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                ],
                customers: customersFromX2[index]
              })),
              customers: customersFromX2.flat()
            };
          }));

          // Build FDB topology
          const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
            const connectedX2 = await X2Model.find({ "input.type": "fdb", "input.id": fdb.fdbId });
            const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
              const customers = await UserModel.find({
                role: "user",
                "networkInput.type": "x2",
                "networkInput.id": x2.x2Id
              });
              return customers;
            }));

            return {
              fdb_id: fdb.fdbId,
              fdb_name: fdb.fdbName,
              fdb_power: fdb.fdbPower || 0,
              location: [fdb.latitude, fdb.longitude],
              input: { type: "ms", id: ms.msId },
              outputs: [
                ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
              ],
              x2_devices: connectedX2.map((x2, index) => ({
                x2_id: x2.x2Id,
                x2_name: x2.x2Name,
                x2_power: x2.x2Power || 0,
                location: [x2.latitude, x2.longitude],
                input: { type: "fdb", id: fdb.fdbId },
                outputs: [
                  ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                ],
                customers: customersFromX2[index]
              })),
              customers: customersFromX2.flat()
            };
          }));

          return {
            ms_id: ms.msId,
            ms_name: ms.msName,
            ms_power: ms.msType || 0,
            location: [ms.latitude, ms.longitude],
            input: { type: "olt", id: olt.oltId },
            outputs: [
              ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
              ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
            ],
            subms_devices: submsWithTopology,
            fdb_devices: fdbWithTopology
          };
        }));

        // Build FDB topology
        const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
          const connectedX2 = await X2Model.find({ "input.type": "fdb", "input.id": fdb.fdbId });
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            fdb_id: fdb.fdbId,
            fdb_name: fdb.fdbName,
            fdb_power: fdb.fdbPower || 0,
            location: [fdb.latitude, fdb.longitude],
            input: { type: "olt", id: olt.oltId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2.map((x2, index) => ({
              x2_id: x2.x2Id,
              x2_name: x2.x2Name,
              x2_power: x2.x2Power || 0,
              location: [x2.latitude, x2.longitude],
              input: { type: "fdb", id: fdb.fdbId },
              outputs: [
                ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
              ],
              customers: customersFromX2[index]
            })),
            customers: customersFromX2.flat()
          };
        }));

        // Build SUBMS topology
        const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
          const connectedX2 = await X2Model.find({ "input.type": "subms", "input.id": subms.submsId });
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            subms_id: subms.submsId,
            subms_name: subms.submsName,
            subms_power: subms.submsType || 0,
            location: [subms.latitude, subms.longitude],
            input: { type: "olt", id: olt.oltId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2.map((x2, index) => ({
              x2_id: x2.x2Id,
              x2_name: x2.x2Name,
              x2_power: x2.x2Power || 0,
              location: [x2.latitude, x2.longitude],
              input: { type: "subms", id: subms.submsId },
              outputs: [
                ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
              ],
              customers: customersFromX2[index]
            })),
            customers: customersFromX2.flat()
          };
        }));

        // Build X2 topology
        const x2WithTopology = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });

          return {
            x2_id: x2.x2Id,
            x2_name: x2.x2Name,
            x2_power: x2.x2Power || 0,
            location: [x2.latitude, x2.longitude],
            input: { type: "olt", id: olt.oltId },
            outputs: [
              ...customers.map(customer => ({ type: "customer", id: customer._id }))
            ],
            customers: customers
          };
        }));

        return {
          ...olt.toObject(),
          outputs: [
            ...connectedMS.map(ms => ({ type: "ms", id: ms.msId, data: ms })),
            ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb })),
            ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
          ],
          ms_devices: msWithTopology,
          fdb_devices: fdbWithTopology,
          subms_devices: submsWithTopology,
          x2_devices: x2WithTopology
        };
      }));

      const fdbsWithTopology = await Promise.all(fdbs.map(async (fdb) => {
        const connectedX2 = await X2Model.find({ "input.type": "fdb", "input.id": fdb.fdbId });
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        let inputDevice = null;
        if (fdb.input && fdb.input.type && fdb.input.id) {
          if (fdb.input.type === "olt") {
            inputDevice = await OLTModel.findOne({ oltId: fdb.input.id });
          } else if (fdb.input.type === "ms") {
            inputDevice = await MSModel.findOne({ msId: fdb.input.id });
          }
        }

        return {
          ...fdb.toObject(),
          input_device: inputDevice,
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
          ],
          x2_devices: connectedX2.map((x2, index) => ({
            x2_id: x2.x2Id,
            x2_name: x2.x2Name,
            x2_power: x2.x2Power || 0,
            location: [x2.latitude, x2.longitude],
            input: { type: "fdb", id: fdb.fdbId },
            outputs: [
              ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
            ],
            customers: customersFromX2[index]
          })),
          customers: customersFromX2.flat()
        };
      }));

      const msWithTopology = await Promise.all(ms.map(async (msDevice) => {
        const [connectedSUBMS, connectedFDB] = await Promise.all([
          SUBMSModel.find({ "input.type": "ms", "input.id": msDevice.msId }),
          FDBModel.find({ "input.type": "ms", "input.id": msDevice.msId })
        ]);

        // Build SUBMS topology
        const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
          const connectedX2 = await X2Model.find({ "input.type": "subms", "input.id": subms.submsId });
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            subms_id: subms.submsId,
            subms_name: subms.submsName,
            subms_power: subms.submsType || 0,
            location: [subms.latitude, subms.longitude],
            input: { type: "ms", id: msDevice.msId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2.map((x2, index) => ({
              x2_id: x2.x2Id,
              x2_name: x2.x2Name,
              x2_power: x2.x2Power || 0,
              location: [x2.latitude, x2.longitude],
              input: { type: "subms", id: subms.submsId },
              outputs: [
                ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
              ],
              customers: customersFromX2[index]
            })),
            customers: customersFromX2.flat()
          };
        }));

        // Build FDB topology
        const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
          const connectedX2 = await X2Model.find({ "input.type": "fdb", "input.id": fdb.fdbId });
          const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });
            return customers;
          }));

          return {
            fdb_id: fdb.fdbId,
            fdb_name: fdb.fdbName,
            fdb_power: fdb.fdbPower || 0,
            location: [fdb.latitude, fdb.longitude],
            input: { type: "ms", id: msDevice.msId },
            outputs: [
              ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
            ],
            x2_devices: connectedX2.map((x2, index) => ({
              x2_id: x2.x2Id,
              x2_name: x2.x2Name,
              x2_power: x2.x2Power || 0,
              location: [x2.latitude, fdb.longitude],
              input: { type: "fdb", id: fdb.fdbId },
              outputs: [
                ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
              ],
              customers: customersFromX2[index]
            })),
            customers: customersFromX2.flat()
          };
        }));

        let inputDevice = null;
        if (msDevice.input && msDevice.input.type && msDevice.input.id) {
          if (msDevice.input.type === "olt") {
            inputDevice = await OLTModel.findOne({ oltId: msDevice.input.id });
          }
        }

        return {
          ...msDevice.toObject(),
          input_device: inputDevice,
          outputs: [
            ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
            ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb }))
          ],
          subms_devices: submsWithTopology,
          fdb_devices: fdbWithTopology
        };
      }));

      const submsWithTopology = await Promise.all(subms.map(async (submsDevice) => {
        const connectedX2 = await X2Model.find({ "input.type": "subms", "input.id": submsDevice.submsId });
        const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
          const customers = await UserModel.find({
            role: "user",
            "networkInput.type": "x2",
            "networkInput.id": x2.x2Id
          });
          return customers;
        }));

        let inputDevice = null;
        if (submsDevice.input && submsDevice.input.type && submsDevice.input.id) {
          if (submsDevice.input.type === "olt") {
            inputDevice = await OLTModel.findOne({ oltId: submsDevice.input.id });
          } else if (submsDevice.input.type === "ms") {
            inputDevice = await MSModel.findOne({ msId: submsDevice.input.id });
          }
        }

        return {
          ...submsDevice.toObject(),
          input_device: inputDevice,
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
          ],
          x2_devices: connectedX2.map((x2, index) => ({
            x2_id: x2.x2Id,
            x2_name: x2.x2Name,
            x2_power: x2.x2Power || 0,
            location: [x2.latitude, x2.longitude],
            input: { type: "subms", id: submsDevice.submsId },
            outputs: [
              ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
            ],
            customers: customersFromX2[index]
          })),
          customers: customersFromX2.flat()
        };
      }));

      const x2WithTopology = await Promise.all(x2.map(async (x2Device) => {
        const customers = await UserModel.find({
          role: "user",
          "networkInput.type": "x2",
          "networkInput.id": x2Device.x2Id
        });

        let inputDevice = null;
        if (x2Device.input && x2Device.input.type && x2Device.input.id) {
          if (x2Device.input.type === "olt") {
            inputDevice = await OLTModel.findOne({ oltId: x2Device.input.id });
          } else if (x2Device.input.type === "ms") {
            inputDevice = await MSModel.findOne({ msId: x2Device.input.id });
          } else if (x2Device.input.type === "subms") {
            inputDevice = await SUBMSModel.findOne({ submsId: x2Device.input.id });
          } else if (x2Device.input.type === "fdb") {
            inputDevice = await FDBModel.findOne({ fdbId: x2Device.input.id });
          }
        }

        return {
          ...x2Device.toObject(),
          input_device: inputDevice,
          outputs: [
            ...customers.map(customer => ({ type: "customer", id: customer._id, data: customer }))
          ],
          customers: customers
        };
      }));

      result = {
        olts: { count: oltsWithTopology.length, data: oltsWithTopology },
        fdbs: { count: fdbsWithTopology.length, data: fdbsWithTopology },
        ms: { count: msWithTopology.length, data: msWithTopology },
        subms: { count: submsWithTopology.length, data: submsWithTopology },
        x2: { count: x2WithTopology.length, data: x2WithTopology }
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

      // Build complete topology for the specific device type
      let devicesWithTopology: any[] = [];

      switch (type) {
        case 'olt':
          devicesWithTopology = await Promise.all(devices.map(async (olt: any) => {
            const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
              MSModel.find({ "input.type": "olt", "input.id": olt.oltId }),
              FDBModel.find({ "input.type": "olt", "input.id": olt.oltId }),
              SUBMSModel.find({ "input.type": "olt", "input.id": olt.oltId }),
              X2Model.find({ "input.type": "olt", "input.id": olt.oltId })
            ]);

            // Build MS topology
            const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
              const [connectedSUBMS, connectedFDB] = await Promise.all([
                SUBMSModel.find({ "input.type": "ms", "input.id": ms.msId }),
                FDBModel.find({ "input.type": "ms", "input.id": ms.msId })
              ]);

              // Build SUBMS topology
              const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
                const connectedX2 = await X2Model.find({ "input.type": "subms", "input.id": subms.submsId });
                const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
                  const customers = await UserModel.find({
                    role: "user",
                    "networkInput.type": "x2",
                    "networkInput.id": x2.x2Id
                  });
                  return customers;
                }));

                return {
                  subms_id: subms.submsId,
                  subms_name: subms.submsName,
                  subms_power: subms.submsType || 0,
                  location: [subms.latitude, subms.longitude],
                  input: { type: "ms", id: ms.msId },
                  outputs: [
                    ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
                  ],
                  x2_devices: connectedX2.map((x2, index) => ({
                    x2_id: x2.x2Id,
                    x2_name: x2.x2Name,
                    x2_power: x2.x2Power || 0,
                    location: [x2.latitude, x2.longitude],
                    input: { type: "subms", id: subms.submsId },
                    outputs: [
                      ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                    ],
                    customers: customersFromX2[index]
                  })),
                  customers: customersFromX2.flat()
                };
              }));

              // Build FDB topology
              const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
                const connectedX2 = await X2Model.find({ "input.type": "fdb", "input.id": fdb.fdbId });
                const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
                  const customers = await UserModel.find({
                    role: "user",
                    "networkInput.type": "x2",
                    "networkInput.id": x2.x2Id
                  });
                  return customers;
                }));

                return {
                  fdb_id: fdb.fdbId,
                  fdb_name: fdb.fdbName,
                  fdb_power: fdb.fdbPower || 0,
                  location: [fdb.latitude, fdb.longitude],
                  input: { type: "ms", id: ms.msId },
                  outputs: [
                    ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
                  ],
                  x2_devices: connectedX2.map((x2, index) => ({
                    x2_id: x2.x2Id,
                    x2_name: x2.x2Name,
                    x2_power: x2.x2Power || 0,
                    location: [x2.latitude, x2.longitude],
                    input: { type: "fdb", id: fdb.fdbId },
                    outputs: [
                      ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                    ],
                    customers: customersFromX2[index]
                  })),
                  customers: customersFromX2.flat()
                };
              }));

              return {
                ms_id: ms.msId,
                ms_name: ms.msName,
                ms_power: ms.msType || 0,
                location: [ms.latitude, ms.longitude],
                input: { type: "olt", id: olt.oltId },
                outputs: [
                  ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
                  ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
                ],
                subms_devices: submsWithTopology,
                fdb_devices: fdbWithTopology
              };
            }));

            // Build FDB topology
            const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
              const connectedX2 = await X2Model.find({ "input.type": "fdb", "input.id": fdb.fdbId });
              const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
                const customers = await UserModel.find({
                  role: "user",
                  "networkInput.type": "x2",
                  "networkInput.id": x2.x2Id
                });
                return customers;
              }));

              return {
                fdb_id: fdb.fdbId,
                fdb_name: fdb.fdbName,
                fdb_power: fdb.fdbPower || 0,
                location: [fdb.latitude, fdb.longitude],
                input: { type: "olt", id: olt.oltId },
                outputs: [
                  ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
                ],
                x2_devices: connectedX2.map((x2, index) => ({
                  x2_id: x2.x2Id,
                  x2_name: x2.x2Name,
                  x2_power: x2.x2Power || 0,
                  location: [x2.latitude, x2.longitude],
                  input: { type: "fdb", id: fdb.fdbId },
                  outputs: [
                    ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                  ],
                  customers: customersFromX2[index]
                })),
                customers: customersFromX2.flat()
              };
            }));

            // Build SUBMS topology
            const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
              const connectedX2 = await X2Model.find({ "input.type": "subms", "input.id": subms.submsId });
              const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
                const customers = await UserModel.find({
                  role: "user",
                  "networkInput.type": "x2",
                  "networkInput.id": x2.x2Id
                });
                return customers;
              }));

              return {
                subms_id: subms.submsId,
                subms_name: subms.submsName,
                subms_power: subms.submsType || 0,
                location: [subms.latitude, subms.longitude],
                input: { type: "olt", id: olt.oltId },
                outputs: [
                  ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
                ],
                x2_devices: connectedX2.map((x2, index) => ({
                  x2_id: x2.x2Id,
                  x2_name: x2.x2Name,
                  x2_power: x2.x2Power || 0,
                  location: [x2.latitude, x2.longitude],
                  input: { type: "subms", id: subms.submsId },
                  outputs: [
                    ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                  ],
                  customers: customersFromX2[index]
                })),
                customers: customersFromX2.flat()
              };
            }));

            // Build X2 topology
            const x2WithTopology = await Promise.all(connectedX2.map(async (x2) => {
              const customers = await UserModel.find({
                role: "user",
                "networkInput.type": "x2",
                "networkInput.id": x2.x2Id
              });

              return {
                x2_id: x2.x2Id,
                x2_name: x2.x2Name,
                x2_power: x2.x2Power || 0,
                location: [x2.latitude, x2.longitude],
                input: { type: "olt", id: olt.oltId },
                outputs: [
                  ...customers.map(customer => ({ type: "customer", id: customer._id }))
                ],
                customers: customers
              };
            }));

            return {
              ...olt.toObject(),
              outputs: [
                ...connectedMS.map(ms => ({ type: "ms", id: ms.msId, data: ms })),
                ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb })),
                ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
                ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
              ],
              ms_devices: msWithTopology,
              fdb_devices: fdbWithTopology,
              subms_devices: submsWithTopology,
              x2_devices: x2WithTopology
            };
          }));
          break;

        case 'fdb':
          devicesWithTopology = await Promise.all(devices.map(async (fdb: any) => {
            const connectedX2 = await X2Model.find({ "input.type": "fdb", "input.id": fdb.fdbId });
            const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
              const customers = await UserModel.find({
                role: "user",
                "networkInput.type": "x2",
                "networkInput.id": x2.x2Id
              });
              return customers;
            }));

            let inputDevice = null;
            if (fdb.input && fdb.input.type && fdb.input.id) {
              if (fdb.input.type === "olt") {
                inputDevice = await OLTModel.findOne({ oltId: fdb.input.id });
              } else if (fdb.input.type === "ms") {
                inputDevice = await MSModel.findOne({ msId: fdb.input.id });
              }
            }

            return {
              ...fdb.toObject(),
              input_device: inputDevice,
              outputs: [
                ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
              ],
              x2_devices: connectedX2.map((x2, index) => ({
                x2_id: x2.x2Id,
                x2_name: x2.x2Name,
                x2_power: x2.x2Power || 0,
                location: [x2.latitude, x2.longitude],
                input: { type: "fdb", id: fdb.fdbId },
                outputs: [
                  ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                ],
                customers: customersFromX2[index]
              })),
              customers: customersFromX2.flat()
            };
          }));
          break;

        case 'ms':
          devicesWithTopology = await Promise.all(devices.map(async (ms: any) => {
            const [connectedSUBMS, connectedFDB] = await Promise.all([
              SUBMSModel.find({ "input.type": "ms", "input.id": ms.msId }),
              FDBModel.find({ "input.type": "ms", "input.id": ms.msId })
            ]);

            // Build SUBMS topology
            const submsWithTopology = await Promise.all(connectedSUBMS.map(async (subms) => {
              const connectedX2 = await X2Model.find({ "input.type": "subms", "input.id": subms.submsId });
              const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
                const customers = await UserModel.find({
                  role: "user",
                  "networkInput.type": "x2",
                  "networkInput.id": x2.x2Id
                });
                return customers;
              }));

              return {
                subms_id: subms.submsId,
                subms_name: subms.submsName,
                subms_power: subms.submsType || 0,
                location: [subms.latitude, subms.longitude],
                input: { type: "ms", id: ms.msId },
                outputs: [
                  ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
                ],
                x2_devices: connectedX2.map((x2, index) => ({
                  x2_id: x2.x2Id,
                  x2_name: x2.x2Name,
                  x2_power: x2.x2Power || 0,
                  location: [x2.latitude, x2.longitude],
                  input: { type: "subms", id: subms.submsId },
                  outputs: [
                    ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                  ],
                  customers: customersFromX2[index]
                })),
                customers: customersFromX2.flat()
              };
            }));

            // Build FDB topology
            const fdbWithTopology = await Promise.all(connectedFDB.map(async (fdb) => {
              const connectedX2 = await X2Model.find({ "input.type": "fdb", "input.id": fdb.fdbId });
              const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
                const customers = await UserModel.find({
                  role: "user",
                  "networkInput.type": "x2",
                  "networkInput.id": x2.x2Id
                });
                return customers;
              }));

              return {
                fdb_id: fdb.fdbId,
                fdb_name: fdb.fdbName,
                fdb_power: fdb.fdbPower || 0,
                location: [fdb.latitude, fdb.longitude],
                input: { type: "ms", id: ms.msId },
                outputs: [
                  ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
                ],
                x2_devices: connectedX2.map((x2, index) => ({
                  x2_id: x2.x2Id,
                  x2_name: x2.x2Name,
                  x2_power: x2.x2Power || 0,
                  location: [x2.latitude, x2.longitude],
                  input: { type: "fdb", id: fdb.fdbId },
                  outputs: [
                    ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                  ],
                  customers: customersFromX2[index]
                })),
                customers: customersFromX2.flat()
              };
            }));

            let inputDevice = null;
            if (ms.input && ms.input.type && ms.input.id) {
              if (ms.input.type === "olt") {
                inputDevice = await OLTModel.findOne({ oltId: ms.input.id });
              }
            }

            return {
              ...ms.toObject(),
              input_device: inputDevice,
              outputs: [
                ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId, data: subms })),
                ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId, data: fdb }))
              ],
              subms_devices: submsWithTopology,
              fdb_devices: fdbWithTopology
            };
          }));
          break;

        case 'subms':
          devicesWithTopology = await Promise.all(devices.map(async (subms: any) => {
            const connectedX2 = await X2Model.find({ "input.type": "subms", "input.id": subms.submsId });
            const customersFromX2 = await Promise.all(connectedX2.map(async (x2) => {
              const customers = await UserModel.find({
                role: "user",
                "networkInput.type": "x2",
                "networkInput.id": x2.x2Id
              });
              return customers;
            }));

            let inputDevice = null;
            if (subms.input && subms.input.type && subms.input.id) {
              if (subms.input.type === "olt") {
                inputDevice = await OLTModel.findOne({ oltId: subms.input.id });
              } else if (subms.input.type === "ms") {
                inputDevice = await MSModel.findOne({ msId: subms.input.id });
              }
            }

            return {
              ...subms.toObject(),
              input_device: inputDevice,
              outputs: [
                ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id, data: x2 }))
              ],
              x2_devices: connectedX2.map((x2, index) => ({
                x2_id: x2.x2Id,
                x2_name: x2.x2Name,
                x2_power: x2.x2Power || 0,
                location: [x2.latitude, x2.longitude],
                input: { type: "subms", id: subms.submsId },
                outputs: [
                  ...customersFromX2[index].map(customer => ({ type: "customer", id: customer._id }))
                ],
                customers: customersFromX2[index]
              })),
              customers: customersFromX2.flat()
            };
          }));
          break;

        case 'x2':
          devicesWithTopology = await Promise.all(devices.map(async (x2: any) => {
            const customers = await UserModel.find({
              role: "user",
              "networkInput.type": "x2",
              "networkInput.id": x2.x2Id
            });

            let inputDevice = null;
            if (x2.input && x2.input.type && x2.input.id) {
              if (x2.input.type === "olt") {
                inputDevice = await OLTModel.findOne({ oltId: x2.input.id });
              } else if (x2.input.type === "ms") {
                inputDevice = await MSModel.findOne({ msId: x2.input.id });
              } else if (x2.input.type === "subms") {
                inputDevice = await SUBMSModel.findOne({ submsId: x2.input.id });
              } else if (x2.input.type === "fdb") {
                inputDevice = await FDBModel.findOne({ fdbId: x2.input.id });
              }
            }

            return {
              ...x2.toObject(),
              input_device: inputDevice,
              outputs: [
                ...customers.map(customer => ({ type: "customer", id: customer._id, data: customer }))
              ],
              customers: customers
            };
          }));
          break;
      }

      result = {
        type,
        typeName,
        count: devicesWithTopology.length,
        data: devicesWithTopology
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

  } catch (error: any) {
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

export const fdbInput = async (req: Request, res: Response): Promise<any> => {
  try {
    const companyId = req.params.companyId;

    const [olt, ms, subms] = await Promise.all([
      OLTModel.find({ ownedBy: companyId }).populate("_id name oltIp macAddress serialNumber oltType oltPower oltId"),
      MSModel.find({ ownedBy: companyId }).populate("_id msName msType msId"),
      SUBMSModel.find({ ownedBy: companyId }).populate("_id submsName submsType submsId")
    ]);

    // Add type key for each device and calculate available slots
    const processedOlt = olt.map(oltDevice => {
      const availableSlots = calculateAvailableSlots(oltDevice);
      // Calculate totalPorts using the same logic as calculateAvailableSlots
      let totalPorts = oltDevice.totalPorts || 0;
      if (totalPorts === 0) {
        if (oltDevice.oltType === "epon") {
          totalPorts = 8;
        } else if (oltDevice.oltType === "gpon") {
          totalPorts = 16;
        } else if (oltDevice.oltType === "xgpon" || oltDevice.oltType === "xgspon") {
          totalPorts = 16;
        }
      }

      return {
        ...oltDevice.toObject(),
        type: "olt",
        availableSlots: availableSlots,
        deviceInfo: {
          id: oltDevice.oltId || oltDevice._id,
          name: oltDevice.name,
          type: oltDevice.oltType,
          power: oltDevice.oltPower,
          totalPorts: totalPorts,
          activePorts: oltDevice.activePorts || 0,
          availablePorts: availableSlots
        }
      };
    });

    const processedMS = ms.map(msDevice => {
      const availableSlots = calculateAvailableSlots(msDevice);
      // Calculate totalPorts using the same logic as calculateAvailableSlots
      let totalPorts = msDevice.totalPorts || 0;
      if (totalPorts === 0) {
        if (msDevice.msType === "1x8") {
          totalPorts = 8;
        } else if (msDevice.msType === "1x16") {
          totalPorts = 16;
        } else if (msDevice.msType === "1x32") {
          totalPorts = 32;
        }
      }

      return {
        ...msDevice.toObject(),
        type: "ms",
        availableSlots: availableSlots,
        deviceInfo: {
          id: msDevice.msId || msDevice._id,
          name: msDevice.msName,
          type: msDevice.msType,
          power: msDevice.msType,
          totalPorts: totalPorts,
          activePorts: msDevice.activePorts || 0,
          availablePorts: availableSlots
        }
      };
    });

    const processedSUBMS = subms.map(submsDevice => {
      const availableSlots = calculateAvailableSlots(submsDevice);
      // Calculate totalPorts using the same logic as calculateAvailableSlots
      let totalPorts = submsDevice.totalPorts || 0;
      if (totalPorts === 0) {
        if (submsDevice.submsType === "1x4") {
          totalPorts = 4;
        } else if (submsDevice.submsType === "1x8") {
          totalPorts = 8;
        } else if (submsDevice.submsType === "1x16") {
          totalPorts = 16;
        }
      }

      return {
        ...submsDevice.toObject(),
        type: "subms",
        availableSlots: availableSlots,
        deviceInfo: {
          id: submsDevice.submsId || submsDevice._id,
          name: submsDevice.submsName,
          type: submsDevice.submsType,
          power: submsDevice.submsType,
          totalPorts: totalPorts,
          activePorts: submsDevice.activePorts || 0,
          availablePorts: availableSlots
        }
      };
    });

    // Combine all devices for FDB input analysis with proper type mapping
    const allDevices = [
      ...processedOlt.map(olt => ({ ...olt, deviceType: "olt" })),
      ...processedMS.map(ms => ({ ...ms, deviceType: "ms" })),
      ...processedSUBMS.map(subms => ({ ...subms, deviceType: "subms" }))
    ];

    // Calculate total capacity and utilization
    const totalCapacity = allDevices.reduce((sum, device) => sum + (device.deviceInfo.totalPorts || 0), 0);
    const totalActive = allDevices.reduce((sum, device) => sum + (device.deviceInfo.activePorts || 0), 0);
    const totalAvailable = allDevices.reduce((sum, device) => sum + (device.deviceInfo.availablePorts || 0), 0);
    const utilizationPercentage = totalCapacity > 0 ? Math.round((totalActive / totalCapacity) * 100) : 0;

    // Group devices by type for better organization
    const devicesByType = {
      olt: processedOlt,
      ms: processedMS,
      subms: processedSUBMS
    };

    // Find devices with available slots for FDB connections
    const devicesWithAvailableSlots = allDevices.filter(device =>
      device.deviceInfo.availablePorts > 0
    );

    // Calculate FDB input recommendations
    const fdbInputRecommendations = calculateFDBInputRecommendations(allDevices);

    const result = {
      success: true,
      message: "FDB input analysis completed successfully",
      data: {
        summary: {
          totalDevices: allDevices.length,
          totalCapacity,
          totalActive,
          totalAvailable,
          utilizationPercentage,
          devicesByType: {
            olt: processedOlt.length,
            ms: processedMS.length,
            subms: processedSUBMS.length
          }
        },
        devices: {
          olt: processedOlt,
          ms: processedMS,
          subms: processedSUBMS
        },
        devicesByType,
        devicesWithAvailableSlots,
        fdbInputRecommendations,
        combinedData: allDevices.map(device => {
          const deviceAny = device as any;
          const deviceType = deviceAny.deviceType || device.type;

          // Base device data
          const baseDevice = {
            _id: device._id,
            type: deviceType,
            deviceInfo: device.deviceInfo,
            availableSlots: device.availableSlots,
            status: device.status,
            powerStatus: device.powerStatus,
            latitude: device.latitude,
            longitude: device.longitude,
            location: device.location,
            ownedBy: device.ownedBy,
            createdAt: device.createdAt,
            updatedAt: device.updatedAt,
            outputs: device.outputs || []
          };

          // Add device-specific fields based on type
          if (deviceType === "olt") {
            return {
              ...baseDevice,
              name: deviceAny.name,
              oltId: deviceAny.oltId,
              oltIp: deviceAny.oltIp,
              macAddress: deviceAny.macAddress,
              serialNumber: deviceAny.serialNumber,
              oltType: deviceAny.oltType,
              oltPower: deviceAny.oltPower,
              dnsServers: deviceAny.dnsServers || [],
              attachments: deviceAny.attachments || []
            };
          } else if (deviceType === "ms") {
            return {
              ...baseDevice,
              msName: deviceAny.msName,
              msId: deviceAny.msId,
              msType: deviceAny.msType,
              msPower: deviceAny.msType,
              input: deviceAny.input,
              addedBy: deviceAny.addedBy,
              attachments: deviceAny.attachments || []
            };
          } else if (deviceType === "subms") {
            return {
              ...baseDevice,
              submsName: deviceAny.submsName,
              submsId: deviceAny.submsId,
              submsType: deviceAny.submsType,
              input: deviceAny.input,
              attachments: deviceAny.attachments || []
            };
          }

          return baseDevice;
        })
      }
    };

    res.status(200).json(result);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching fdb input",
      error: error.message
    });
  }
};

// Helper function to calculate available slots for a device
const calculateAvailableSlots = (device: any): number => {
  let totalPorts = device.totalPorts || 0;
  const activePorts = device.activePorts || 0;

  // If totalPorts is not set, try to infer from device type/model
  if (totalPorts === 0) {
    if (device.type === "olt" || device.oltType) {
      // For OLT devices, infer ports based on type or model
      if (device.oltType === "epon") {
        totalPorts = 8; // Most EPON OLTs have 8 ports
      } else if (device.oltType === "gpon") {
        totalPorts = 16; // Most GPON OLTs have 16 ports
      } else if (device.oltType === "xgpon" || device.oltType === "xgspon") {
        totalPorts = 16; // XG-PON typically has 16 ports
      }
    } else if (device.type === "ms" || device.msType) {
      // For MS devices, infer from msType
      if (device.msType === "1x8") {
        totalPorts = 8;
      } else if (device.msType === "1x16") {
        totalPorts = 16;
      } else if (device.msType === "1x32") {
        totalPorts = 32;
      }
    } else if (device.type === "subms" || device.submsType) {
      // For SUBMS devices, infer from submsType
      if (device.submsType === "1x4") {
        totalPorts = 4;
      } else if (device.submsType === "1x8") {
        totalPorts = 8;
      } else if (device.submsType === "1x16") {
        totalPorts = 16;
      }
    }
  }

  // Always calculate based on totalPorts - activePorts
  return Math.max(0, totalPorts - activePorts);
};

// Helper function to calculate FDB input recommendations
const calculateFDBInputRecommendations = (allDevices: any[]): {
  bestOLTConnections: Array<{
    deviceId: any;
    deviceName: any;
    availablePorts: any;
    recommendation: string;
  }>;
  bestMSConnections: Array<{
    deviceId: any;
    deviceName: any;
    availablePorts: any;
    recommendation: string;
  }>;
  bestSUBMSConnections: Array<{
    deviceId: any;
    deviceName: any;
    availablePorts: any;
    recommendation: string;
  }>;
  optimalPath: Array<{
    stage: number;
    deviceType: string;
    deviceId: any;
    deviceName: any;
    availablePorts: any;
  }>;
} => {
  const recommendations = {
    bestOLTConnections: [] as Array<{
      deviceId: any;
      deviceName: any;
      availablePorts: any;
      recommendation: string;
    }>,
    bestMSConnections: [] as Array<{
      deviceId: any;
      deviceName: any;
      availablePorts: any;
      recommendation: string;
    }>,
    bestSUBMSConnections: [] as Array<{
      deviceId: any;
      deviceName: any;
      availablePorts: any;
      recommendation: string;
    }>,
    optimalPath: [] as Array<{
      stage: number;
      deviceType: string;
      deviceId: any;
      deviceName: any;
      availablePorts: any;
    }>
  };

  // Find OLTs with most available ports for primary connections
  const oltDevices = allDevices.filter(device => device.type === "olt");
  const bestOLTs = oltDevices
    .sort((a, b) => (b.deviceInfo.availablePorts || 0) - (a.deviceInfo.availablePorts || 0))
    .slice(0, 3);

  recommendations.bestOLTConnections = bestOLTs.map(olt => ({
    deviceId: olt.deviceInfo.id,
    deviceName: olt.deviceInfo.name,
    availablePorts: olt.deviceInfo.availablePorts,
    recommendation: "Primary FDB connection point"
  }));

  // Find MS devices with available ports for secondary connections
  const msDevices = allDevices.filter(device => device.type === "ms");
  const bestMS = msDevices
    .sort((a, b) => (b.deviceInfo.availablePorts || 0) - (a.deviceInfo.availablePorts || 0))
    .slice(0, 5);

  recommendations.bestMSConnections = bestMS.map(ms => ({
    deviceId: ms.deviceInfo.id,
    deviceName: ms.deviceInfo.name,
    availablePorts: ms.deviceInfo.availablePorts,
    recommendation: "Secondary FDB connection point"
  }));

  // Find SUBMS devices with available ports for tertiary connections
  const submsDevices = allDevices.filter(device => device.type === "subms");
  const bestSUBMS = submsDevices
    .sort((a, b) => (b.deviceInfo.availablePorts || 0) - (a.deviceInfo.availablePorts || 0))
    .slice(0, 5);

  recommendations.bestSUBMSConnections = bestSUBMS.map(subms => ({
    deviceId: subms.deviceInfo.id,
    deviceName: subms.deviceInfo.name,
    availablePorts: subms.deviceInfo.availablePorts,
    recommendation: "Tertiary FDB connection point"
  }));

  // Calculate optimal path for FDB input
  if (bestOLTs.length > 0 && bestMS.length > 0) {
    const pathItem1 = {
      stage: 1,
      deviceType: "olt",
      deviceId: bestOLTs[0].deviceInfo.id,
      deviceName: bestOLTs[0].deviceInfo.name,
      availablePorts: bestOLTs[0].deviceInfo.availablePorts
    };

    const pathItem2 = {
      stage: 2,
      deviceType: "ms",
      deviceId: bestMS[0].deviceInfo.id,
      deviceName: bestMS[0].deviceInfo.name,
      availablePorts: bestMS[0].deviceInfo.availablePorts
    };

    recommendations.optimalPath = [pathItem1, pathItem2];

    if (bestSUBMS.length > 0) {
      const pathItem3 = {
        stage: 3,
        deviceType: "subms",
        deviceId: bestSUBMS[0].deviceInfo.id,
        deviceName: bestSUBMS[0].deviceInfo.name,
        availablePorts: bestSUBMS[0].deviceInfo.availablePorts
      };
      recommendations.optimalPath.push(pathItem3);
    }
  }

  return recommendations;
};


export const getAllOltTOAdminPanel = async (req: Request, res: Response): Promise<any> => {
  try {
    const ownerId = (req as any).userId;

    // Get all OLTs for the owner
    const olts = await OLTModel.find({ ownedBy: ownerId }).sort({ createdAt: -1 });

    // Get detailed information for each OLT including connected devices
    const detailedOlts = await Promise.all(olts.map(async (olt) => {
      // Get MS devices connected to this OLT
      const msDevices = await MSModel.find({
        "input.id": olt.oltId,
        ownedBy: ownerId
      }).select('msId msName msType location input outputs latitude longitude');

      // Get FDB devices connected to this OLT
      const fdbDevices = await FDBModel.find({
        "input.id": olt.oltId,
        ownedBy: ownerId
      }).select('fdbId fdbName fdbPower location input outputs latitude longitude');

      // Get SUBMS devices connected to MS devices (find all SUBMS that have MS devices as input)
      const msIds = msDevices.map(ms => ms.msId);
      const submsDevices = await SUBMSModel.find({
        "input.type": "ms",
        "input.id": { $in: msIds },
        ownedBy: ownerId
      }).select('submsId submsName submsType location input outputs latitude longitude');

      // Get X2 devices connected to FDB devices (find all X2 that have FDB devices as input)
      const fdbIds = fdbDevices.map(fdb => fdb.fdbId);
      const x2Devices = await X2Model.find({
        "input.type": "fdb",
        "input.id": { $in: fdbIds },
        ownedBy: ownerId
      }).select('x2Id x2Name x2Power location input outputs latitude longitude');

      // Get owner details
      const owner = await UserModel.findById(olt.ownedBy).select('email');

      // Calculate OLT ports based on oltPower and actual connected devices
      const oltTotalPorts = olt.oltPower || 0;
      const oltActivePorts = msDevices.length + fdbDevices.length; // Count actual connected MS and FDB devices
      const oltAvailablePorts = Math.max(0, oltTotalPorts - oltActivePorts);

      // Create detailed OLT object
      const detailedOlt = {
        _id: olt._id,
        oltIp: olt.oltIp,
        macAddress: olt.macAddress,
        serialNumber: olt.serialNumber,
        latitude: olt.latitude,
        longitude: olt.longitude,
        oltType: olt.oltType,
        powerStatus: olt.powerStatus,
        oltPower: olt.oltPower,
        status: olt.status,
        dnsServers: olt.dnsServers || [],
        ownedBy: {
          _id: owner?._id,
          email: owner?.email
        },
        attachments: olt.attachments || [],
        outputs: olt.outputs || [],
        createdAt: olt.createdAt,
        updatedAt: olt.updatedAt,
        oltId: olt.oltId,
        location: olt.location,
        __v: olt.__v,
        name: olt.name,
        totalPorts: oltTotalPorts,
        activePorts: oltActivePorts,
        availablePorts: oltAvailablePorts,
        ms_devices: msDevices.map(ms => {
          // Calculate MS ports based on msType (1x2=2, 1x4=4, 1x8=8, 1x16=16, 1x32=32, 1x64=64)
          let msTotalPorts = 0;
          switch (ms.msType) {
            case "1x2": msTotalPorts = 2; break;
            case "1x4": msTotalPorts = 4; break;
            case "1x8": msTotalPorts = 8; break;
            case "1x16": msTotalPorts = 16; break;
            case "1x32": msTotalPorts = 32; break;
            case "1x64": msTotalPorts = 64; break;
            default: msTotalPorts = 0;
          }

          // Count SUBMS devices connected to this MS
          const connectedSubms = submsDevices.filter(subms => subms.input.id === ms.msId);
          const msActivePorts = connectedSubms.length;
          const msAvailablePorts = Math.max(0, msTotalPorts - msActivePorts);

          return {
            ms_id: ms.msId,
            ms_name: ms.msName,
            ms_type: ms.msType,
            location: ms.location?.coordinates ? [ms.location.coordinates[1], ms.location.coordinates[0]] : [ms.latitude, ms.longitude],
            input: {
              type: ms.input.type,
              id: ms.input.id
            },
            outputs: ms.outputs || [],
            totalPorts: msTotalPorts,
            activePorts: msActivePorts,
            availablePorts: msAvailablePorts
          };
        }),
        fdb_devices: fdbDevices.map(fdb => {
          // Calculate FDB ports based on fdbPower (power = total ports)
          const fdbTotalPorts = fdb.fdbPower || 0;

          // Count X2 devices connected to this FDB
          const connectedX2s = x2Devices.filter(x2 => x2.input.id === fdb.fdbId);
          const fdbActivePorts = connectedX2s.length;
          const fdbAvailablePorts = Math.max(0, fdbTotalPorts - fdbActivePorts);

          return {
            fdb_id: fdb.fdbId,
            fdb_name: fdb.fdbName,
            fdb_power: fdb.fdbPower,
            location: fdb.location?.coordinates ? [fdb.location.coordinates[1], fdb.location.coordinates[0]] : [fdb.latitude, fdb.longitude],
            input: {
              type: fdb.input.type,
              id: fdb.input.id
            },
            outputs: fdb.outputs || [],
            totalPorts: fdbTotalPorts,
            activePorts: fdbActivePorts,
            availablePorts: fdbAvailablePorts
          };
        }),
        subms_devices: submsDevices.map(subms => {
          // Calculate SUBMS ports based on submsType (1x2=2, 1x4=4, 1x8=8, 1x16=16, 1x32=32)
          let submsTotalPorts = 0;
          switch (subms.submsType) {
            case "1x2": submsTotalPorts = 2; break;
            case "1x4": submsTotalPorts = 4; break;
            case "1x8": submsTotalPorts = 8; break;
            case "1x16": submsTotalPorts = 16; break;
            case "1x32": submsTotalPorts = 32; break;
            default: submsTotalPorts = 0;
          }

          // Count actual outputs (connected devices) for SUBMS
          const submsActivePorts = subms.outputs ? subms.outputs.length : 0;
          const submsAvailablePorts = Math.max(0, submsTotalPorts - submsActivePorts);

          return {
            subms_id: subms.submsId,
            subms_name: subms.submsName,
            subms_type: subms.submsType,
            location: subms.location?.coordinates ? [subms.location.coordinates[1], subms.location.coordinates[0]] : [subms.latitude, subms.longitude],
            input: {
              type: subms.input.type,
              id: subms.input.id
            },
            outputs: subms.outputs || [],
            totalPorts: submsTotalPorts,
            activePorts: submsActivePorts,
            availablePorts: submsAvailablePorts
          };
        }),
        x2_devices: x2Devices.map(x2 => {
          // Calculate X2 ports based on x2Power (power = total ports)
          const x2TotalPorts = x2.x2Power || 0;

          // Count actual outputs (connected devices/customers) for X2
          const x2ActivePorts = x2.outputs ? x2.outputs.length : 0;
          const x2AvailablePorts = Math.max(0, x2TotalPorts - x2ActivePorts);

          return {
            x2_id: x2.x2Id,
            x2_name: x2.x2Name,
            x2_power: x2.x2Power,
            location: x2.location?.coordinates ? [x2.location.coordinates[1], x2.location.coordinates[0]] : [x2.latitude, x2.longitude],
            input: {
              type: x2.input.type,
              id: x2.input.id
            },
            outputs: x2.outputs || [],
            totalPorts: x2TotalPorts,
            activePorts: x2ActivePorts,
            availablePorts: x2AvailablePorts
          };
        })
      };

      return detailedOlt;
    }));

    res.status(200).json({
      success: true,
      message: "OLTs fetched successfully with detailed information",
      data: detailedOlts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching OLTs to admin panel",
      error: error.message
    });
  }
}


export const selectNodeAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const companyId = (req as any).userId;

    const olts = await OLTModel.find({
      ownedBy: companyId
    }).populate('ownedBy', 'name email company');

    // For each OLT, get all connected devices with simplified topology
    const oltsWithTopology = await Promise.all(olts.map(async (olt) => {
      // Get all connected devices
      const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
        MSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        FDBModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        SUBMSModel.find({
          "input.type": "olt",
          "input.id": olt.oltId
        }),
        X2Model.find({
          "input.type": "olt",
          "input.id": olt.oltId
        })
      ]);

      // Build simplified topology for MS devices
      const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
        // Get SUBMS devices connected to this MS
        const connectedSUBMS = await SUBMSModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });
        //get FDB devices connected to this MS
        const connectedFDB = await FDBModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });

        return {
          ms_id: ms.msId,
          ms_name: ms.msName,
          ms_power: ms.msType || 0,
          location: [ms.latitude, ms.longitude],
          input: { type: "olt", id: olt.oltId },
          attachments: ms.attachments,
          outputs: [
            ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
            ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
          ]
        };
      }));

      // Get all FDB devices connected to any MS of this OLT
      const allConnectedFDB = await Promise.all(connectedMS.map(async (ms) => {
        const connectedFDB = await FDBModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });
        return connectedFDB;
      }));
      const flattenedFDB = allConnectedFDB.flat();

      // Get all SUBMS devices connected to any MS of this OLT
      const allConnectedSUBMS = await Promise.all(connectedMS.map(async (ms) => {
        const connectedSUBMS = await SUBMSModel.find({
          "input.type": "ms",
          "input.id": ms.msId
        });
        return connectedSUBMS;
      }));
      const flattenedSUBMS = allConnectedSUBMS.flat();

      // Get all FDB devices connected to SUBMS devices
      const allConnectedFDBFromSUBMS = await Promise.all(flattenedSUBMS.map(async (subms) => {
        const connectedFDB = await FDBModel.find({
          "input.type": "subms",
          "input.id": subms.submsId
        });
        return connectedFDB;
      }));
      const flattenedFDBFromSUBMS = allConnectedFDBFromSUBMS.flat();

      // Build simplified topology for FDB devices (both direct OLT connections, MS connections, and SUBMS connections)
      const fdbWithTopology = await Promise.all([...connectedFDB, ...flattenedFDB, ...flattenedFDBFromSUBMS].map(async (fdb) => {
        // Get X2 devices connected to this FDB
        const connectedX2 = await X2Model.find({
          "input.type": "fdb",
          "input.id": fdb.fdbId
        })
        return {
          fdb_id: fdb.fdbId,
          fdb_name: fdb.fdbName,
          fdb_power: fdb.fdbPower || 0,
          location: [fdb.latitude, fdb.longitude],
          input: fdb.input, // Keep the original input (either "olt", "ms", or "subms")
          attachments: fdb.attachments,
          outputs: [
            ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
          ]
        };
      }));

      // Build simplified topology for SUBMS devices
      const submsWithTopology = await Promise.all(flattenedSUBMS.map(async (subms) => {
        const connectedFDB = await FDBModel.find({
          "input.type": "subms",
          "input.id": subms.submsId
        });
        return {
          subms_id: subms.submsId,
          subms_name: subms.submsName,
          subms_power: subms.submsType || 0,
          location: [subms.latitude, subms.longitude],
          input: { type: "ms", id: subms.input.id },
          attachments: subms.attachments,
          outputs: [
            ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
          ]
        };
      }));

      // Get all X2 devices connected to any FDB of this OLT (both direct, MS-connected, and SUBMS-connected FDBs)
      const allConnectedX2 = await Promise.all([...connectedFDB, ...flattenedFDB, ...flattenedFDBFromSUBMS].map(async (fdb) => {
        const connectedX2 = await X2Model.find({
          "input.type": "fdb",
          "input.id": fdb.fdbId
        });
        return connectedX2;
      }));
      const flattenedX2 = allConnectedX2.flat();

      // Build simplified topology for X2 devices
      const x2WithTopology = await Promise.all(flattenedX2.map(async (x2) => {
        return {
          x2_id: x2.x2Id,
          x2_name: x2.x2Name,
          x2_power: x2.x2Power || 0,
          location: [x2.latitude, x2.longitude],
          input: { type: "fdb", id: x2.input.id },
          attachments: x2.attachments,
          outputs: []
        };
      }));

      console.log("fdbWithTopology", fdbWithTopology);


      return {
        ...olt.toObject(),
        outputs: [
          ...connectedMS.map(ms => ({ type: "ms", id: ms.msId })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId })),
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
        ],
        // Include simplified topology data for each device type
        ms_devices: msWithTopology,
        fdb_devices: fdbWithTopology,
        subms_devices: submsWithTopology,
        x2_devices: x2WithTopology
      };
    }));

    res.status(200).json({
      success: true,
      count: oltsWithTopology.length,
      data: oltsWithTopology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getOLTByOLTIdForEngineer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { oltId } = req.params;

    const olt = await OLTModel.findOne({
      oltId: oltId,
    }).populate('ownedBy', 'name email company');

    if (!olt) {
      return res.status(404).json({
        success: false,
        message: "OLT not found"
      });
    }

    // Get all connected devices
    const [connectedMS, connectedFDB, connectedSUBMS, connectedX2] = await Promise.all([
      MSModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      }),
      FDBModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      }),
      SUBMSModel.find({
        "input.type": "olt",
        "input.id": olt.oltId
      }),
      X2Model.find({
        "input.type": "olt",
        "input.id": olt.oltId
      })
    ]);

    // Build simplified topology for MS devices
    const msWithTopology = await Promise.all(connectedMS.map(async (ms) => {
      // Get SUBMS devices connected to this MS
      const connectedSUBMS = await SUBMSModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });
      //get FDB devices connected to this MS
      const connectedFDB = await FDBModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });

      return {
        ms_id: ms.msId,
        ms_name: ms.msName,
        ms_power: ms.msType || 0,
        location: [ms.latitude, ms.longitude],
        input: { type: "olt", id: olt.oltId },
        attachments: ms.attachments,
        outputs: [
          ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
        ]
      };
    }));

    // Get all FDB devices connected to any MS of this OLT
    const allConnectedFDB = await Promise.all(connectedMS.map(async (ms) => {
      const connectedFDB = await FDBModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });
      return connectedFDB;
    }));
    const flattenedFDB = allConnectedFDB.flat();

    // Get all SUBMS devices connected to any MS of this OLT
    const allConnectedSUBMS = await Promise.all(connectedMS.map(async (ms) => {
      const connectedSUBMS = await SUBMSModel.find({
        "input.type": "ms",
        "input.id": ms.msId
      });
      return connectedSUBMS;
    }));
    const flattenedSUBMS = allConnectedSUBMS.flat();

    // Get all FDB devices connected to SUBMS devices
    const allConnectedFDBFromSUBMS = await Promise.all(flattenedSUBMS.map(async (subms) => {
      const connectedFDB = await FDBModel.find({
        "input.type": "subms",
        "input.id": subms.submsId
      });
      return connectedFDB;
    }));
    const flattenedFDBFromSUBMS = allConnectedFDBFromSUBMS.flat();

    // Build simplified topology for FDB devices (both direct OLT connections, MS connections, and SUBMS connections)
    const fdbWithTopology = await Promise.all([...connectedFDB, ...flattenedFDB, ...flattenedFDBFromSUBMS].map(async (fdb) => {
      // Get X2 devices connected to this FDB
      const connectedX2 = await X2Model.find({
        "input.type": "fdb",
        "input.id": fdb.fdbId
      })
      return {
        fdb_id: fdb.fdbId,
        fdb_name: fdb.fdbName,
        fdb_power: fdb.fdbPower || 0,
        location: [fdb.latitude, fdb.longitude],
        input: fdb.input, // Keep the original input (either "olt", "ms", or "subms")
        attachments: fdb.attachments,
        outputs: [
          ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
        ]
      };
    }));

    // Build simplified topology for SUBMS devices
    const submsWithTopology = await Promise.all(flattenedSUBMS.map(async (subms) => {
      const connectedFDB = await FDBModel.find({
        "input.type": "subms",
        "input.id": subms.submsId
      });
      return {
        subms_id: subms.submsId,
        subms_name: subms.submsName,
        subms_power: subms.submsType || 0,
        location: [subms.latitude, subms.longitude],
        input: { type: "ms", id: subms.input.id },
        attachments: subms.attachments,
        outputs: [
          ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId }))
        ]
      };
    }));

    // Get all X2 devices connected to any FDB of this OLT (both direct, MS-connected, and SUBMS-connected FDBs)
    const allConnectedX2 = await Promise.all([...connectedFDB, ...flattenedFDB, ...flattenedFDBFromSUBMS].map(async (fdb) => {
      const connectedX2 = await X2Model.find({
        "input.type": "fdb",
        "input.id": fdb.fdbId
      });
      return connectedX2;
    }));
    const flattenedX2 = allConnectedX2.flat();

    // Build simplified topology for X2 devices
    const x2WithTopology = await Promise.all(flattenedX2.map(async (x2) => {
      return {
        x2_id: x2.x2Id,
        x2_name: x2.x2Name,
        x2_power: x2.x2Power || 0,
        location: [x2.latitude, x2.longitude],
        input: { type: "fdb", id: x2.input.id },
        attachments: x2.attachments,
        outputs: []
      };
    }));

    const oltWithTopology = {
      ...olt.toObject(),
      outputs: [
        ...connectedMS.map(ms => ({ type: "ms", id: ms.msId })),
        ...connectedFDB.map(fdb => ({ type: "fdb", id: fdb.fdbId })),
        ...connectedSUBMS.map(subms => ({ type: "subms", id: subms.submsId })),
        ...connectedX2.map(x2 => ({ type: "x2", id: x2.x2Id }))
      ],
      // Include simplified topology data for each device type
      ms_devices: msWithTopology,
      fdb_devices: fdbWithTopology,
      subms_devices: submsWithTopology,
      x2_devices: x2WithTopology
    };

    res.status(200).json({
      success: true,
      data: oltWithTopology
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching OLT by OLT ID",
      error: error.message
    });
  }
};
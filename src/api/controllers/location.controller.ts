import { Request, Response } from "express";
import mongoose from "mongoose";
import { OLTModel } from "../models/olt.model";
import { MSModel } from "../models/ms.model";
import { SUBMSModel } from "../models/subms.model";
import { FDBModel } from "../models/fdb.model";
import { X2Model } from "../models/x2.model";

/**
 * Get all locations for a specific owner
 * Returns all OLT, MS, SUBMS, FDB, X2, and customer locations
 * @param req - Express request object
 * @param res - Express response object
 */
const getAllLocations = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ownerId } = req.params;

    // Validate ownerId
    if (!ownerId) {
      return res.status(400).json({
        success: false,
        message: "Owner ID is required"
      });
    }

    // Validate if ownerId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Owner ID format"
      });
    }

    // Fetch all network components for the owner
    const [olts, msList, submsList, fdbList, x2List] = await Promise.all([
      // Get all OLTs
      OLTModel.find({ ownedBy: ownerId })
        .select('_id latitude longitude')
        .lean(),

      // Get all MS (Main Splitters)
      MSModel.find({ ownedBy: ownerId })
        .select('_id latitude longitude')
        .lean(),

      // Get all SUBMS (Sub Splitters)
      SUBMSModel.find({ ownedBy: ownerId })
        .select('_id latitude longitude')
        .lean(),

      // Get all FDBs (Fiber Distribution Boxes)
      FDBModel.find({ ownedBy: ownerId })
        .select('_id latitude longitude')
        .lean(),

      // Get all X2s (Terminal Points)
      X2Model.find({ ownedBy: ownerId })
        .select('_id latitude longitude')
        .lean()
    ]);

    // Process and format the data
    const formattedData = {
      olt: olts.map(olt => ({
        _id: olt._id,
        latitude: olt.latitude,
        longitude: olt.longitude
      })),

      ms: msList.map(ms => ({
        _id: ms._id,
        latitude: ms.latitude,
        longitude: ms.longitude
      })),

      subms: submsList.map(subms => ({
        _id: subms._id,
        latitude: subms.latitude,
        longitude: subms.longitude
      })),

      fdb: fdbList.map(fdb => ({
        _id: fdb._id,
        latitude: fdb.latitude,
        longitude: fdb.longitude
      })),

      x2: x2List.map(x2 => ({
        _id: x2._id,
        latitude: x2.latitude,
        longitude: x2.longitude
      })),

      // Customers array is empty for now as requested
      customers: []
    };

    // Calculate summary statistics
    const summary = {
      totalDevices: olts.length + msList.length + submsList.length + fdbList.length + x2List.length,
      oltCount: olts.length,
      msCount: msList.length,
      submsCount: submsList.length,
      fdbCount: fdbList.length,
      x2Count: x2List.length,
      customerCount: 0
    };

    return res.status(200).json({
      success: true,
      message: "All locations retrieved successfully",
      data: formattedData,
      summary,
      ownerId
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching locations",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

/**
 * Get locations with additional filtering options
 * @param req - Express request object
 * @param res - Express response object
 */
const getLocationsWithFilters = async (req: Request, res: Response): Promise<any> => {
  try {
    const { ownerId } = req.params;
    const { 
      deviceType, 
      status, 
      powerStatus, 
      city, 
      state,
      hasCoordinates 
    } = req.query;

    // Validate ownerId
    if (!ownerId) {
      return res.status(400).json({
        success: false,
        message: "Owner ID is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Owner ID format"
      });
    }

    // Build filter object
    const baseFilter: any = { ownedBy: ownerId };
    
    if (status) baseFilter.status = status;
    if (powerStatus) baseFilter.powerStatus = powerStatus;
    if (city) baseFilter.city = { $regex: city, $options: 'i' };
    if (state) baseFilter.state = { $regex: state, $options: 'i' };
    if (hasCoordinates === 'true') {
      baseFilter.$and = [
        { latitude: { $exists: true, $ne: null } },
        { longitude: { $exists: true, $ne: null } }
      ];
    }

    // Apply device type filter if specified
    let olts: any[] = [], msList: any[] = [], submsList: any[] = [], fdbList: any[] = [], x2List: any[] = [];

    if (!deviceType || deviceType === 'all') {
      // Fetch all types
      [olts, msList, submsList, fdbList, x2List] = await Promise.all([
        OLTModel.find(baseFilter).select('_id latitude longitude').lean(),
        MSModel.find(baseFilter).select('_id latitude longitude').lean(),
        SUBMSModel.find(baseFilter).select('_id latitude longitude').lean(),
        FDBModel.find(baseFilter).select('_id latitude longitude').lean(),
        X2Model.find(baseFilter).select('_id latitude longitude').lean()
      ]);
    } else {
      // Fetch specific device type
      switch (deviceType) {
        case 'olt':
          olts = await OLTModel.find(baseFilter).select('_id latitude longitude').lean();
          break;
        case 'ms':
          msList = await MSModel.find(baseFilter).select('_id latitude longitude').lean();
          break;
        case 'subms':
          submsList = await SUBMSModel.find(baseFilter).select('_id latitude longitude').lean();
          break;
        case 'fdb':
          fdbList = await FDBModel.find(baseFilter).select('_id latitude longitude').lean();
          break;
        case 'x2':
          x2List = await X2Model.find(baseFilter).select('_id latitude longitude').lean();
          break;
      }
    }

    // Format data (same as getAllLocations)
    const formattedData = {
      olt: olts.map(olt => ({
        _id: olt._id,
        latitude: olt.latitude,
        longitude: olt.longitude
      })),

      ms: msList.map(ms => ({
        _id: ms._id,
        latitude: ms.latitude,
        longitude: ms.longitude
      })),

      subms: submsList.map(subms => ({
        _id: subms._id,
        latitude: subms.latitude,
        longitude: subms.longitude
      })),

      fdb: fdbList.map(fdb => ({
        _id: fdb._id,
        latitude: fdb.latitude,
        longitude: fdb.longitude
      })),

      x2: x2List.map(x2 => ({
        _id: x2._id,
        latitude: x2.latitude,
        longitude: x2.longitude
      })),

      customers: []
    };

    const summary = {
      totalDevices: olts.length + msList.length + submsList.length + fdbList.length + x2List.length,
      oltCount: olts.length,
      msCount: msList.length,
      submsCount: submsList.length,
      fdbCount: fdbList.length,
      x2Count: x2List.length,
      customerCount: 0
    };

    return res.status(200).json({
      success: true,
      message: "Filtered locations retrieved successfully",
      data: formattedData,
      summary,
      filters: {
        deviceType: deviceType || 'all',
        status,
        powerStatus,
        city,
        state,
        hasCoordinates
      },
      ownerId
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching filtered locations",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export { getAllLocations, getLocationsWithFilters };

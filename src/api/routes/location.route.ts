import { Router } from "express";
import { getAllLocations, getLocationsWithFilters } from "../controllers/location.controller";
// import { authenticateToken } from "../../middleware/auth.middleware";

const locationRouter = Router();

/**
 * @route   GET /api/locations/:ownerId
 * @desc    Get all locations for a specific owner
 * @access  Private (requires authentication)
 * @param   ownerId - The ID of the owner/company
 */
locationRouter.get("/:ownerId", getAllLocations);

/**
 * @route   GET /api/locations/:ownerId/filtered
 * @desc    Get locations with additional filtering options
 * @access  Private (requires authentication)
 * @param   ownerId - The ID of the owner/company
 * @query   deviceType - Filter by device type (olt, ms, subms, fdb, x2, all)
 * @query   status - Filter by device status
 * @query   powerStatus - Filter by power status
 * @query   city - Filter by city (case-insensitive)
 * @query   state - Filter by state (case-insensitive)
 * @query   hasCoordinates - Filter devices with coordinates (true/false)
 */
locationRouter.get("/:ownerId/filtered", getLocationsWithFilters);

export default locationRouter;

import { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import Product from '../models/product.model';
import Order from '../models/order.model';
import { CategoryModel } from '../models/category.model';
import { Role, UserModel } from '../models/user.model';
import { IptvPlan } from '../models/iptvPlan.model';
import { OttPlan } from '../models/ottPlan.model';
import { Plan } from '../models/plan.model';
import { sendSuccess, sendError, generateOtp, hashPassword, generateRandomPassword, sendMessage, generateEngineerCredentialsEmail, generateUserCredentialsEmail } from '../../utils/helper';
import { ComplaintModel, ComplaintStatus } from '../models/complaint.model';
import { EngineerAttendanceModel } from '../models/engineerAttendance.model';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { ApplicationForm } from '../models/applicationform.model';
import moment from 'moment-timezone';
import { WifiInstallationRequest } from '../models/wifiInstallationRequest.model';
import { IptvInstallationRequest } from '../models/iptvInstallationRequest.model';
import { OttInstallationRequest } from '../models/ottInstallationRequest.model';
import { FibreInstallationRequest } from '../models/fibreInstallationRequest.model';
import { Leads } from '../models/leads.model';
import { LeaveRequestModel } from '../models/leaveRequest.model';
import { CustomerModel } from '../models/customer.model';
import Modem from '../models/modem.model';
import { OLTModel } from '../models/olt.model';
import { FDBModel } from '../models/fdb.model';
import orderModel from '../models/order.model';
import { RequestBill } from '../models/requestBill.model';

// Get comprehensive dashboard analytics
export const getProductDashboardAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const {
      dateRange,
      category,
      productType,
      userType,
      status
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (dateRange) {
      const [startDate, endDate] = (dateRange as string).split(',');
      if (startDate && endDate) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
    }

    // Get all products
    const allProducts = await Product.find()
      .populate('category', '_id name image description');

    // Get all orders
    const allOrders = await Order.find(dateFilter)
      .populate('products.product')
      .populate('user', 'firstName lastName role');

    // Calculate product analytics
    const totalProducts = allProducts.length;
    const activeProducts = allProducts.filter(p => p.isActive).length;
    const inactiveProducts = totalProducts - activeProducts;
    const inventoryValue = allProducts.reduce((sum, product) => sum + (product.price * product.stock), 0);
    const lowStockAlerts = allProducts.filter(p => p.stock < 10).length;

    // Calculate average rating
    const productsWithRating = allProducts.filter(p => p.averageRating && p.averageRating > 0);
    const averageRating = productsWithRating.length > 0
      ? productsWithRating.reduce((sum, p) => sum + (p.averageRating || 0), 0) / productsWithRating.length
      : 0;

    // Calculate order analytics
    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(o => o.orderStatus === 'delivered').length;
    const pendingOrders = allOrders.filter(o => o.orderStatus === 'pending').length;
    const totalRevenue = allOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const completedRevenue = allOrders
      .filter(o => o.orderStatus === 'delivered')
      .reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate positive reviews (assuming 4+ stars is positive)
    const positiveReviews = productsWithRating.filter(p => (p.averageRating || 0) >= 4).length;
    const positiveReviewPercentage = productsWithRating.length > 0
      ? (positiveReviews / productsWithRating.length) * 100
      : 0;

    // Category distribution
    const categoryDistribution = await Product.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          categoryName: { $first: { $arrayElemAt: ['$categoryData.name', 0] } }
        }
      },
      {
        $project: {
          category: '$categoryName',
          count: 1,
          percentage: {
            $multiply: [
              { $divide: ['$count', totalProducts] },
              100
            ]
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Product type distribution
    const productTypeDistribution = await Product.aggregate([
      {
        $group: {
          _id: '$productType',
          count: { $sum: 1 }
        }
      }
    ]);

    // User type distribution in orders
    const userTypeDistribution = await Order.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData'
        }
      },
      {
        $group: {
          _id: { $arrayElemAt: ['$userData.role', 0] },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentProducts = allProducts.filter(p => p.createdAt >= thirtyDaysAgo).length;
    const recentOrders = allOrders.filter(o => o.createdAt >= thirtyDaysAgo).length;

    // Top selling products
    const topSellingProducts = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'products',
          localField: 'products.product',
          foreignField: '_id',
          as: 'productData'
        }
      },
      {
        $group: {
          _id: '$products.product',
          totalQuantity: { $sum: '$products.quantity' },
          totalRevenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } },
          productName: { $first: { $arrayElemAt: ['$productData.title', 0] } },
          productType: { $first: { $arrayElemAt: ['$productData.productType', 0] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 }
    ]);

    // Order status distribution
    const orderStatusDistribution = [
      { status: 'pending', count: pendingOrders, percentage: totalOrders > 0 ? (pendingOrders / totalOrders) * 100 : 0 },
      { status: 'confirmed', count: allOrders.filter(o => o.orderStatus === 'confirmed').length, percentage: totalOrders > 0 ? (allOrders.filter(o => o.orderStatus === 'confirmed').length / totalOrders) * 100 : 0 },
      { status: 'shipped', count: allOrders.filter(o => o.orderStatus === 'shipped').length, percentage: totalOrders > 0 ? (allOrders.filter(o => o.orderStatus === 'shipped').length / totalOrders) * 100 : 0 },
      { status: 'delivered', count: completedOrders, percentage: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0 },
      { status: 'cancelled', count: allOrders.filter(o => o.orderStatus === 'cancelled').length, percentage: totalOrders > 0 ? (allOrders.filter(o => o.orderStatus === 'cancelled').length / totalOrders) * 100 : 0 }
    ];

    // Get all categories for filter dropdown
    const categories = await CategoryModel.find().select('_id name image description');

    const response = {
      // Key Metrics (Dashboard Cards)
      metrics: {
        // Product Metrics
        totalProducts,
        activeProducts,
        inactiveProducts,
        inventoryValue,
        averageRating: Math.round(averageRating * 10) / 10,
        lowStockAlerts,
        positiveReviews: Math.round(positiveReviewPercentage),

        // Order Metrics
        totalOrders,
        completedOrders,
        pendingOrders,
        totalRevenue,
        completedRevenue,
        averageOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,

        // Recent Activity
        recentProducts,
        recentOrders
      },

      // Distributions
      categoryDistribution,
      productTypeDistribution,
      userTypeDistribution,
      orderStatusDistribution,

      allOrders,
      allProducts,

      // Top Performers
      topSellingProducts,

      // Filter Options
      filters: {
        categories,
        productTypes: [
          { value: 'user_sale', label: 'User Sale' },
          { value: 'engineer_only', label: 'Engineer Only' }
        ],
        userTypes: [
          { value: 'user', label: 'Customer' },
          { value: 'engineer', label: 'Engineer' }
        ],
        statusOptions: [
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'shipped', label: 'Shipped' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancelled' }
        ]
      }
    };

    return sendSuccess(res, response, 'Dashboard analytics data fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch dashboard analytics', 500, error);
  }
};


export const getAllServicePlans = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const {
      search,
      provider,
      planType,
      minPrice,
      maxPrice,
      quality,
      speed,
      page = 1,
      limit = 10
    } = req.query;

    // Build filters
    const filters: any = {};

    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (provider && provider !== 'All Providers') {
      filters.provider = { $regex: provider, $options: 'i' };
    }

    if (planType && planType !== 'All Types') {
      filters.planType = planType;
    }

    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.$gte = Number(minPrice);
      if (maxPrice) filters.price.$lte = Number(maxPrice);
    }

    if (quality) {
      filters.quality = quality;
    }

    if (speed) {
      filters.$or = [
        { speed: { $regex: speed, $options: 'i' } },
        { speedBeforeLimit: { $regex: speed, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get IPTV Plans
    const iptvFilters = { ...filters };
    if (iptvFilters.$or) {
      iptvFilters.$or = iptvFilters.$or.map((or: any) => {
        if (or.title) or.name = or.title;
        if (or.description) or.description = or.description;
        return or;
      });
    }
    delete iptvFilters.title;

    const iptvPlans = await IptvPlan.find(iptvFilters)
      .select('name totalChannels payChannels freeToAirChannels price lcoMarginPercent planType quality provider logo description channelList')
      .sort({ price: 1 })
      .skip(skip)
      .limit(Number(limit));

    // Get OTT Plans
    const ottFilters = { ...filters };
    if (ottFilters.$or) {
      ottFilters.$or = ottFilters.$or.map((or: any) => {
        if (or.name) or.title = or.name;
        return or;
      });
    }
    delete ottFilters.name;

    const ottPlans = await OttPlan.find(ottFilters)
      .select('title price speedBeforeLimit speedAfterLimit dataLimitGB isUnlimited validity ottApps callBenefit provider logo description')
      .sort({ price: 1 })
      .skip(skip)
      .limit(Number(limit));

    // Get Fibre Plans (using Plan model)
    // Since Plan model contains fibre plans, we need to identify them by their characteristics
    // Fibre plans typically have speed, dataLimit, and validity fields
    const fibreFilters = { ...filters };
    if (fibreFilters.$or) {
      fibreFilters.$or = fibreFilters.$or.map((or: any) => {
        if (or.name) or.title = or.name;
        return or;
      });
    }
    delete fibreFilters.name;

    // Remove the restrictive planType filter since fibre plans can have various planType values
    // Instead, we'll identify them by the presence of fibre-related fields
    delete fibreFilters.planType;

    const fibrePlans = await Plan.find(fibreFilters)
      .select('title price validity speed dataLimit provider logo benefits description planType')
      .sort({ price: 1 })
      .skip(skip)
      .limit(Number(limit));

    // Debug logging
    console.log('Fibre filters:', JSON.stringify(fibreFilters, null, 2));
    console.log('Fibre plans found:', fibrePlans.length);
    console.log('Fibre plans:', fibrePlans.map(p => ({ title: p.title, planType: p.planType, provider: p.provider })));

    // Test: Get all plans without filters to see if the model is working
    const allPlansTest = await Plan.find({}).limit(5);
    console.log('All plans test (first 5):', allPlansTest.map(p => ({ title: p.title, planType: p.planType, provider: p.provider })));

    // Get total counts for each plan type
    const totalIptvPlans = await IptvPlan.countDocuments(iptvFilters);
    const totalOttPlans = await OttPlan.countDocuments(ottFilters);
    const totalFibrePlans = await Plan.countDocuments(fibreFilters);
    const totalPlans = totalIptvPlans + totalOttPlans + totalFibrePlans;

    // Get unique providers for filter dropdown
    const providers = await Promise.all([
      IptvPlan.distinct('provider'),
      OttPlan.distinct('provider'),
      Plan.distinct('provider')
    ]);
    const uniqueProviders = [...new Set(providers.flat())].sort();

    // Get plan types for filter dropdown
    const planTypes = [
      { value: 'All Types', label: 'All Types' },
      { value: 'Basic', label: 'Basic' },
      { value: 'Standard', label: 'Standard' },
      { value: 'Premium', label: 'Premium' },
      { value: 'Lite', label: 'Lite' },
      { value: 'Entertainment', label: 'Entertainment' },
      { value: 'Midrange', label: 'Midrange' },
      { value: 'OTT', label: 'OTT' }
    ];

    // Format plans for consistent response structure
    const formatIptvPlan = (plan: any) => ({
      id: plan._id,
      title: plan.name,
      price: plan.price,
      provider: plan.provider,
      logo: plan.logo,
      description: plan.description,
      planType: 'iptv',
      category: plan.planType,
      quality: plan.quality,
      features: [
        { icon: 'monitor', label: `${plan.totalChannels} Channels` },
        { icon: 'crown', label: `${plan.payChannels} Premium` },
        { icon: 'broadcast', label: `${plan.freeToAirChannels} Free` },
        { icon: 'chart-line', label: `${plan.lcoMarginPercent}% LCO` }
      ],
      popularChannels: plan.channelList?.slice(0, 4) || ['Star Plus', 'Zee TV', 'Sony Entertainment'],
      totalChannels: plan.totalChannels,
      payChannels: plan.payChannels,
      freeToAirChannels: plan.freeToAirChannels,
      lcoMarginPercent: plan.lcoMarginPercent
    });

    const formatOttPlan = (plan: any) => ({
      id: plan._id,
      title: plan.title,
      price: plan.price,
      provider: plan.provider,
      logo: plan.logo,
      description: plan.description,
      planType: 'ott',
      category: plan.isUnlimited ? 'Unlimited' : 'Limited',
      features: [
        { icon: 'wifi', label: plan.speedBeforeLimit },
        { icon: 'calendar', label: plan.validity },
        { icon: 'shield', label: plan.isUnlimited ? 'Unlimited' : `${plan.dataLimitGB} GB` },
        { icon: 'phone', label: plan.callBenefit }
      ],
      ottApps: plan.ottApps,
      speedBeforeLimit: plan.speedBeforeLimit,
      speedAfterLimit: plan.speedAfterLimit,
      dataLimitGB: plan.dataLimitGB,
      isUnlimited: plan.isUnlimited,
      validity: plan.validity,
      callBenefit: plan.callBenefit
    });

    const formatFibrePlan = (plan: any) => ({
      id: plan._id,
      title: plan.title,
      price: plan.price,
      provider: plan.provider,
      logo: plan.logo,
      description: plan.description,
      planType: 'fibre',
      category: plan.planType,
      features: [
        { icon: 'wifi', label: plan.speed },
        { icon: 'calendar', label: plan.validity },
        { icon: 'globe', label: plan.dataLimit },
        { icon: 'shield', label: plan.planType }
      ],
      benefits: plan.benefits,
      speed: plan.speed,
      dataLimit: plan.dataLimit,
      validity: plan.validity
    });

    const formattedIptvPlans = iptvPlans.map(formatIptvPlan);
    const formattedOttPlans = ottPlans.map(formatOttPlan);
    const formattedFibrePlans = fibrePlans.map(formatFibrePlan);

    // Combine all plans
    const allPlans = [...formattedIptvPlans, ...formattedOttPlans, ...formattedFibrePlans];

    // Sort combined plans by price
    allPlans.sort((a, b) => a.price - b.price);

    const response = {
      // Summary Cards
      summary: {
        totalPlans,
        iptvPlans: totalIptvPlans,
        ottPlans: totalOttPlans,
        fibrePlans: totalFibrePlans
      },

      // All Plans (combined and sorted)
      plans: allPlans,

      // Individual Plan Types (for tabbed view)
      planTypes: {
        iptv: formattedIptvPlans,
        ott: formattedOttPlans,
        fibre: formattedFibrePlans
      },

      // Filter Options
      filters: {
        providers: ['All Providers', ...uniqueProviders],
        planTypes,
        priceRange: {
          min: Math.min(...allPlans.map(p => p.price)),
          max: Math.max(...allPlans.map(p => p.price))
        }
      },

      // Pagination Info
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalPlans / Number(limit)),
        totalItems: totalPlans,
        itemsPerPage: Number(limit),
        hasNextPage: Number(page) < Math.ceil(totalPlans / Number(limit)),
        hasPrevPage: Number(page) > 1
      }
    };

    return sendSuccess(res, response, 'Service plans fetched successfully');
  } catch (error: any) {
    return sendError(res, 'Failed to fetch service plans', 500, error);
  }
};

// Get comprehensive engineer analytics with filtering and pagination
export const getEngineerAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const userId = (req as any).userId; // Logged in user ID
  const role = (req as any).role;

  try {
    const {
      status,
      group,
      zone,
      area,
      mode,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter conditions based on role
    const filterConditions: any = {
      role: 'engineer',
      isDeleted: false
    };

    // Role-based filtering
    if (role === 'superadmin') {
      // Superadmin gets all data - no additional filters needed
    } else if (role === 'admin') {
      // Admin gets only engineers where parentCompany equals their userId
      filterConditions.parentCompany = userId;
    }

    // Status filter (active/inactive)
    if (status === 'active') {
      filterConditions.isDeactivated = false;
      filterConditions.isSuspended = false;
      filterConditions.isAccountVerified = true;
    } else if (status === 'inactive') {
      filterConditions.$or = [
        { isDeactivated: true },
        { isSuspended: true },
        { isAccountVerified: false }
      ];
    }

    // Additional filters
    if (group) filterConditions.group = group;
    if (zone) filterConditions.zone = zone;
    if (area) filterConditions.area = area;
    if (mode) filterConditions.mode = mode;

    // Search filter
    if (search) {
      filterConditions.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort conditions
    const sortConditions: any = {};
    sortConditions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Get total count for analytics
    const totalEngineers = await UserModel.countDocuments(filterConditions);

    // Get ALL engineers with complete data including new fields
    const engineers = await UserModel.find(filterConditions)
      .select('_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode lastLogin createdAt updatedAt isDeactivated isSuspended isAccountVerified permanentAddress residenceAddress country language userName fatherName provider providerId state pincode areaFromPincode aadhaarNumber panNumber aadhaarFront aadhaarBack panCard balanceDue deviceToken deviceType jti otpVerified')
      .sort(sortConditions);

    // Calculate analytics with role-based filtering
    const totalEngineersCount = await UserModel.countDocuments(filterConditions);
    const activeEngineersCount = await UserModel.countDocuments({
      ...filterConditions,
      isDeactivated: false,
      isSuspended: false,
      isAccountVerified: true
    });
    const inactiveEngineersCount = totalEngineersCount - activeEngineersCount;

    // Calculate average rating (if you have rating system)
    // For now, we'll use a placeholder - you can implement actual rating logic
    const avgRating = 89.4; // This should come from your rating system

    // Get status distribution with role-based filtering
    const statusDistribution = await UserModel.aggregate([
      { $match: filterConditions },
      {
        $group: {
          _id: {
            isDeactivated: '$isDeactivated',
            isSuspended: '$isSuspended',
            isAccountVerified: '$isAccountVerified'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get group distribution with role-based filtering
    const groupDistribution = await UserModel.aggregate([
      { $match: { ...filterConditions, group: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$group',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get zone distribution with role-based filtering
    const zoneDistribution = await UserModel.aggregate([
      { $match: { ...filterConditions, zone: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$zone',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get area distribution with role-based filtering
    const areaDistribution = await UserModel.aggregate([
      { $match: { ...filterConditions, area: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$area',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get mode distribution with role-based filtering
    const modeDistribution = await UserModel.aggregate([
      { $match: { ...filterConditions, mode: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$mode',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent activity (last 7 days) with role-based filtering
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await UserModel.countDocuments({
      ...filterConditions,
      lastLogin: { $gte: sevenDaysAgo }
    });

    const response = {
      // Summary Cards (like in your image)
      summary: {
        totalEngineers: totalEngineersCount,
        activeEngineers: activeEngineersCount,
        inactive: inactiveEngineersCount,
        avgRating: avgRating
      },

      // Complete Engineer List - All Data
      engineers: engineers.map(engineer => ({
        _id: engineer._id,
        firstName: engineer.firstName,
        lastName: engineer.lastName,
        fullName: `${engineer.firstName} ${engineer.lastName}`,
        email: engineer.email,
        phoneNumber: engineer.phoneNumber,
        countryCode: engineer.countryCode,
        profileImage: engineer.profileImage,
        status: engineer.status,
        group: engineer.group,
        zone: engineer.zone,
        area: engineer.area,
        mode: engineer.mode,
        lastLogin: engineer.lastLogin,
        createdAt: engineer.createdAt,
        updatedAt: engineer.updatedAt,
        isActive: !engineer.isDeactivated && !engineer.isSuspended && engineer.isAccountVerified,
        accountStatus: {
          isDeactivated: engineer.isDeactivated,
          isSuspended: engineer.isSuspended,
          isAccountVerified: engineer.isAccountVerified,
          otpVerified: engineer.otpVerified
        },
        // Address details
        permanentAddress: engineer.permanentAddress,
        residenceAddress: engineer.residenceAddress,
        billingAddress: engineer.billingAddress,
        country: engineer.country,
        language: engineer.language,
        companyPreference: engineer.companyPreference,
        userName: engineer.userName,
        fatherName: engineer.fatherName,
        provider: engineer.provider,
        providerId: engineer.providerId,
        balanceDue: engineer.balanceDue,

        // Recently added fields - Location & Personal Details
        state: engineer.state,
        pincode: engineer.pincode,
        areaFromPincode: engineer.areaFromPincode,

        // Recently added fields - Document Details
        aadhaarNumber: engineer.aadhaarNumber,
        panNumber: engineer.panNumber,
        aadhaarFront: engineer.aadhaarFront, // File path
        aadhaarBack: engineer.aadhaarBack,   // File path
        panCard: engineer.panCard,           // File path

        // Device and session info
        deviceToken: engineer.deviceToken,
        deviceType: engineer.deviceType,
        jti: engineer.jti
      })),

      // Analytics and Distributions
      analytics: {
        statusDistribution,
        groupDistribution,
        zoneDistribution,
        areaDistribution,
        modeDistribution,
        recentActivity
      },

      // Filter Options
      filters: {
        availableGroups: groupDistribution.map(g => g._id),
        availableZones: zoneDistribution.map(z => z._id),
        availableAreas: areaDistribution.map(a => a._id),
        availableModes: modeDistribution.map(m => m._id)
      },

      // Data Info
      dataInfo: {
        totalItems: totalEngineers,
        returnedItems: engineers.length
      }
    };

    return sendSuccess(res, response, 'Engineer analytics fetched successfully');
  } catch (error: any) {
    console.error('Engineer analytics error:', error);
    return sendError(res, 'Failed to fetch engineer analytics', 500, error);
  }
};

// Get engineer details by ID
export const getEngineerById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId; // Logged in user ID
    const role = (req as any).role; // Logged in user role

    // Build filter conditions based on role
    const filterConditions: any = {
      _id: id,
      role: 'engineer',
      isDeleted: false
    };

    // Role-based filtering
    if (role === 'superadmin') {
      // Superadmin gets all data - no additional filters needed
    } else if (role === 'admin') {
      // Admin gets only engineers where parentCompany equals their userId
      filterConditions.parentCompany = userId;
    }

    const engineer = await UserModel.findOne(filterConditions)
      .select('_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode lastLogin createdAt updatedAt isDeactivated isSuspended isAccountVerified permanentAddress billingAddress country language companyPreference userName fatherName balanceDue otpVerified deviceToken deviceType jti')
      .populate('profileImage', 'url');

    if (!engineer) {
      return sendError(res, 'Engineer not found', 404);
    }

    const engineerData = {
      _id: engineer._id,
      firstName: engineer.firstName,
      lastName: engineer.lastName,
      fullName: `${engineer.firstName} ${engineer.lastName}`,
      email: engineer.email,
      phoneNumber: engineer.phoneNumber,
      countryCode: engineer.countryCode,
      profileImage: engineer.profileImage,
      status: engineer.status,
      group: engineer.group,
      zone: engineer.zone,
      area: engineer.area,
      mode: engineer.mode,
      lastLogin: engineer.lastLogin,
      createdAt: engineer.createdAt,
      updatedAt: engineer.updatedAt,
      isActive: !engineer.isDeactivated && !engineer.isSuspended && engineer.isAccountVerified,
      accountStatus: {
        isDeactivated: engineer.isDeactivated,
        isSuspended: engineer.isSuspended,
        isAccountVerified: engineer.isAccountVerified,
        otpVerified: engineer.otpVerified
      },
      // Additional details
      permanentAddress: engineer.permanentAddress,
      billingAddress: engineer.billingAddress,
      country: engineer.country,
      language: engineer.language,
      companyPreference: engineer.companyPreference,
      userName: engineer.userName,
      fatherName: engineer.fatherName,
      balanceDue: engineer.balanceDue,
      // Device and session info
      deviceToken: engineer.deviceToken,
      deviceType: engineer.deviceType,
      jti: engineer.jti
    };

    return sendSuccess(res, engineerData, 'Engineer details fetched successfully');
  } catch (error: any) {
    console.error('Get engineer by ID error:', error);
    return sendError(res, 'Failed to fetch engineer details', 500, error);
  }
};

export const addEngineer = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId; // Logged in user ID
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      countryCode,
      status,
      group,
      zone,
      area,
      mode,
      permanentAddress,
      residenceAddress,
      billingAddress,
      country,
      language,
      companyPreference,
      userName,
      fatherName,
      provider,
      providerId,
      state,
      pincode,
      areaFromPincode,
      aadhaarNumber,
      panNumber
    } = req.body;

    // Handle uploaded files
    let profileImage = null;
    let aadhaarFront = null;
    let aadhaarBack = null;
    let panCard = null;

    if (req.files && typeof req.files === 'object') {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      try {
        // Process profile image
        if (files.profileImage && files.profileImage[0]) {
          const file = files.profileImage[0];
          if (!file.mimetype.startsWith('image/')) {
            return sendError(res, 'Profile image must be an image file', 400);
          }
          const absolutePath = file.path.replace(/\\/g, "/");
          const viewIndex = absolutePath.lastIndexOf("/view/");
          profileImage = viewIndex !== -1 ? absolutePath.substring(viewIndex) : file.path;
          console.log('Profile image uploaded:', profileImage);
        }

        // Process Aadhaar front
        if (files.aadhaarFront && files.aadhaarFront[0]) {
          const file = files.aadhaarFront[0];
          if (!file.mimetype.startsWith('image/')) {
            return sendError(res, 'Aadhaar front image must be an image file', 400);
          }
          const absolutePath = file.path.replace(/\\/g, "/");
          const viewIndex = absolutePath.lastIndexOf("/view/");
          aadhaarFront = viewIndex !== -1 ? absolutePath.substring(viewIndex) : file.path;
          console.log('Aadhaar front uploaded:', aadhaarFront);
        }

        // Process Aadhaar back
        if (files.aadhaarBack && files.aadhaarBack[0]) {
          const file = files.aadhaarBack[0];
          if (!file.mimetype.startsWith('image/')) {
            return sendError(res, 'Aadhaar back image must be an image file', 400);
          }
          const absolutePath = file.path.replace(/\\/g, "/");
          const viewIndex = absolutePath.lastIndexOf("/view/");
          aadhaarBack = viewIndex !== -1 ? absolutePath.substring(viewIndex) : file.path;
          console.log('Aadhaar back uploaded:', aadhaarBack);
        }

        // Process PAN card
        if (files.panCard && files.panCard[0]) {
          const file = files.panCard[0];
          if (!file.mimetype.startsWith('image/')) {
            return sendError(res, 'PAN card image must be an image file', 400);
          }
          const absolutePath = file.path.replace(/\\/g, "/");
          const viewIndex = absolutePath.lastIndexOf("/view/");
          panCard = viewIndex !== -1 ? absolutePath.substring(viewIndex) : file.path;
          console.log('PAN card uploaded:', panCard);
        }

      } catch (fileError) {
        console.error('Error processing uploaded files:', fileError);
        return sendError(res, 'Error processing uploaded files', 400);
      }
    }

    // Validate required fields
    if (!email || !firstName || !lastName || !countryCode || !phoneNumber) {
      return sendError(res, 'Email, firstName, lastName, countryCode, and phoneNumber are required', 400);
    }

    // Check if engineer already exists
    const existingEngineer = await UserModel.findOne({
      $or: [
        { email },
        { phoneNumber: `${countryCode}${phoneNumber}` }
      ]
    });

    if (existingEngineer) {
      return sendError(res, 'Engineer with this email or phone number already exists', 400);
    }

    // Use phone number as password (no OTP needed for admin-created accounts)
    const phonePassword = phoneNumber;
    const hashedPassword = await hashPassword(phonePassword);

    // Create new engineer with verified account
    const engineer = await UserModel.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      countryCode,
      profileImage: profileImage || undefined,
      status: status || 'active',
      group,
      zone,
      area,
      mode,
      permanentAddress,
      residenceAddress,
      billingAddress,
      country,
      language,
      companyPreference,
      userName: userName || `${firstName.toLowerCase()}${lastName.toLowerCase()}${Date.now()}`,
      fatherName,
      provider,
      providerId,
      state,
      pincode,
      areaFromPincode,
      aadhaarNumber,
      panNumber,
      aadhaarFront: aadhaarFront || undefined,
      aadhaarBack: aadhaarBack || undefined,
      panCard: panCard || undefined,
      parentCompany: userId, // Set parentCompany to the logged in user's ID
      role: 'engineer',
      password: hashedPassword,
      isAccountVerified: true, // Already verified since admin is creating
      isDeactivated: false,
      isSuspended: false
    });

    // Send email with credentials only (no OTP)
    await sendMessage.sendEmail({
      userEmail: email,
      subject: 'Your WiFi SelfCare Engineer Account Credentials',
      text: `Your engineer account credentials:\nEmail: ${email}\nPassword: ${phoneNumber}\n\nYour account is already verified and ready to use.`,
      html: generateEngineerCredentialsEmail(email, phoneNumber, firstName)
    });

    // Return success without sensitive data
    const engineerResponse = {
      _id: engineer._id,
      email: engineer.email,
      firstName: engineer.firstName,
      lastName: engineer.lastName,
      phoneNumber: engineer.phoneNumber,
      countryCode: engineer.countryCode,
      status: engineer.status,
      group: engineer.group,
      zone: engineer.zone,
      area: engineer.area,
      mode: engineer.mode,
      state: engineer.state,
      pincode: engineer.pincode,
      areaFromPincode: engineer.areaFromPincode,
      aadhaarNumber: engineer.aadhaarNumber,
      panNumber: engineer.panNumber,
      profileImage: engineer.profileImage,
      aadhaarFront: engineer.aadhaarFront,
      aadhaarBack: engineer.aadhaarBack,
      panCard: engineer.panCard,
      message: 'Engineer account created successfully. Credentials sent to email.'
    };

    return sendSuccess(res, engineerResponse, 'Engineer added successfully. Credentials sent to email.');
  } catch (error: any) {
    console.error('Add engineer error:', error);
    return sendError(res, 'Failed to add engineer', 500, error);
  }
};

// Update engineer details
export const updateEngineer = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId; // Logged in user ID
    const role = (req as any).role; // Logged in user role
    const {
      engineerId,
      firstName,
      lastName,
      email,
      phoneNumber,
      countryCode,
      status,
      group,
      zone,
      area,
      mode,
      permanentAddress,
      residenceAddress,
      billingAddress,
      country,
      language,
      companyPreference,
      userName,
      fatherName,
      provider,
      providerId,
      state,
      pincode,
      areaFromPincode,
      aadhaarNumber,
      panNumber
    } = req.body;

    // Validate required fields
    if (!engineerId) {
      return sendError(res, 'Engineer ID is required', 400);
    }

    // Build filter conditions based on role
    const filterConditions: any = {
      _id: engineerId,
      role: 'engineer',
      isDeleted: false
    };

    // Role-based filtering
    if (role === 'superadmin') {
      // Superadmin gets all data - no additional filters needed
    } else if (role === 'admin') {
      // Admin gets only engineers where parentCompany equals their userId
      filterConditions.parentCompany = userId;
    }

    // Check if engineer exists
    const existingEngineer = await UserModel.findOne(filterConditions);

    if (!existingEngineer) {
      return sendError(res, 'Engineer not found', 404);
    }

    // Handle uploaded files - keep existing files by default
    let profileImage = existingEngineer.profileImage;
    let aadhaarFront = existingEngineer.aadhaarFront;
    let aadhaarBack = existingEngineer.aadhaarBack;
    let panCard = existingEngineer.panCard;

    if (req.files && typeof req.files === 'object') {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      try {
        // Process profile image
        if (files.profileImage && files.profileImage[0]) {
          const file = files.profileImage[0];
          if (!file.mimetype.startsWith('image/')) {
            return sendError(res, 'Profile image must be an image file', 400);
          }
          const absolutePath = file.path.replace(/\\/g, "/");
          const viewIndex = absolutePath.lastIndexOf("/view/");
          profileImage = viewIndex !== -1 ? absolutePath.substring(viewIndex) : file.path;
          console.log('New profile image uploaded:', profileImage);
        }

        // Process Aadhaar front
        if (files.aadhaarFront && files.aadhaarFront[0]) {
          const file = files.aadhaarFront[0];
          if (!file.mimetype.startsWith('image/')) {
            return sendError(res, 'Aadhaar front image must be an image file', 400);
          }
          const absolutePath = file.path.replace(/\\/g, "/");
          const viewIndex = absolutePath.lastIndexOf("/view/");
          aadhaarFront = viewIndex !== -1 ? absolutePath.substring(viewIndex) : file.path;
          console.log('New Aadhaar front uploaded:', aadhaarFront);
        }

        // Process Aadhaar back
        if (files.aadhaarBack && files.aadhaarBack[0]) {
          const file = files.aadhaarBack[0];
          if (!file.mimetype.startsWith('image/')) {
            return sendError(res, 'Aadhaar back image must be an image file', 400);
          }
          const absolutePath = file.path.replace(/\\/g, "/");
          const viewIndex = absolutePath.lastIndexOf("/view/");
          aadhaarBack = viewIndex !== -1 ? absolutePath.substring(viewIndex) : file.path;
          console.log('New Aadhaar back uploaded:', aadhaarBack);
        }

        // Process PAN card
        if (files.panCard && files.panCard[0]) {
          const file = files.panCard[0];
          if (!file.mimetype.startsWith('image/')) {
            return sendError(res, 'PAN card image must be an image file', 400);
          }
          const absolutePath = file.path.replace(/\\/g, "/");
          const viewIndex = absolutePath.lastIndexOf("/view/");
          panCard = viewIndex !== -1 ? absolutePath.substring(viewIndex) : file.path;
          console.log('New PAN card uploaded:', panCard);
        }

      } catch (fileError) {
        console.error('Error processing uploaded files:', fileError);
        return sendError(res, 'Error processing uploaded files', 400);
      }
    }

    // Check if email or phone number conflicts with other engineers (excluding current engineer)
    if (email || phoneNumber) {
      const conflictQuery: any = {
        _id: { $ne: engineerId },
        role: 'engineer',
        isDeleted: false
      };

      if (email) {
        conflictQuery.email = email;
      }

      if (phoneNumber && countryCode) {
        conflictQuery.phoneNumber = `${countryCode}${phoneNumber}`;
      }

      const conflictingEngineer = await UserModel.findOne(conflictQuery);
      if (conflictingEngineer) {
        return sendError(res, 'Another engineer with this email or phone number already exists', 400);
      }
    }

    // Prepare update data
    const updateData: any = {};

    // Only update fields that are provided
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (countryCode !== undefined) updateData.countryCode = countryCode;
    if (status !== undefined) updateData.status = status;
    if (group !== undefined) updateData.group = group;
    if (zone !== undefined) updateData.zone = zone;
    if (area !== undefined) updateData.area = area;
    if (mode !== undefined) updateData.mode = mode;
    if (permanentAddress !== undefined) updateData.permanentAddress = permanentAddress;
    if (residenceAddress !== undefined) updateData.residenceAddress = residenceAddress;
    if (billingAddress !== undefined) updateData.billingAddress = billingAddress;
    if (country !== undefined) updateData.country = country;
    if (language !== undefined) updateData.language = language;
    if (companyPreference !== undefined) updateData.companyPreference = companyPreference;
    if (userName !== undefined) updateData.userName = userName;
    if (fatherName !== undefined) updateData.fatherName = fatherName;
    if (provider !== undefined) updateData.provider = provider;
    if (providerId !== undefined) updateData.providerId = providerId;
    if (state !== undefined) updateData.state = state;
    if (pincode !== undefined) updateData.pincode = pincode;
    if (areaFromPincode !== undefined) updateData.areaFromPincode = areaFromPincode;
    if (aadhaarNumber !== undefined) updateData.aadhaarNumber = aadhaarNumber;
    if (panNumber !== undefined) updateData.panNumber = panNumber;

    // Update files if new ones were uploaded
    if (req.files && typeof req.files === 'object') {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files.profileImage && files.profileImage[0]) updateData.profileImage = profileImage;
      if (files.aadhaarFront && files.aadhaarFront[0]) updateData.aadhaarFront = aadhaarFront;
      if (files.aadhaarBack && files.aadhaarBack[0]) updateData.aadhaarBack = aadhaarBack;
      if (files.panCard && files.panCard[0]) updateData.panCard = panCard;
    }

    // Update engineer
    const updatedEngineer = await UserModel.findByIdAndUpdate(
      engineerId,
      updateData,
      { new: true, runValidators: true }
    ).select('_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode permanentAddress residenceAddress billingAddress country language companyPreference userName fatherName provider providerId state pincode areaFromPincode aadhaarNumber panNumber aadhaarFront aadhaarBack panCard updatedAt');

    if (!updatedEngineer) {
      return sendError(res, 'Failed to update engineer', 500);
    }

    // Return success response
    const engineerResponse = {
      _id: updatedEngineer._id,
      email: updatedEngineer.email,
      firstName: updatedEngineer.firstName,
      lastName: updatedEngineer.lastName,
      phoneNumber: updatedEngineer.phoneNumber,
      countryCode: updatedEngineer.countryCode,
      profileImage: updatedEngineer.profileImage,
      status: updatedEngineer.status,
      group: updatedEngineer.group,
      zone: updatedEngineer.zone,
      area: updatedEngineer.area,
      mode: updatedEngineer.mode,
      permanentAddress: updatedEngineer.permanentAddress,
      residenceAddress: updatedEngineer.residenceAddress,
      billingAddress: updatedEngineer.billingAddress,
      country: updatedEngineer.country,
      language: updatedEngineer.language,
      companyPreference: updatedEngineer.companyPreference,
      userName: updatedEngineer.userName,
      fatherName: updatedEngineer.fatherName,
      provider: updatedEngineer.provider,
      providerId: updatedEngineer.providerId,
      state: updatedEngineer.state,
      pincode: updatedEngineer.pincode,
      areaFromPincode: updatedEngineer.areaFromPincode,
      aadhaarNumber: updatedEngineer.aadhaarNumber,
      panNumber: updatedEngineer.panNumber,
      aadhaarFront: updatedEngineer.aadhaarFront,
      aadhaarBack: updatedEngineer.aadhaarBack,
      panCard: updatedEngineer.panCard,
      updatedAt: updatedEngineer.updatedAt,
      message: 'Engineer updated successfully.'
    };

    return sendSuccess(res, engineerResponse, 'Engineer updated successfully');
  } catch (error: any) {
    console.error('Update engineer error:', error);
    return sendError(res, 'Failed to update engineer', 500, error);
  }
};

// Soft delete engineer
export const deleteEngineer = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId; // Logged in user ID
    const role = (req as any).role; // Logged in user role

    // Validate required fields
    if (!id) {
      return sendError(res, 'Engineer ID is required', 400);
    }

    // Build filter conditions based on role
    const filterConditions: any = {
      _id: id,
      role: 'engineer',
      isDeleted: false
    };

    // Role-based filtering
    if (role === 'superadmin') {
      // Superadmin gets all data - no additional filters needed
    } else if (role === 'admin') {
      // Admin gets only engineers where parentCompany equals their userId
      filterConditions.parentCompany = userId;
    }

    // Check if engineer exists and is not already deleted
    const existingEngineer = await UserModel.findOne(filterConditions);

    if (!existingEngineer) {
      return sendError(res, 'Engineer not found or already deleted', 404);
    }

    // Soft delete the engineer by setting isDeleted to true
    const deletedEngineer = await UserModel.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        // Optionally, you can also deactivate the account
        isDeactivated: true,
        status: 'inactive'
      },
      { new: true, runValidators: true }
    ).select('_id firstName lastName email phoneNumber countryCode role status group zone area mode deletedAt');

    if (!deletedEngineer) {
      return sendError(res, 'Failed to delete engineer', 500);
    }

    // Return success response
    const engineerResponse = {
      _id: deletedEngineer._id,
      email: deletedEngineer.email,
      firstName: deletedEngineer.firstName,
      lastName: deletedEngineer.lastName,
      phoneNumber: deletedEngineer.phoneNumber,
      countryCode: deletedEngineer.countryCode,
      status: deletedEngineer.status,
      group: deletedEngineer.group,
      zone: deletedEngineer.zone,
      area: deletedEngineer.area,
      mode: deletedEngineer.mode,
      deletedAt: new Date(),
      message: 'Engineer deleted successfully.'
    };

    return sendSuccess(res, engineerResponse, 'Engineer deleted successfully');
  } catch (error: any) {
    console.error('Delete engineer error:', error);
    return sendError(res, 'Failed to delete engineer', 500, error);
  }
};

export const getEngineerDashboardAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const engineer: any = await UserModel.findById(userId).select('_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode lastLogin createdAt updatedAt isDeactivated isSuspended isAccountVerified permanentAddress billingAddress country language companyPreference userName fatherName').populate("parentCompany",
      "_id companyName companyAddress companyPhone companyEmail companyWebsite companyLogo companyDescription"
    );

    if (!engineer) {
      return sendError(res, 'Engineer not found', 404);
    }

    // Set timezone to India (Asia/Kolkata)
    moment.tz.setDefault('Asia/Kolkata');

    // Get current month start and end dates in India timezone
    const currentMonthStart = moment().startOf('month').toDate();
    const currentMonthEnd = moment().endOf('month').toDate();

    // Get all complaints for engineer
    const complaints = await ComplaintModel.find({ engineer: userId }).select('_id id title status priority createdAt user');

    // Get monthly complaints for current month
    const monthlyComplaints = complaints.filter(c =>
      c.createdAt && c.createdAt >= currentMonthStart && c.createdAt <= currentMonthEnd
    );

    // Calculate complaint statistics for all statuses
    const totalComplaints = complaints.length;

    // Count complaints by each status
    const statusCounts = {
      pending: complaints.filter(c => c.status === 'pending').length,
      assigned: complaints.filter(c => c.status === 'assigned').length,
      in_progress: complaints.filter(c => c.status === 'in_progress').length,
      visited: complaints.filter(c => c.status === 'visited').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      not_resolved: complaints.filter(c => c.status === 'not_resolved').length,
      cancelled: complaints.filter(c => c.status === 'cancelled').length,
      reopened: complaints.filter(c => c.status === 'reopened').length
    };

    // Calculate pending complaints (all non-final statuses)
    const pendingComplaints = complaints.filter(c =>
      ['pending', 'assigned', 'in_progress', 'visited'].includes(c.status)
    ).length;

    // Calculate resolved complaints (final resolved status)
    const resolvedComplaints = statusCounts.resolved;

    // Calculate this week complaints
    const thisWeekComplaints = complaints.filter(c => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return c.createdAt && c.createdAt >= weekAgo;
    }).length;

    // Get repeated complaints (complaints with same user)
    const userComplaintCounts = await ComplaintModel.aggregate([
      { $match: { engineer: engineer._id } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    const repeatedComplaints = userComplaintCounts.length;

    // Calculate monthly repeated complaints for current month
    const monthlyRepeatedComplaints = await ComplaintModel.aggregate([
      {
        $match: {
          engineer: engineer._id,
          createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
        }
      },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    // Get monthly complaint summary for current month
    const monthlyComplaintSummary = {
      total: monthlyComplaints.length,
      done: monthlyComplaints.filter(c => c.status === 'resolved').length,
      pending: monthlyComplaints.filter(c =>
        ['pending', 'assigned', 'in_progress', 'visited'].includes(c.status)
      ).length,
      repeated: monthlyRepeatedComplaints.length
    };

    // Get all types of installation requests assigned to this engineer for current month
    const [wifiInstallations, iptvInstallations, ottInstallations, fibreInstallations] = await Promise.all([
      WifiInstallationRequest.find({
        assignedEngineer: userId,
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
      }),
      IptvInstallationRequest.find({
        assignedEngineer: userId,
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
      }),
      OttInstallationRequest.find({
        assignedEngineer: userId,
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
      }),
      FibreInstallationRequest.find({
        assignedEngineer: userId,
        createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
      })
    ]);

    // Combine all installations
    const monthlyInstallations = [
      ...wifiInstallations,
      ...iptvInstallations,
      ...ottInstallations,
      ...fibreInstallations
    ];

    // Get leads created by this engineer for current month
    const monthlyLeads = await Leads.find({
      byEngineerId: userId,
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });

    // Calculate monthly installation summary
    const monthlyInstallationSummary = {
      total: monthlyInstallations.length,
      done: monthlyInstallations.filter(inst => inst.status === 'approved').length,
      pending: monthlyInstallations.filter(inst =>
        ['inreview'].includes(inst.status)
      ).length,
      newLead: monthlyLeads.length
    };

    let isTodayAttendance = false;
    let attendanceMessage = '';
    let canMarkAttendance = false;
    const today = new Date();
    const currentHour = today.getHours();
    const currentTime = today.getTime();

    // Check if engineer has marked attendance for today
    try {
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      const todayAttendance = await EngineerAttendanceModel.findOne({
        engineer: userId,
        date: {
          $gte: todayStart,
          $lte: todayEnd
        }
      });

      isTodayAttendance = !!todayAttendance;

      // Define attendance time restrictions
      const canMarkStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 5, 0, 0); // 5:00 AM
      const canMarkEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 22, 0, 0); // 10:00 PM

      // Check if current time is within allowed attendance window
      if (currentTime >= canMarkStart.getTime() && currentTime <= canMarkEnd.getTime()) {
        canMarkAttendance = true;
        if (isTodayAttendance) {
          attendanceMessage = 'Attendance already marked for today';
        } else {
          attendanceMessage = 'You can mark attendance now';
        }
      } else if (currentTime > canMarkEnd.getTime() && currentTime < new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0).getTime()) {
        // Between 10:00 PM and 12:00 AM (before new day starts)
        canMarkAttendance = false;
        attendanceMessage = 'Attendance marking is closed for today. You are too late to mark attendance.';
      } else if (currentTime >= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0).getTime() && currentTime < canMarkStart.getTime()) {
        // Between 12:00 AM and 5:00 AM (new day but before allowed time)
        canMarkAttendance = false;
        attendanceMessage = 'You can only mark attendance after 5:00 AM';
      }

    } catch (error) {
      console.error('Error checking today attendance:', error);
      isTodayAttendance = false;
      canMarkAttendance = false;
      attendanceMessage = 'Error checking attendance status';
    }



    const dashboardData = {
      // Current month information
      currentMonth: {
        name: moment().format('MMMM YYYY'),
        startDate: currentMonthStart,
        endDate: currentMonthEnd,
        timezone: 'Asia/Kolkata'
      },
      company: {
        _id: engineer?.parentCompany?._id,
        companyName: engineer?.parentCompany?.companyName,
        companyAddress: engineer?.parentCompany?.companyAddress,
        companyPhone: engineer?.parentCompany?.companyPhone,
        companyEmail: engineer?.parentCompany?.companyEmail,
        companyWebsite: engineer?.parentCompany?.companyWebsite,
        companyLogo: engineer?.parentCompany?.companyLogo,
        companyDescription: engineer?.parentCompany?.companyDescription
      },
      engineer: {
        _id: engineer._id,
        name: `${engineer.firstName} ${engineer.lastName}`,
        email: engineer.email,
        phoneNumber: engineer.phoneNumber,
        countryCode: engineer.countryCode,
        role: engineer.role,
        status: engineer.status,
        group: engineer.group,
        zone: engineer.zone,
        area: engineer.area,
        mode: engineer.mode,
        lastLogin: engineer.lastLogin,
        profileImage: engineer.profileImage
      },
      // Monthly Installation Summary
      monthlyInstallationSummary: {
        total: monthlyInstallationSummary.total,
        done: monthlyInstallationSummary.done,
        pending: monthlyInstallationSummary.pending,
        newLead: monthlyInstallationSummary.newLead,
        breakdown: {
          wifi: wifiInstallations.length,
          iptv: iptvInstallations.length,
          ott: ottInstallations.length,
          fibre: fibreInstallations.length
        }
      },
      // Monthly Complaint Summary
      monthlyComplaintSummary: {
        total: monthlyComplaintSummary.total,
        done: monthlyComplaintSummary.done,
        pending: monthlyComplaintSummary.pending,
        repeated: monthlyComplaintSummary.repeated
      },
      complaints: {
        total: totalComplaints,
        pending: pendingComplaints,
        resolved: resolvedComplaints,
        thisWeek: thisWeekComplaints,
        repeated: repeatedComplaints,
        // Detailed status breakdown for all statuses
        statusBreakdown: statusCounts
      },
      isTodayAttendance: isTodayAttendance,
      attendance: {
        isTodayMarked: isTodayAttendance,
        canMark: canMarkAttendance,
        message: attendanceMessage,
        timeRestrictions: {
          startTime: '5:00 AM',
          endTime: '10:00 PM',
          note: 'Attendance can only be marked between 5:00 AM and 10:00 PM'
        }
      },
      recentComplaints: complaints.slice(0, 5) // Last 5 complaints
    };



    return sendSuccess(res, dashboardData, 'Engineer dashboard analytics retrieved successfully with monthly summaries');
  } catch (error: any) {
    console.error('Get engineer dashboard analytics error:', error);
    return sendError(res, 'Failed to get engineer dashboard analytics', 500, error);
  }
};

// Get all complaints for a specific engineer with pagination, populated data, and status filtering
export const getAllComplaintForEnginer = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = (req as any).userId; // engineerId

    // Get pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get status filter parameter
    const statusFilter = req.query.status as string;

    // Build query filters
    const queryFilters: any = { engineer: userId };
    if (statusFilter && statusFilter !== 'all') {
      queryFilters.status = statusFilter;
    }

    // Get total count of complaints for this engineer (with status filter if applied)
    const totalComplaints = await ComplaintModel.countDocuments(queryFilters);

    // Get complaints with pagination, sorted by latest assigned first
    const complaints = await ComplaintModel.find(queryFilters)
      .populate('user', 'firstName lastName phoneNumber countryCode email address')
      .populate('issueType', 'name description')
      .populate('assignedBy', 'firstName lastName')
      .select('_id id title issueDescription complaintType type issueType phoneNumber priority status statusColor visitDate resolved resolutionDate notResolvedReason resolutionNotes remark attachments estimatedResolutionTime actualResolutionTime createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get comprehensive counts by status for this engineer
    const statusCounts = await ComplaintModel.aggregate([
      { $match: { engineer: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Convert to object format for easier access
    const statusBreakdown: any = {};
    statusCounts.forEach((item: any) => {
      statusBreakdown[item._id] = item.count;
    });

    // Ensure all statuses are represented (even if count is 0)
    const allStatuses = ['pending', 'assigned', 'in_progress', 'visited', 'resolved', 'not_resolved', 'cancelled', 'reopened'];
    allStatuses.forEach(status => {
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = 0;
      }
    });

    const totalPages = Math.ceil(totalComplaints / limit);

    const response = {
      complaints,
      pagination: {
        currentPage: page,
        totalPages,
        totalComplaints,
        complaintsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      summary: {
        totalComplaints,
        // Status breakdown for all statuses
        statusBreakdown,
        // Quick summary counts
        pendingCount: (statusBreakdown.pending || 0) + (statusBreakdown.assigned || 0) + (statusBreakdown.in_progress || 0) + (statusBreakdown.visited || 0),
        resolvedCount: statusBreakdown.resolved || 0,
        activeCount: (statusBreakdown.assigned || 0) + (statusBreakdown.in_progress || 0) + (statusBreakdown.visited || 0),
        closedCount: (statusBreakdown.resolved || 0) + (statusBreakdown.not_resolved || 0) + (statusBreakdown.cancelled || 0)
      },
      filters: {
        currentStatus: statusFilter || 'all',
        availableStatuses: allStatuses.map(status => ({
          value: status,
          label: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          count: statusBreakdown[status] || 0
        }))
      }
    };

    return sendSuccess(res, response, 'Complaints retrieved successfully');

  } catch (error) {
    next(error);
  }
};

export const addUserFromExcel = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { files } = req;
    const addedBy = (req as any).userId; // Logged in user ID who is uploading

    if (!files || !Array.isArray(files) || files.length === 0) {
      return sendError(res, 'No files uploaded', 400);
    }

    // Validate each file object
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Validating file ${i}:`, {
        originalname: file?.originalname,
        mimetype: file?.mimetype,
        size: file?.size,
        hasBuffer: !!file?.buffer,
        hasPath: !!file?.path,
        bufferLength: file?.buffer?.length,
        path: file?.path,
        keys: file ? Object.keys(file) : 'undefined'
      });

      if (!file || typeof file !== 'object') {
        return sendError(res, `File at index ${i} is invalid`, 400);
      }
      if (!file.originalname) {
        return sendError(res, `File at index ${i} is missing original name`, 400);
      }
      // Check if file has either buffer (memory storage) or path (disk storage)
      if (!file.buffer && !file.path) {
        return sendError(res, `File ${file.originalname} is missing required properties (neither buffer nor path)`, 400);
      }
    }

    if (!addedBy) {
      return sendError(res, 'User authentication required', 401);
    }

    const results: {
      totalFiles: number;
      processedFiles: number;
      totalUsers: number;
      newUsers: number;
      updatedUsers: number;
      duplicateUsers: number;
      errors: string[];
      fileResults: Array<{
        fileName: string;
        totalUsers: number;
        newUsers: number;
        updatedUsers: number;
        duplicateUsers: number;
        errors: string[];
        duplicateDetails: Array<{
          phoneNumber: string;
          email: string;
          action: 'updated' | 'skipped';
        }>;
      }>;
    } = {
      totalFiles: files.length,
      processedFiles: 0,
      totalUsers: 0,
      newUsers: 0,
      updatedUsers: 0,
      duplicateUsers: 0,
      errors: [],
      fileResults: []
    };

    // Process each uploaded file
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.originalname}`);
        const fileResult = await processExcelFile(file, addedBy);
        results.fileResults.push(fileResult);
        results.processedFiles++;
        results.totalUsers += fileResult.totalUsers;
        results.newUsers += fileResult.newUsers;
        results.updatedUsers += fileResult.updatedUsers;
        results.duplicateUsers += fileResult.duplicateUsers;
        results.errors.push(...fileResult.errors);
      } catch (fileError: any) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        const errorMessage = file.originalname
          ? `File ${file.originalname}: ${fileError.message}`
          : `Unknown file: ${fileError.message}`;
        results.errors.push(errorMessage);
      }
    }

    // Prepare response message
    let message = `Processed ${results.processedFiles} files. `;
    if (results.newUsers > 0) message += `Added ${results.newUsers} new users. `;
    if (results.updatedUsers > 0) message += `Updated ${results.updatedUsers} existing users. `;
    if (results.duplicateUsers > 0) message += `Found ${results.duplicateUsers} duplicate users (based on phone number). `;
    if (results.errors.length > 0) message += `${results.errors.length} errors occurred.`;

    return sendSuccess(res, results, message);
  } catch (error: any) {
    console.error('Excel upload error:', error);
    return sendError(res, 'Failed to process Excel files', 500, error);
  }
};

// Helper function to process individual Excel file
const processExcelFile = async (file: Express.Multer.File, addedBy: string) => {
  // Validate file object
  if (!file) {
    throw new Error('File object is undefined');
  }

  if (!file.originalname) {
    throw new Error('File has no original name');
  }

  // Check if file has buffer (memory storage) or path (disk storage)
  if (!file.buffer && !file.path) {
    throw new Error('File has neither buffer data nor file path');
  }

  const fileResult = {
    fileName: file.originalname,
    totalUsers: 0,
    newUsers: 0,
    updatedUsers: 0,
    duplicateUsers: 0,
    errors: [] as string[],
    duplicateDetails: [] as Array<{
      phoneNumber: string;
      email: string;
      action: 'updated' | 'skipped';
    }>
  };

  try {
    // Debug file information
    console.log('File info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      bufferLength: file.buffer ? file.buffer.length : 'undefined',
      bufferType: file.buffer ? typeof file.buffer : 'undefined',
      path: file.path || 'undefined'
    });

    let fileBuffer: Buffer;

    // Handle both memory storage (buffer) and disk storage (path)
    if (file.buffer) {
      // Memory storage - use buffer directly
      if (!file.buffer || file.buffer.length === 0) {
        throw new Error('File buffer is empty or corrupted');
      }

      if (!Buffer.isBuffer(file.buffer)) {
        throw new Error('File buffer is not a valid Buffer object');
      }

      if (file.buffer.length < 100) {
        throw new Error('File is too small to be a valid Excel file');
      }

      fileBuffer = file.buffer;
    } else if (file.path) {
      // Disk storage - read file from disk
      try {
        fileBuffer = fs.readFileSync(file.path);

        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error('File read from disk is empty or corrupted');
        }

        if (fileBuffer.length < 100) {
          throw new Error('File read from disk is too small to be a valid Excel file');
        }
      } catch (readError: any) {
        throw new Error(`Failed to read file from disk: ${readError.message}`);
      }
    } else {
      throw new Error('No file data available (neither buffer nor path)');
    }

    // Check file extension
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    if (!fileExtension || !['xls', 'xlsx', 'csv'].includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}. Only .xls, .xlsx, and .csv files are supported`);
    }

    // Parse Excel file with error handling
    let workbook;
    try {
      // Try different parsing options
      workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
    } catch (xlsxError: any) {
      console.error('XLSX parsing error:', xlsxError);

      // Try alternative parsing method
      try {
        console.log('Trying alternative parsing method...');
        workbook = XLSX.read(fileBuffer, {
          type: 'buffer',
          cellDates: false,
          cellNF: false,
          cellText: true
        });
      } catch (altError: any) {
        console.error('Alternative parsing also failed:', altError);

        // Provide more specific error messages based on the error type
        if (xlsxError.message.includes('Cannot read properties of undefined')) {
          throw new Error('Excel file appears to be corrupted or in an unsupported format. Please ensure the file is a valid Excel file (.xls, .xlsx) and try again.');
        } else if (xlsxError.message.includes('password')) {
          throw new Error('Excel file appears to be password-protected. Please remove the password protection and try again.');
        } else {
          throw new Error(`Failed to parse Excel file: ${xlsxError.message}. Alternative method also failed: ${altError.message}`);
        }
      }
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no sheets');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error('Could not read worksheet from Excel file');
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length < 2) {
      throw new Error('Excel file must have at least header row and one data row');
    }

    // Extract headers and data
    const headers = data[0] as string[];
    if (!headers || !Array.isArray(headers)) {
      throw new Error('Invalid header row in Excel file');
    }

    const rows = data.slice(1) as any[][];
    if (!rows || !Array.isArray(rows)) {
      throw new Error('No data rows found in Excel file');
    }

    // Map Excel headers to User model fields (PHONE_NO is primary unique identifier)
    const headerMapping: { [key: string]: string } = {
      'PHONE_NO': 'phoneNumber',      // Primary unique identifier
      'PHONE_N': 'phoneNumber',       // Primary unique identifier
      'PHONE N': 'phoneNumber',       // Primary unique identifier
      'MOBILE_NO': 'phoneNumber',     // Primary unique identifier
      'MOBILE': 'phoneNumber',        // Primary unique identifier
      'OLT_IP': 'oltIp',
      'MTCE_FRANCHISE_CODE': 'mtceFranchise',
      'MTCE_FRANCHISE': 'mtceFranchise',
      'CATEGORY': 'category',
      'CATEG': 'category',
      'CUSTOMER_NAME': 'firstName',
      'CUSTOMER NAME': 'firstName',
      'EMAIL_ID': 'email',
      'EMAIL ID': 'email',
      'BB_USER_ID': 'bbUserId',
      'BB USER ID': 'bbUserId',
      'FTTH_EXCHANGE': 'ftthExchange',
      'FTTH_EXCH': 'ftthExchange',
      'FTTH_EXCH_PLAN': 'ftthExchangePlan',
      'PLAN_ID': 'planId',
      'BB_PLAN': 'bbPlan',
      'BB PLAN': 'bbPlan',
      'LL_INSTALL_DATE': 'llInstallDate',
      'LL_INSTALL': 'llInstallDate',
      'WKG_STATUS': 'workingStatus',
      'WKG_ST': 'workingStatus',
      'VKG_ST': 'workingStatus',
      'ASSIGNED_TO': 'assigned',
      'ASSIGNED': 'assigned',
      'RURAL_URBAN': 'ruralUrban',
      'RURAL_UR': 'ruralUrban',
      'RURAL_U': 'ruralUrban',
      'ACQUISITION_TYPE': 'acquisitionType'
    };

    // Validate required headers with flexible matching (PHONE_NO is primary unique identifier)
    const requiredHeaders = [
      { key: 'PHONE_NO', patterns: ['PHONE_NO', 'PHONE_N', 'PHONE N', 'PHONE', 'MOBILE_NO', 'MOBILE'] },
      { key: 'CUSTOMER NAME', patterns: ['CUSTOMER_NAME', 'CUSTOMER NAME', 'CUSTOMER'] },
      { key: 'EMAIL_ID', patterns: ['EMAIL_ID', 'EMAIL ID', 'EMAIL'] }
    ];

    const missingHeaders: string[] = [];

    requiredHeaders.forEach(required => {
      const found = headers.some(header =>
        header && required.patterns.some(pattern =>
          header.toString().toUpperCase().includes(pattern.replace('_', '').replace(' ', ''))
        )
      );
      if (!found) {
        missingHeaders.push(required.key);
      }
    });

    console.log('Found headers:', headers);
    console.log('Missing headers:', missingHeaders);

    // Debug header mapping
    console.log('Header mapping results:');
    headers.forEach((header, index) => {
      if (header) {
        const mappedField = headerMapping[header];
        console.log(`Column ${index}: "${header}" -> ${mappedField || 'UNMAPPED'}`);
      }
    });

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Process each row
    console.log(`Processing ${rows.length} rows`);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      try {
        if (!row || !Array.isArray(row) || row.every(cell => !cell)) {
          console.log(`Skipping empty row ${rowIndex + 2}`);
          continue; // Skip empty rows
        }

        // Map row data to user object
        const userData: any = {
          addedBy: addedBy,
          assignedCompany: addedBy,
          isActivated: true,
          isAccountVerified: true,
          isDeactivated: false,
          isSuspended: false
        };

        headers.forEach((header, colIndex) => {
          if (header && row && Array.isArray(row) && colIndex < row.length && row[colIndex] !== undefined && row[colIndex] !== null) {
            const fieldName = headerMapping[header];
            if (fieldName) {
              let value = row[colIndex];

              // Handle special field mappings
              if (fieldName === 'firstName') {
                // Split customer name into firstName and lastName
                const nameParts = value.toString().trim().split(' ');
                userData.firstName = nameParts && nameParts.length > 0 ? nameParts[0] : '';
                userData.lastName = nameParts && nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
              } else if (fieldName === 'llInstallDate') {
                // Convert date string to Date object
                try {
                  userData[fieldName] = new Date(value);
                } catch {
                  userData[fieldName] = null;
                }
              } else if (fieldName === 'expiry') {
                // Convert expiry date string to Date object
                try {
                  userData[fieldName] = new Date(value);
                } catch {
                  userData[fieldName] = null;
                }
              } else if (fieldName === 'registrationDate') {
                // Convert registration date string to Date object
                try {
                  userData[fieldName] = new Date(value);
                } catch {
                  userData[fieldName] = null;
                }
              } else if (fieldName === 'phoneNumber') {
                // Clean phone number - remove all non-numeric characters
                userData[fieldName] = value.toString().replace(/[^0-9]/g, '');
                userData.countryCode = '+91'; // Default to India
              } else {
                userData[fieldName] = value.toString().trim();
              }
            }
          }
        });

        // Validate required fields
        if (!userData.phoneNumber || !userData.email || !userData.firstName) {
          fileResult.errors.push(`Row ${rowIndex + 2}: Missing required fields (phone, email, or name)`);
          continue;
        }

        // Clean phone number for comparison
        const cleanPhoneNumber = userData.phoneNumber.replace(/[^0-9]/g, '');

        // Check if user already exists by phone number (primary unique identifier)
        const existingUser = await UserModel.findOne({
          phoneNumber: cleanPhoneNumber
        });

        if (existingUser) {
          // Check if this is a duplicate entry (same phone number)
          fileResult.duplicateUsers++;
          fileResult.totalUsers++;

          // Add to duplicate details
          fileResult.duplicateDetails.push({
            phoneNumber: cleanPhoneNumber,
            email: userData.email,
            action: 'updated'
          });

          // Update existing user with new data from Excel
          const updateData = { ...userData };
          delete updateData.phoneNumber; // Don't update phone number as it's the unique identifier

          // Update user with new information
          const updatedUser = await UserModel.findByIdAndUpdate(
            existingUser._id,
            {
              ...updateData,
              updatedAt: new Date()
            },
            { new: true, runValidators: true }
          );

          if (updatedUser) {
            fileResult.updatedUsers++;
            console.log(`Updated existing user with phone: ${cleanPhoneNumber}`);
          }
        } else {
          // Create new user
          const newUser = new UserModel({
            ...userData,
            phoneNumber: cleanPhoneNumber, // Use cleaned phone number
            email: userData.email.toLowerCase(),
            role: 'user', // Default role
            userName: userData.email.split('@')[0], // Generate username from email
            country: 'India', // Default country
            status: 'active'
          });

          const savedUser = await newUser.save();
          if (savedUser) {
            fileResult.newUsers++;
            fileResult.totalUsers++;
            console.log(`Created new user with phone: ${cleanPhoneNumber}`);
          }
        }

      } catch (rowError: any) {
        console.error(`Error processing row ${rowIndex + 2}:`, rowError);
        fileResult.errors.push(`Row ${rowIndex + 2}: ${rowError.message}`);
      }
    }

  } catch (error: any) {
    console.error('Excel file processing error:', error);
    fileResult.errors.push(`File processing error: ${error.message}`);
  }

  return fileResult;
};

export const getAllLeaveRequests = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    // as i am admin(company)
    const userId = (req as any).userId;

    // Get pagination parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const ourEngineerIds = await UserModel.find({
      role: 'engineer',
      parentCompany: userId
    }).select("_id");

    // Get total count for pagination
    const totalCount = await LeaveRequestModel.countDocuments({
      engineer: { $in: ourEngineerIds }
    });

    // Get leave requests with pagination and sort by latest first
    const leaveRequests = await LeaveRequestModel.find({
      engineer: { $in: ourEngineerIds }
    })
      .sort({ createdAt: -1 }) // Latest first
      .skip(skip)
      .limit(limit)
      .populate('engineer', '_id firstName lastName email phoneNumber')
      .populate('approvedBy', '_id firstName lastName email phoneNumber companyName companyAddress companyPhone companyEmail companyWebsite companyLogo companyDescription')
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      success: true,
      data: {
        leaveRequests,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    next(error);
  }
}

export const getLeaveRequestAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    // as i am admin(company)
    // This function returns all leave request data by default
    // Filters are only applied when specifically provided in query parameters
    const userId = (req as any).userId;

    // Get filter parameters from query
    const {
      dateRange,
      status,
      leaveType,
      reason,
      engineerId,
      month,
      year
    } = req.query;

    // Build date filter - only apply if specific filters are provided
    let dateFilter = {};
    if (dateRange) {
      const [startDate, endDate] = (dateRange as string).split(',');
      if (startDate && endDate) {
        dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
    } else if (month && year) {
      // Filter by specific month and year
      const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
      const endDate = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59, 999);
      dateFilter = {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
    }
    // If no date filters provided, don't apply any date restriction (get all data)

    // Build status filter
    let statusFilter = {};
    if (status && status !== 'all') {
      statusFilter = { status: status };
    }

    // Build leave type filter
    let leaveTypeFilter = {};
    if (leaveType && leaveType !== 'all') {
      leaveTypeFilter = { leaveType: leaveType };
    }

    // Build reason filter
    let reasonFilter = {};
    if (reason && reason !== 'all') {
      reasonFilter = { reason: reason };
    }

    // Build engineer filter
    let engineerFilter = {};
    if (engineerId && engineerId !== 'all') {
      engineerFilter = { engineer: engineerId };
    }

    // Get our engineer IDs
    const ourEngineerIds = await UserModel.find({
      role: 'engineer',
      parentCompany: userId
    }).select("_id");

    // Combine all filters
    const combinedFilter = {
      engineer: { $in: ourEngineerIds },
      ...dateFilter,
      ...statusFilter,
      ...leaveTypeFilter,
      ...reasonFilter,
      ...engineerFilter
    };

    // Get total count for current filters
    const totalCount = await LeaveRequestModel.countDocuments(combinedFilter);

    // Get leave requests with current filters
    const leaveRequests = await LeaveRequestModel.find(combinedFilter)
      .sort({ createdAt: -1 })
      .populate('engineer', '_id firstName lastName email phoneNumber')
      .populate('approvedBy', '_id firstName lastName email phoneNumber companyName')
      .lean();

    // Calculate analytics
    const totalRequests = totalCount;
    const pendingRequests = leaveRequests.filter(lr => lr.status === 'pending').length;
    const approvedRequests = leaveRequests.filter(lr => lr.status === 'approved').length;
    const rejectedRequests = leaveRequests.filter(lr => lr.status === 'rejected').length;
    const cancelledRequests = leaveRequests.filter(lr => lr.status === 'cancelled').length;

    // Calculate approval rate and other percentages
    const approvalRate = totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0;
    const rejectionRate = totalRequests > 0 ? (rejectedRequests / totalRequests) * 100 : 0;
    const pendingRate = totalRequests > 0 ? (pendingRequests / totalRequests) * 100 : 0;

    // Calculate total days
    const totalDays = leaveRequests.reduce((sum, lr) => sum + (lr.totalDays || 0), 0);
    const approvedDays = leaveRequests
      .filter(lr => lr.status === 'approved')
      .reduce((sum, lr) => sum + (lr.totalDays || 0), 0);

    // Calculate average processing time (days from creation to approval/rejection)
    const processedRequests = leaveRequests.filter(lr =>
      lr.status === 'approved' || lr.status === 'rejected'
    );

    let avgProcessingDays = 0;
    if (processedRequests.length > 0) {
      const totalProcessingTime = processedRequests.reduce((sum, lr) => {
        if (lr.approvedAt) {
          const created = new Date(lr.createdAt);
          const processed = new Date(lr.approvedAt);
          const diffTime = Math.abs(processed.getTime() - created.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return sum + diffDays;
        }
        return sum;
      }, 0);
      avgProcessingDays = totalProcessingTime / processedRequests.length;
    }

    // Status distribution
    const statusDistribution = {
      pending: pendingRequests,
      approved: approvedRequests,
      rejected: rejectedRequests,
      cancelled: cancelledRequests
    };

    // Leave type distribution
    const leaveTypeDistribution = leaveRequests.reduce((acc, lr) => {
      acc[lr.leaveType] = (acc[lr.leaveType] || 0) + 1;
      return acc;
    }, {} as any);

    // Reason distribution
    const reasonDistribution = leaveRequests.reduce((acc, lr) => {
      acc[lr.reason] = (acc[lr.reason] || 0) + 1;
      return acc;
    }, {} as any);

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthCount = await LeaveRequestModel.countDocuments({
        engineer: { $in: ourEngineerIds },
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      monthlyTrend.push({
        month: date.toLocaleString('default', { month: 'short' }),
        year: date.getFullYear(),
        count: monthCount
      });
    }

    // Yearly trend (last 3 years) - useful for global analytics
    const yearlyTrend = [];
    for (let i = 2; i >= 0; i--) {
      const year = new Date().getFullYear() - i;
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

      const yearCount = await LeaveRequestModel.countDocuments({
        engineer: { $in: ourEngineerIds },
        createdAt: { $gte: yearStart, $lte: yearEnd }
      });

      yearlyTrend.push({
        year: year,
        count: yearCount
      });
    }

    // Engineer-wise statistics
    const engineerStats = await LeaveRequestModel.aggregate([
      {
        $match: {
          engineer: { $in: ourEngineerIds },
          ...(Object.keys(dateFilter).length > 0 ? dateFilter : {})
        }
      },
      {
        $group: {
          _id: '$engineer',
          totalRequests: { $sum: 1 },
          approvedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          totalDays: { $sum: '$totalDays' },
          approvedDays: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$totalDays', 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'engineerData'
        }
      },
      {
        $project: {
          engineerId: '$_id',
          engineerName: {
            $concat: [
              { $arrayElemAt: ['$engineerData.firstName', 0] },
              ' ',
              { $arrayElemAt: ['$engineerData.lastName', 0] }
            ]
          },
          totalRequests: 1,
          approvedRequests: 1,
          totalDays: 1,
          approvedDays: 1,
          approvalRate: {
            $cond: [
              { $gt: ['$totalRequests', 0] },
              { $multiply: [{ $divide: ['$approvedRequests', '$totalRequests'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $sort: { totalRequests: -1 }
      }
    ]);

    // Response data
    const analyticsData = {
      overview: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        cancelledRequests,
        totalDays,
        approvedDays,
        avgProcessingDays: Math.round(avgProcessingDays * 10) / 10,
        approvalRate: Math.round(approvalRate * 10) / 10,
        rejectionRate: Math.round(rejectionRate * 10) / 10,
        pendingRate: Math.round(pendingRate * 10) / 10
      },
      distribution: {
        status: statusDistribution,
        leaveType: leaveTypeDistribution,
        reason: reasonDistribution
      },
      trends: {
        monthly: monthlyTrend,
        yearly: yearlyTrend
      },
      engineerStats,
      filters: {
        dateRange: Object.keys(dateFilter).length > 0 ? dateFilter : 'all',
        status: status || 'all',
        leaveType: leaveType || 'all',
        reason: reason || 'all',
        engineerId: engineerId || 'all',
        month: month || 'all',
        year: year || 'all'
      }
    };

    return res.status(200).json({
      success: true,
      data: analyticsData
    });

  } catch (error) {
    next(error);
  }
};

export const approveRejectLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    // as i am admin(company)
    const userId = (req as any).userId;
    const { leaveRequestId, type, remarks, rejectionReason } = req.body;

    // Validate required fields
    if (!leaveRequestId) {
      return res.status(400).json({
        success: false,
        message: 'Leave request ID is required'
      });
    }

    if (!type || ![1, 2].includes(Number(type))) {
      return res.status(400).json({
        success: false,
        message: 'Type must be 1 (approve) or 2 (reject)'
      });
    }

    // Get our engineer IDs to ensure we can only manage our engineers' requests
    const ourEngineerIds = await UserModel.find({
      role: 'engineer',
      parentCompany: userId
    }).select("_id");

    // Find the leave request
    const leaveRequest = await LeaveRequestModel.findOne({
      _id: leaveRequestId,
      engineer: { $in: ourEngineerIds }
    }).populate('engineer', 'firstName lastName email phoneNumber');

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or you are not authorized to manage this request'
      });
    }

    // Check if request is already processed
    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Leave request is already ${leaveRequest.status}`
      });
    }

    let updateData: any = {
      updatedAt: new Date()
    };

    if (Number(type) === 1) {
      // Approve the request
      updateData.status = 'approved';
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
      if (remarks) {
        updateData.remarks = remarks;
      }
    } else if (Number(type) === 2) {
      // Reject the request
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required when rejecting a leave request'
        });
      }
      updateData.status = 'rejected';
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
      updateData.rejectionReason = rejectionReason;
      if (remarks) {
        updateData.remarks = remarks;
      }
    }

    // Update the leave request
    const updatedLeaveRequest = await LeaveRequestModel.findByIdAndUpdate(
      leaveRequestId,
      updateData,
      { new: true, runValidators: true }
    ).populate('engineer', 'firstName lastName email phoneNumber')
      .populate('approvedBy', 'firstName lastName email companyName');

    if (!updatedLeaveRequest) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update leave request'
      });
    }

    // Prepare response message
    const action = Number(type) === 1 ? 'approved' : 'rejected';
    const message = `Leave request has been ${action} successfully`;

    // You can add email notification logic here if needed
    // await sendLeaveRequestNotification(updatedLeaveRequest, action);

    return res.status(200).json({
      success: true,
      message,
      data: {
        leaveRequest: updatedLeaveRequest,
        action: action,
        processedAt: updatedLeaveRequest.approvedAt,
        processedBy: updatedLeaveRequest.approvedBy
      }
    });

  } catch (error) {
    next(error);
  }
};

// Get users added via Excel without customer/modem data
export const getExcelUsersWithoutCompleteData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const companyId = (req as any).userId;

    // Get pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get all users who have addedBy field (indicating they were added via Excel)
    const excelUsersQuery = {
      addedBy: { $exists: true, $ne: null },
      assignedCompany: companyId,
      role: Role.USER
    };

    // Handle search functionality for Excel users
    if (req.query.search) {
      const searchTerm = req.query.search as string;
      (excelUsersQuery as any).$or = [
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { phoneNumber: { $regex: searchTerm, $options: 'i' } },
        { landlineNumber: { $regex: searchTerm, $options: 'i' } },
        { bbUserId: { $regex: searchTerm, $options: 'i' } },
        { mtceFranchise: { $regex: searchTerm, $options: 'i' } },
        { companyPreference: { $regex: searchTerm, $options: 'i' } },
        { permanentAddress: { $regex: searchTerm, $options: 'i' } },
        { residentialAddress: { $regex: searchTerm, $options: 'i' } },
        { ruralUrban: { $regex: searchTerm, $options: 'i' } },
        { acquisitionType: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } },
        { ftthExchangePlan: { $regex: searchTerm, $options: 'i' } },
        { bbPlan: { $regex: searchTerm, $options: 'i' } },
        { workingStatus: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Get total count of Excel users
    const totalExcelUsersCount = await UserModel.countDocuments(excelUsersQuery);

    // Get paginated Excel users
    const excelUsers = await UserModel.find(excelUsersQuery)
      .select("_id firstName lastName email phoneNumber companyPreference permanentAddress residentialAddress landlineNumber mtceFranchise bbUserId bbPassword ruralUrban acquisitionType category ftthExchangePlan llInstallDate bbPlan workingStatus addedBy createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get user IDs for checking related data
    const userIds = excelUsers.map((user: any) => user._id);

    // Check which users have customer data
    const customerData = await CustomerModel.find({
      userId: { $in: userIds }
    }).select("_id userId fdbId oltId isInstalled createdAt updatedAt")
      .populate('fdbId', 'fdbId fdbName')
      .populate('oltId', 'oltId oltName');

    // Check which users have modem data
    const modemData = await Modem.find({
      userId: { $in: userIds }
    }).select("_id userId modemName ontType modelNumber serialNumber ontMac username password createdAt updatedAt");

    // Create a map for quick lookup
    const customerMap = new Map();
    customerData.forEach(customer => {
      customerMap.set(customer.userId.toString(), customer);
    });

    const modemMap = new Map();
    modemData.forEach(modem => {
      modemMap.set(modem.userId.toString(), modem);
    });

    // Combine data and categorize users
    const combinedData = excelUsers.map((user: any) => {
      const customer = customerMap.get(user._id.toString());
      const modem = modemMap.get(user._id.toString());

      return {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          companyPreference: user.companyPreference,
          permanentAddress: user.permanentAddress,
          residentialAddress: user.residentialAddress,
          landlineNumber: user.landlineNumber,
          mtceFranchise: user.mtceFranchise,
          bbUserId: user.bbUserId,
          bbPassword: user.bbPassword,
          ruralUrban: user.ruralUrban,
          acquisitionType: user.acquisitionType,
          category: user.category,
          ftthExchangePlan: user.ftthExchangePlan,
          llInstallDate: user.llInstallDate,
          bbPlan: user.bbPlan,
          workingStatus: user.workingStatus,
          addedBy: user.addedBy,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        customer: customer ? {
          _id: customer._id,
          fdbId: customer.fdbId,
          oltId: customer.oltId,
          isInstalled: customer.isInstalled,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt
        } : null,
        modem: modem ? {
          _id: modem._id,
          modemName: modem.modemName,
          ontType: modem.ontType,
          modelNumber: modem.modelNumber,
          serialNumber: modem.serialNumber,
          ontMac: modem.ontMac,
          username: modem.username,
          password: modem.password,
          createdAt: modem.createdAt,
          updatedAt: modem.updatedAt
        } : null,
        dataStatus: {
          hasCustomerData: !!customer,
          hasModemData: !!modem,
          isComplete: !!(customer && modem)
        }
      };
    });

    // Calculate summary statistics
    const totalExcelUsers = totalExcelUsersCount;
    const usersWithCustomerData = customerData.length;
    const usersWithModemData = modemData.length;
    const usersWithCompleteData = combinedData.filter(item => item.dataStatus.isComplete).length;
    const usersWithoutCustomerData = totalExcelUsers - usersWithCustomerData;
    const usersWithoutModemData = totalExcelUsers - usersWithModemData;
    const usersWithIncompleteData = totalExcelUsers - usersWithCompleteData;

    // Calculate pagination info
    const totalPages = Math.ceil(totalExcelUsersCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = {
      summary: {
        totalExcelUsers,
        usersWithCustomerData,
        usersWithModemData,
        usersWithCompleteData,
        usersWithoutCustomerData,
        usersWithoutModemData,
        usersWithIncompleteData
      },
      users: combinedData,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: totalExcelUsersCount,
        usersPerPage: limit,
        hasNextPage,
        hasPrevPage
      }
    };

    return sendSuccess(res, response, 'Excel users data fetched successfully');

  } catch (error: any) {
    console.error("Error in getExcelUsersWithoutCompleteData:", error);
    return sendError(res, 'Failed to fetch Excel users data', 500, error);
  }
};

export const getUserManagementData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const companyId = (req as any).userId;
    const type = req.query.type as string | undefined;
    console.log('Internet Provider Type:', type);

    // Get pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Validate internetProviderId if provided
    let internetProviderId: Types.ObjectId | undefined;
    if (type) {
      if (!Types.ObjectId.isValid(type)) {
        return sendError(res, 'Invalid internet provider ID format', 400);
      }
      internetProviderId = new Types.ObjectId(type);
    }

    // Get customer data first to find which users have customer records
    const customerData = await CustomerModel.find({
      userId: { $exists: true }
    }).select("_id userId fdbId oltId isInstalled createdAt updatedAt")
      .populate('fdbId', 'fdbId fdbName')
      .populate('oltId', 'oltId oltName');

    // Extract user IDs from customer data
    const customerUserIds = customerData.map(customer => customer.userId as any);

    // Get Excel users (users added via Excel upload)
    const excelUsers = await UserModel.find({
      addedBy: { $exists: true, $ne: null },
      assignedCompany: companyId,
      role: Role.USER,
      internetProviderId: internetProviderId || { $exists: true }
    }).select("_id");

    const excelUserIds = excelUsers.map((user: any) => user._id);

    // Combine both customer users and Excel users
    const allUserIds = [...new Set([...customerUserIds, ...excelUserIds])];

    // Handle search functionality
    let filteredUserIds = allUserIds;
    if (req.query.search) {
      const searchTerm = req.query.search as string;
      console.log('Search term:', searchTerm);

      // Search in User collection across ALL users (both customer and Excel users)
      const userSearchQuery = {
        $and: [
          {
            $or: [
              { firstName: { $regex: searchTerm, $options: 'i' } },
              { lastName: { $regex: searchTerm, $options: 'i' } },
              { email: { $regex: searchTerm, $options: 'i' } },
              { phoneNumber: { $regex: searchTerm, $options: 'i' } },
              { landlineNumber: { $regex: searchTerm, $options: 'i' } },
              { bbUserId: { $regex: searchTerm, $options: 'i' } },
              { mtceFranchise: { $regex: searchTerm, $options: 'i' } },
              { companyPreference: { $regex: searchTerm, $options: 'i' } },
              { permanentAddress: { $regex: searchTerm, $options: 'i' } },
              { residentialAddress: { $regex: searchTerm, $options: 'i' } },
              { ruralUrban: { $regex: searchTerm, $options: 'i' } },
              { acquisitionType: { $regex: searchTerm, $options: 'i' } },
              { category: { $regex: searchTerm, $options: 'i' } },
              { ftthExchangePlan: { $regex: searchTerm, $options: 'i' } },
              { bbPlan: { $regex: searchTerm, $options: 'i' } },
              { workingStatus: { $regex: searchTerm, $options: 'i' } }
            ]
          },
          {
            internetProviderId: internetProviderId || { $exists: true }
          }
        ]
      };

      // Search in Modem collection across ALL modems
      const modemSearchQuery = {
        $or: [
          { modemName: { $regex: searchTerm, $options: 'i' } },
          { modelNumber: { $regex: searchTerm, $options: 'i' } },
          { serialNumber: { $regex: searchTerm, $options: 'i' } },
          { ontMac: { $regex: searchTerm, $options: 'i' } },
          { username: { $regex: searchTerm, $options: 'i' } },
          { password: { $regex: searchTerm, $options: 'i' } }
        ]
      };


      // Get user IDs from both searches
      const [userResults, modemResults] = await Promise.all([
        UserModel.find(userSearchQuery).select('_id'),
        Modem.find(modemSearchQuery).select('userId')
      ]);

      const userUserIds = userResults.map((user: any) => user._id.toString());
      const modemUserIds = modemResults.map((modem: any) => modem.userId.toString());

      // Combine all user IDs and remove duplicates
      const searchResultUserIds = [...new Set([...userUserIds, ...modemUserIds])];
      console.log('Search results found:', searchResultUserIds.length);
      console.log('Search result IDs:', searchResultUserIds);

      // Filter to only include users who are in our combined list AND match search
      filteredUserIds = allUserIds.filter(id => searchResultUserIds.includes(id.toString()));
      console.log('Filtered user IDs:', filteredUserIds.length);
    }

    // Get total count for pagination (users with customer records + Excel users + search filter)
    const totalUsersCount = await UserModel.countDocuments({
      _id: { $in: filteredUserIds },
      assignedCompany: companyId,
      internetProviderId: internetProviderId || { $exists: true },
      role: Role.USER
    });

    // Get paginated users (both customer users and Excel users with search filter)
    const userManagementData = await UserModel.find({
      _id: { $in: filteredUserIds },
      assignedCompany: companyId,
      role: Role.USER,
      internetProviderId: internetProviderId || { $exists: true }
    }).select("_id firstName lastName email phoneNumber companyPreference permanentAddress residentialAddress landlineNumber mtceFranchise bbUserId bbPassword ruralUrban acquisitionType category ftthExchangePlan llInstallDate bbPlan workingStatus addedBy createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get modem data for these users
    const modemData = await Modem.find({
      userId: { $in: filteredUserIds }
    }).select("_id userId modemName ontType modelNumber serialNumber ontMac username password createdAt updatedAt");

    // Create maps for quick lookup
    const customerMap = new Map();
    customerData.forEach(customer => {
      customerMap.set(customer.userId.toString(), customer);
    });

    const modemMap = new Map();
    modemData.forEach(modem => {
      modemMap.set(modem.userId.toString(), modem);
    });

    // Combine user data with customer and modem information
    const combinedData = userManagementData.map((user: any) => {
      const customer = customerMap.get(user._id.toString());
      const modem = modemMap.get(user._id.toString());

      return {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          companyPreference: user.companyPreference,
          permanentAddress: user.permanentAddress,
          residentialAddress: user.residentialAddress,
          landlineNumber: user.landlineNumber,
          mtceFranchise: user.mtceFranchise,
          bbUserId: user.bbUserId,
          bbPassword: user.bbPassword,
          ruralUrban: user.ruralUrban,
          acquisitionType: user.acquisitionType,
          category: user.category,
          ftthExchangePlan: user.ftthExchangePlan,
          llInstallDate: user.llInstallDate,
          bbPlan: user.bbPlan,
          workingStatus: user.workingStatus,
          addedBy: user.addedBy,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        customer: customer ? {
          _id: customer._id,
          fdbId: customer.fdbId,
          oltId: customer.oltId,
          isInstalled: customer.isInstalled,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt
        } : null,
        modem: modem ? {
          _id: modem._id,
          modemName: modem.modemName,
          ontType: modem.ontType,
          modelNumber: modem.modelNumber,
          serialNumber: modem.serialNumber,
          ontMac: modem.ontMac,
          username: modem.username,
          password: modem.password,
          createdAt: modem.createdAt,
          updatedAt: modem.updatedAt
        } : null,
        dataStatus: {
          hasCustomerData: !!customer,
          hasModemData: !!modem,
          isExcelUser: !!user.addedBy,
          isComplete: !!(customer && modem)
        }
      };
    });

    // Calculate summary statistics (GLOBAL - from ALL users, not just current page)
    const totalUsers = totalUsersCount;
    const usersWithCustomerData = customerData.length;

    // Get ALL modem data for global statistics
    const allModemData = await Modem.find({
      userId: { $in: allUserIds }
    }).select("_id userId");

    const usersWithModemData = allModemData.length;

    // Get ALL customer data for global statistics
    const allCustomerData = await CustomerModel.find({
      userId: { $in: allUserIds }
    }).select("_id userId isInstalled");

    const installedUsers = allCustomerData.filter(customer => customer.isInstalled === true).length;
    const pendingInstallation = allCustomerData.filter(customer => customer.isInstalled === false).length;

    // Calculate Excel users statistics
    const excelUsersCount = excelUsers.length;
    const usersWithCompleteData = combinedData.filter(item => item.dataStatus.isComplete).length;
    const usersWithoutCustomerData = totalUsers - usersWithCustomerData;
    const usersWithoutModemData = totalUsers - usersWithModemData;
    const usersWithIncompleteData = totalUsers - usersWithCompleteData;

    // Calculate pagination info
    const totalPages = Math.ceil(totalUsersCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = {
      summary: {
        totalUsers,
        excelUsersCount,
        usersWithCustomerData,
        usersWithModemData,
        usersWithCompleteData,
        usersWithoutCustomerData,
        usersWithoutModemData,
        usersWithIncompleteData,
        installedUsers: totalUsers - pendingInstallation,
        pendingInstallation
      },
      users: combinedData,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: totalUsersCount,
        usersPerPage: limit,
        hasNextPage,
        hasPrevPage
      }
    };

    return sendSuccess(res, response, 'User management data fetched successfully');

  } catch (error: any) {
    console.error("Error in getUserManagementData:", error);
    return sendError(res, 'Failed to fetch user management data', 500, error);
  }
};



export const addUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const {
      email,
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      companyPreference,
      permanentAddress,
      residentialAddress,
      landlineNumber,
      modemName,
      ontType,
      modelNumber,
      serialNumber,
      ontMac,
      username,
      password,
      fdbId,
      oltId,
      portNumber,
      mtceFranchise,
      bbUserId,
      bbPassword,
      ruralUrban,
      acquisitionType,
      category,
      ftthExchangePlan,
      llInstallDate,
      bbPlan,
      workingStatus,
      isInstalled = true,
      internetProviderId,
      // New additional fields
      fatherName,
      companyService,
      lastOfflineTime,
      onlineTime,
      msPonNumber,
      customerVlan,
      portStatus,
      ontDistance,
      ontTxPower,
      ontRxPower,
      billingOutstandingAmount,
      paymentCollectDate,
      paymentCollectMonth,
      modemRecover,
      billCollect,
      unnamedField22
    } = req.body;

    const companyId = (req as any).userId;

    // Check if user already exists
    const checkUser = await UserModel.findOne({ email });
    if (checkUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    // Check if landline number already exists
    const checkLandLine = await UserModel.findOne({ landlineNumber });
    if (checkLandLine) {
      return res.status(400).json({
        success: false,
        message: "Landline number already exists"
      });
    }

    // Generate random password using a-z and 0-9
    const generatedPassword = generateRandomPassword(8);
    const hashedPassword = await hashPassword(generatedPassword);

    // Convert string boolean values to actual booleans (handle multiple formats)
    let modemRecoverBool: boolean | undefined = undefined;
    let billCollectBool: boolean | undefined = undefined;

    if (modemRecover !== undefined) {
      modemRecoverBool = modemRecover === "yes" || modemRecover === true || modemRecover === "true" || modemRecover === "YES";
    }

    if (billCollect !== undefined) {
      billCollectBool = billCollect === "yes" || billCollect === true || billCollect === "true" || billCollect === "YES";
    }

    // Prepare user data
    const userData = {
      email,
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      companyPreference,
      permanentAddress,
      residentialAddress,
      landlineNumber,
      role: "user",
      mtceFranchise,
      bbUserId,
      bbPassword,
      ruralUrban,
      acquisitionType,
      category,
      ftthExchangePlan,
      llInstallDate,
      bbPlan,
      workingStatus,
      assignedCompany: companyId,
      password: hashedPassword,
      isAccountVerified: true,
      isDeactivated: false,
      isSuspended: false,
      internetProviderId,
      // New additional fields
      fatherName,
      companyService,
      lastOfflineTime,
      onlineTime,
      msPonNumber,
      customerVlan,
      portStatus,
      ontDistance,
      ontTxPower,
      ontRxPower,
      billingOutstandingAmount,
      paymentCollectDate,
      paymentCollectMonth,
      modemRecover: modemRecoverBool,
      billCollect: billCollectBool,
      unnamedField22
    };

    // Validate OLT and FDB before starting transaction
    const olt = await OLTModel.findOne({ oltId });
    if (!olt) {
      return res.status(400).json({
        success: false,
        message: "OLT not found"
      });
    }

    const fdb = await FDBModel.findOne({ fdbId });
    if (!fdb) {
      return res.status(400).json({
        success: false,
        message: "FDB not found"
      });
    }

    // Use database transaction to ensure atomicity
    const session = await UserModel.startSession();

    try {
      const result = await session.withTransaction(async () => {
        // Create new user
        const newUser = new UserModel(userData);
        await newUser.save({ session });

        // Handle FDB port connection if fdbId, oltId, and portNumber are provided
        let fdbConnectionResult = null;
        
        if (fdbId && oltId && portNumber) {
          // Validate port number format (P1, P2, etc.)
          if (!portNumber.match(/^P\d+$/)) {
            throw new Error("Invalid port number format. Must be P1, P2, P3, etc.");
          }

          // Generate ports if they don't exist
          if (!fdb.ports || fdb.ports.length === 0) {
            fdb.generatePorts();
            await fdb.save({ session });
          }

          // Check if port exists for this FDB power
          const portExists = fdb.ports?.some(port => port.portNumber === portNumber);
          if (!portExists) {
            throw new Error(`Port ${portNumber} does not exist for FDB with power ${fdb.fdbPower}`);
          }

          // Check if port is available
          const port = fdb.getPort(portNumber);
          if (!port || port.status !== 'available') {
            throw new Error(`Port ${portNumber} is not available (Status: ${port?.status || 'not found'})`);
          }

          // Connect user to port
          await fdb.connectToPort(portNumber, {
            type: "user",
            id: (newUser._id as mongoose.Types.ObjectId).toString(),
            description: `User ${firstName} ${lastName}`
          });

          // Add to FDB outputs with validation
          const maxOutputs = fdb.fdbPower || 2; // Default to 2 if power not set
          if (!fdb.outputs) {
            fdb.outputs = [];
          }

          // Check output limit
          if (fdb.outputs.length >= maxOutputs) {
            throw new Error(`FDB with power ${fdb.fdbPower} can only have ${maxOutputs} outputs maximum`);
          }

          // Add new output
          fdb.outputs.push({
            type: "user",
            id: (newUser._id as mongoose.Types.ObjectId).toString(),
            portNumber: portNumber,
            description: `User ${firstName} ${lastName}`
          });

          await fdb.save({ session });

          fdbConnectionResult = {
            fdbId: fdb.fdbId,
            fdbName: fdb.fdbName,
            portNumber: portNumber,
            connected: true
          };
        }

        // Execute modem and customer creation atomically using Promise.all
        const [modemResult, customerResult] = await Promise.all([
          Modem.create([{
            userId: newUser._id,
            modemName,
            ontType,
            modelNumber,
            serialNumber,
            ontMac,
            username,
            password
          }], { session }),
          CustomerModel.create([{
            userId: newUser._id,
            fdbId: fdb._id,
            oltId: olt._id,
            isInstalled: isInstalled
          }], { session })
        ]);

        // Return all created records
        return {
          newUser,
          modemResult: modemResult[0],
          customerResult: customerResult[0],
          fdbConnection: fdbConnectionResult
        };
      });

      // Send email with credentials (this can fail without affecting the main operation)
      try {
        await sendMessage.sendEmail({
          userEmail: email,
          subject: "Welcome to WiFi Selfcare - Your Account Credentials",
          text: `Welcome ${firstName}! Your account has been created. Email: ${email}, Password: ${generatedPassword}`,
          html: generateUserCredentialsEmail(email, generatedPassword, firstName)
        });
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't fail the entire operation if email fails
      }

      return res.status(201).json({
        success: true,
        message: "User added successfully. Credentials have been sent to the user's email.",
        data: {
          userId: result.newUser._id,
          email: result.newUser.email,
          firstName: result.newUser.firstName,
          lastName: result.newUser.lastName,
          modemId: result.modemResult._id,
          customerId: result.customerResult._id,
          fdbConnection: result.fdbConnection
        }
      });

    } catch (transactionError) {
      console.error("Transaction failed:", transactionError);
      throw transactionError;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error("Error in addUser:", error);
    next(error);
  }
};


export const getUserDetailForUpdate = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const userId = req.params.id;

    // Validate userId
    if (!userId) {
      return sendError(res, "User ID is required", 400);
    }

    // Fetch user details with comprehensive fields for update
    const user = await UserModel.findById(userId)
      .select('_id firstName lastName email phoneNumber companyPreference permanentAddress residentialAddress landlineNumber mtceFranchise bbUserId bbPassword ruralUrban acquisitionType category ftthExchangePlan llInstallDate bbPlan workingStatus createdAt updatedAt internetProviderId billConnect disconnectReason disconnectDate remarks fatherName companyService lastOfflineTime onlineTime msPonNumber customerVlan portStatus ontDistance ontTxPower ontRxPower billingOutstandingAmount paymentCollectDate paymentCollectMonth modemRecover billCollect unnamedField22')
      .lean();

    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Fetch related modem details
    const modemDetails = await Modem.findOne({ userId: userId }).lean();

    // Fetch related customer details
    const customerDetails = await CustomerModel.findOne({ userId: userId }).populate("fdbId", "fdbId fdbName fdbPower").populate("oltId", "oltId serialNumber oltIp macAddress").lean();

    // Fetch FDB port connection details if customer has FDB connection
    let fdbPortDetails = null;
    if (customerDetails && customerDetails.fdbId) {
      const fdb = await FDBModel.findById(customerDetails.fdbId).lean();
      if (fdb && fdb.ports) {
        // Find which port the user is connected to
        const userPort = fdb.ports.find(port =>
          port.connectedDevice &&
          port.connectedDevice.type === "user" &&
          port.connectedDevice.id === userId
        );

        if (userPort) {
          fdbPortDetails = {
            portNumber: userPort.portNumber,
            status: userPort.status,
            connectionDate: userPort.connectionDate,
            lastMaintenance: userPort.lastMaintenance,
            connectedDevice: userPort.connectedDevice
          };
        }

        // Get all ports for this FDB
        const allPorts = fdb.ports.map(port => ({
          portNumber: port.portNumber,
          status: port.status,
          isAvailable: port.status === 'available',
          isAllocated: port.status === 'occupied',
          allocatedTo: port.connectedDevice ? {
            type: port.connectedDevice.type,
            id: port.connectedDevice.id,
            description: port.connectedDevice.description
          } : null,
          connectionDate: port.connectionDate,
          lastMaintenance: port.lastMaintenance
        }));

        // Add port summary
        const portSummary = {
          totalPorts: fdb.ports.length,
          availablePorts: fdb.ports.filter(port => port.status === 'available').length,
          occupiedPorts: fdb.ports.filter(port => port.status === 'occupied').length,
          maintenancePorts: fdb.ports.filter(port => port.status === 'maintenance').length,
          faultyPorts: fdb.ports.filter(port => port.status === 'faulty').length,
          utilizationPercentage: fdb.ports.length > 0 ? Math.round((fdb.ports.filter(port => port.status === 'occupied').length / fdb.ports.length) * 100) : 0
        };

        fdbPortDetails = {
          ...fdbPortDetails,
          fdbInfo: {
            fdbId: fdb.fdbId,
            fdbName: fdb.fdbName,
            fdbPower: fdb.fdbPower,
            status: fdb.status
          },
          userPort: fdbPortDetails,
          allPorts: allPorts,
          portSummary: portSummary
        };
      }
    }

    return sendSuccess(res, {
      user,
      modemDetails,
      customerDetails,
      fdbPortDetails
    }, "User details fetched successfully for update");
  } catch (error) {
    console.error("Error in getUserDetailForUpdate:", error);
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const {
      userId,
      email,
      firstName,
      lastName,
      phoneNumber,
      countryCode,
      companyPreference,
      permanentAddress,
      residentialAddress,
      landlineNumber,
      modemName,
      ontType,
      modelNumber,
      serialNumber,
      ontMac,
      username,
      password,
      mtceFranchise,
      bbUserId,
      bbPassword,
      ruralUrban,
      acquisitionType,
      category,
      ftthExchangePlan,
      llInstallDate,
      bbPlan,
      workingStatus,
      isInstalled,
      fdbId,
      oltId,
      portNumber,
      internetProviderId,
      billConnect,
      disconnectReason,
      disconnectDate,
      remarks,
      // New additional fields
      fatherName,
      companyService,
      lastOfflineTime,
      onlineTime,
      msPonNumber,
      customerVlan,
      portStatus,
      ontDistance,
      ontTxPower,
      ontRxPower,
      billingOutstandingAmount,
      paymentCollectDate,
      paymentCollectMonth,
      modemRecover,
      billCollect,
      unnamedField22
    } = req.body;

    console.log("req body", req.body);

    // Convert string boolean values to actual booleans (only if provided)
    let modemRecoverBool: boolean | undefined = undefined;
    let billCollectBool: boolean | undefined = undefined;

    if (modemRecover !== undefined) {
      modemRecoverBool = modemRecover === "yes" || modemRecover === true || modemRecover === "true" || modemRecover === "YES";
    }

    if (billCollect !== undefined) {
      billCollectBool = billCollect === "yes" || billCollect === true || billCollect === "true" || billCollect === "YES";
    }

    // Validate userId
    if (!userId) {
      return sendError(res, "User ID is required", 400);
    }

    // Check if user exists
    const existingUser = await UserModel.findById(userId);
    if (!existingUser) {
      return sendError(res, "User not found", 404);
    }

    // Check if email is being updated and if it already exists for another user
    if (email && email !== existingUser.email) {
      const emailExists = await UserModel.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return sendError(res, "Email already exists for another user", 400);
      }
    }

    // Check if landline number is being updated and if it already exists for another user
    if (landlineNumber && landlineNumber !== existingUser.landlineNumber) {
      const landlineExists = await UserModel.findOne({ landlineNumber, _id: { $ne: userId } });
      if (landlineExists) {
        return sendError(res, "Landline number already exists for another user", 400);
      }
    }

    // Use database transaction to ensure atomicity
    const session = await UserModel.startSession();

    try {
      const result = await session.withTransaction(async () => {
        // Prepare user update data
        const userUpdateData: any = {};
        if (email) userUpdateData.email = email;
        if (firstName) userUpdateData.firstName = firstName;
        if (lastName) userUpdateData.lastName = lastName;
        if (phoneNumber) userUpdateData.phoneNumber = phoneNumber;
        if (countryCode) userUpdateData.countryCode = countryCode;
        if (companyPreference) userUpdateData.companyPreference = companyPreference;
        if (permanentAddress) userUpdateData.permanentAddress = permanentAddress;
        if (residentialAddress) userUpdateData.residentialAddress = residentialAddress;
        if (landlineNumber) userUpdateData.landlineNumber = landlineNumber;
        if (mtceFranchise) userUpdateData.mtceFranchise = mtceFranchise;
        if (bbUserId) userUpdateData.bbUserId = bbUserId;
        if (bbPassword) userUpdateData.bbPassword = bbPassword;
        if (ruralUrban) userUpdateData.ruralUrban = ruralUrban;
        if (acquisitionType) userUpdateData.acquisitionType = acquisitionType;
        if (category) userUpdateData.category = category;
        if (ftthExchangePlan) userUpdateData.ftthExchangePlan = ftthExchangePlan;
        if (llInstallDate) userUpdateData.llInstallDate = llInstallDate;
        if (bbPlan) userUpdateData.bbPlan = bbPlan;
        if (workingStatus) userUpdateData.workingStatus = workingStatus;
        if (internetProviderId) userUpdateData.internetProviderId = internetProviderId; //this is for the user which have internet company
        if (billConnect !== undefined) userUpdateData.billConnect = billConnect;
        if (disconnectReason) userUpdateData.disconnectReason = disconnectReason;
        if (disconnectDate) userUpdateData.disconnectDate = disconnectDate;
        if (remarks) userUpdateData.remarks = remarks;
        // New additional fields
        if (fatherName) userUpdateData.fatherName = fatherName;
        if (companyService) userUpdateData.companyService = companyService;
        if (lastOfflineTime) userUpdateData.lastOfflineTime = lastOfflineTime;
        if (onlineTime) userUpdateData.onlineTime = onlineTime;
        if (msPonNumber) userUpdateData.msPonNumber = msPonNumber;
        if (customerVlan) userUpdateData.customerVlan = customerVlan;
        if (portStatus) userUpdateData.portStatus = portStatus;
        if (ontDistance !== undefined) userUpdateData.ontDistance = ontDistance;
        if (ontTxPower !== undefined) userUpdateData.ontTxPower = ontTxPower;
        if (ontRxPower !== undefined) userUpdateData.ontRxPower = ontRxPower;
        if (billingOutstandingAmount !== undefined) userUpdateData.billingOutstandingAmount = billingOutstandingAmount;
        if (paymentCollectDate) userUpdateData.paymentCollectDate = paymentCollectDate;
        if (paymentCollectMonth) userUpdateData.paymentCollectMonth = paymentCollectMonth;
        if (modemRecoverBool !== undefined) userUpdateData.modemRecover = modemRecoverBool;
        if (billCollectBool !== undefined) userUpdateData.billCollect = billCollectBool;
        if (unnamedField22) userUpdateData.unnamedField22 = unnamedField22;
        // Update user
        const updatedUser = await UserModel.findByIdAndUpdate(
          userId,
          userUpdateData,
          { new: true, session }
        );

        // Update modem if modem data is provided
        let updatedModem = null;
        if (modemName || ontType || modelNumber || serialNumber || ontMac || username || password) {
          const modemUpdateData: any = {};
          if (modemName) modemUpdateData.modemName = modemName;
          if (ontType) modemUpdateData.ontType = ontType;
          if (modelNumber) modemUpdateData.modelNumber = modelNumber;
          if (serialNumber) modemUpdateData.serialNumber = serialNumber;
          if (ontMac) modemUpdateData.ontMac = ontMac;
          if (username) modemUpdateData.username = username;
          if (password) modemUpdateData.password = password;

          updatedModem = await Modem.findOneAndUpdate(
            { userId: userId },
            modemUpdateData,
            { new: true, session }
          );
        }

        // Handle FDB port disconnection if user was previously connected
        const currentCustomer = await CustomerModel.findOne({ userId: userId }, null, { session });
        if (currentCustomer && currentCustomer.fdbId) {
          const previousFdb = await FDBModel.findById(currentCustomer.fdbId, null, { session });
          if (previousFdb && previousFdb.outputs) {
            // Find and remove user from previous FDB outputs
            const userOutputIndex = previousFdb.outputs.findIndex(output =>
              output.type === "user" && output.id === userId
            );

            if (userOutputIndex !== -1) {
              const previousPortNumber = previousFdb.outputs[userOutputIndex].portNumber;
              if (previousPortNumber) {
                // Disconnect from previous port
                await previousFdb.disconnectFromPort(previousPortNumber);
                // Remove from outputs
                previousFdb.outputs.splice(userOutputIndex, 1);
                await previousFdb.save({ session });
              }
            }
          }
        }

        // Handle FDB port connection if fdbId, oltId, and portNumber are provided
        let fdbConnectionResult = null;
        let fdb = null;
        let olt = null;

        if (fdbId && oltId && portNumber) {
          // Find FDB by custom fdbId (not MongoDB _id)
          fdb = await FDBModel.findOne({ fdbId: fdbId });
          if (!fdb) {
            throw new Error(`FDB with ID ${fdbId} not found`);
          }

          // Find OLT by custom oltId (not MongoDB _id)
          olt = await OLTModel.findOne({ oltId: oltId });
          if (!olt) {
            throw new Error(`OLT with ID ${oltId} not found`);
          }

          // Generate ports if they don't exist
          if (!fdb.ports || fdb.ports.length === 0) {
            fdb.generatePorts();
            await fdb.save();
          }

          // Validate port number format (P1, P2, etc.)
          if (!portNumber.match(/^P\d+$/)) {
            throw new Error("Invalid port number format. Must be P1, P2, P3, etc.");
          }

          // Check if port exists for this FDB power
          const portExists = fdb.ports?.some(port => port.portNumber === portNumber);
          if (!portExists) {
            throw new Error(`Port ${portNumber} does not exist for FDB with power ${fdb.fdbPower}`);
          }

          // Check if port is available
          const port = fdb.getPort(portNumber);
          if (!port || port.status !== 'available') {
            throw new Error(`Port ${portNumber} is not available (Status: ${port?.status || 'not found'})`);
          }

          // Connect user to port
          await fdb.connectToPort(portNumber, {
            type: "user",
            id: userId,
            description: `User ${existingUser.firstName} ${existingUser.lastName}`
          });

          // Add to FDB outputs with validation
          const maxOutputs = fdb.fdbPower || 2; // Default to 2 if power not set
          if (!fdb.outputs) {
            fdb.outputs = [];
          }

          // Check if user is already in outputs
          const existingOutput = fdb.outputs.find(output =>
            output.type === "user" && output.id === userId
          );

          if (existingOutput) {
            // Update existing output with new port
            existingOutput.portNumber = portNumber;
          } else {
            // Check output limit
            if (fdb.outputs.length >= maxOutputs) {
              throw new Error(`FDB with power ${fdb.fdbPower} can only have ${maxOutputs} outputs maximum`);
            }

            // Add new output
            fdb.outputs.push({
              type: "user",
              id: userId,
              portNumber: portNumber,
              description: `User ${existingUser.firstName} ${existingUser.lastName}`
            });
          }

          await fdb.save();

          fdbConnectionResult = {
            fdbId: fdb.fdbId,
            fdbName: fdb.fdbName,
            portNumber: portNumber,
            connected: true
          };
        }

        // Always update customer record
        let updatedCustomer = null;
        const customerUpdateData: any = {};

        // Update FDB and OLT references if provided (use MongoDB _id from found records)
        if (fdbId && fdb !== null) customerUpdateData.fdbId = fdb._id;
        if (oltId && olt !== null) customerUpdateData.oltId = olt._id;

        // Update isInstalled if provided
        if (isInstalled !== undefined) {
          customerUpdateData.isInstalled = isInstalled;
        }

        // Set installation date if connecting to FDB
        if (fdbId && oltId && portNumber) {
          customerUpdateData.installationDate = new Date();
          customerUpdateData.isInstalled = true;
        }

        // Check if customer exists, if not create one
        // Note: currentCustomer was already fetched above for FDB disconnection

        if (!currentCustomer) {
          // Create new customer record
          updatedCustomer = await CustomerModel.create([{
            userId: userId,
            fdbId: fdbId && fdb !== null ? fdb._id : null,
            oltId: oltId && olt !== null ? olt._id : null,
            isInstalled: customerUpdateData.isInstalled || false,
            installationDate: customerUpdateData.installationDate || null
          }], { session });
          updatedCustomer = updatedCustomer[0];
        } else {
          // Update existing customer record
          updatedCustomer = await CustomerModel.findOneAndUpdate(
            { userId: userId },
            customerUpdateData,
            { new: true, session }
          );
        }

        return {
          updatedUser,
          updatedModem,
          updatedCustomer,
          fdbConnection: fdbConnectionResult
        };
      });

      return sendSuccess(res, {
        user: result.updatedUser,
        modem: result.updatedModem,
        customer: result.updatedCustomer,
        fdbConnection: result.fdbConnection
      }, "User updated successfully");

    } catch (transactionError) {
      console.error("Transaction failed:", transactionError);
      throw transactionError;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error("Error in updateUser:", error);
    next(error);
  }
};

export const getFullClientDetailsById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;

    // First, check if client exists (this needs to be done first)
    const client = await UserModel.findById(id).select("_id name firstName lastName email countryCode phoneNumber fullName profileImage permanentAddress residentialAddress landlineNumber fatherName oltIp mtceFranchise category mobile bbUserId bbPassword ftthExchangePlan bbPlan llInstallDate workingStatus assigned ruralUrban acquisitionType createdAt updatedAt");

    if (!client) {
      return sendError(res, "Client not found", 404);
    }

    // Run all other database queries in parallel using Promise.all
    const [
      modemDetail,
      customerDetail,
      allComplaints,
      orderPurchaseByMe,
      allLeadsByMe,
      allBillUploadedByMe,
      wifiInstallationRequests,
      iptvInstallationRequests,
      ottInstallationRequests,
      fibreInstallationRequests
    ] = await Promise.all([
      // Get modem details
      Modem.findOne({ userId: id }),

      // Get customer details
      CustomerModel.findOne({ userId: id }).populate("oltId").populate("fdbId"),

      // Get all complaints by this client
      ComplaintModel.find({ user: id })
        .populate('engineer', 'name email phoneNumber')
        .sort({ createdAt: -1 }),

      // Get all orders purchased by this client
      orderModel.find({ user: id })
        .populate("products.product")
        .sort({ createdAt: -1 }),

      // Get all leads created by this client
      Leads.find({ byUserId: id })
        .populate('assignedTo', 'name email phoneNumber')
        .sort({ createdAt: -1 }),

      // Get all bill requests uploaded by this client
      RequestBill.find({ userId: id })
        .sort({ createdAt: -1 }),

      // Get WiFi installation requests
      WifiInstallationRequest.find({ userId: id })
        .populate('assignedEngineer', 'name email phoneNumber')
        .sort({ createdAt: -1 }),

      // Get IPTV installation requests
      IptvInstallationRequest.find({ userId: id })
        .populate('assignedEngineer', 'name email phoneNumber')
        .sort({ createdAt: -1 }),

      // Get OTT installation requests
      OttInstallationRequest.find({ userId: id })
        .populate('assignedEngineer', 'name email phoneNumber')
        .sort({ createdAt: -1 }),

      // Get Fibre installation requests
      FibreInstallationRequest.find({ userId: id })
        .populate('assignedEngineer', 'name email phoneNumber')
        .sort({ createdAt: -1 })
    ]);

    // Calculate statistics
    const stats = {
      totalComplaints: allComplaints.length,
      resolvedComplaints: allComplaints.filter(complaint => complaint.status === ComplaintStatus.RESOLVED).length,
      pendingComplaints: allComplaints.filter(complaint => complaint.status === ComplaintStatus.PENDING).length,
      totalOrders: orderPurchaseByMe.length,
      totalLeads: allLeadsByMe.length,
      totalBillRequests: allBillUploadedByMe.length,
      totalInstallationRequests: wifiInstallationRequests.length + iptvInstallationRequests.length + ottInstallationRequests.length + fibreInstallationRequests.length
    };

    // Prepare response data
    const responseData = {
      client: {
        ...client.toObject(),
        // Add computed fields if needed
        fullName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.name,
        isActive: client.workingStatus === 'active'
      },
      modemDetail,
      customerDetail,
      complaints: allComplaints,
      orders: orderPurchaseByMe,
      leads: allLeadsByMe,
      billRequests: allBillUploadedByMe,
      installationRequests: {
        wifi: wifiInstallationRequests,
        iptv: iptvInstallationRequests,
        ott: ottInstallationRequests,
        fibre: fibreInstallationRequests
      },
      statistics: stats
    };

    return sendSuccess(res, responseData, "Client details retrieved successfully");

  } catch (error) {
    console.error("Error in getFullClientDetailsById:", error);
    next(error);
  }
}

export const getFullEngineerDetailsById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const engineerId = req.params.id;
    const userId = (req as any).userId; // Logged in user ID
    const role = (req as any).role; // Logged in user role

    // Validate engineer ID
    if (!engineerId) {
      return sendError(res, 'Engineer ID is required', 400);
    }

    // Build filter conditions based on role
    const filterConditions: any = {
      _id: engineerId,
      role: 'engineer',
      isDeleted: false
    };

    // Role-based filtering
    if (role === 'superadmin') {
      // Superadmin gets all data - no additional filters needed
    } else if (role === 'admin') {
      // Admin gets only engineers where parentCompany equals their userId
      filterConditions.parentCompany = userId;
    }

    // Get engineer details
    const engineer = await UserModel.findOne(filterConditions).select(
      "_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode permanentAddress residenceAddress billingAddress country language companyPreference userName fatherName provider providerId state pincode areaFromPincode aadhaarNumber panNumber aadhaarFront aadhaarBack panCard createdAt updatedAt"
    );

    if (!engineer) {
      return sendError(res, 'Engineer not found', 404);
    }

    // Get all assigned complaints with analytics
    const allAssignedComplaints = await ComplaintModel.find({ engineer: engineerId })
      .populate("user", "firstName lastName email phoneNumber countryCode profileImage")
      .sort({ createdAt: -1 });

    // Calculate complaint analytics
    const totalComplaints = allAssignedComplaints.length;
    const resolvedComplaints = allAssignedComplaints.filter(complaint => complaint.status === 'resolved').length;
    const pendingComplaints = allAssignedComplaints.filter(complaint => complaint.status === 'pending').length;
    const inProgressComplaints = allAssignedComplaints.filter(complaint => complaint.status === 'in_progress').length;

    // Get all leave requests
    const allLeaveRequests = await LeaveRequestModel.find({ engineer: engineerId })
      .sort({ createdAt: -1 });

    // Calculate leave request analytics
    const totalLeaveRequests = allLeaveRequests.length;
    const approvedLeaveRequests = allLeaveRequests.filter(leave => leave.status === 'approved').length;
    const pendingLeaveRequests = allLeaveRequests.filter(leave => leave.status === 'pending').length;
    const rejectedLeaveRequests = allLeaveRequests.filter(leave => leave.status === 'rejected').length;

    // Get attendance records
    const allAttendance = await EngineerAttendanceModel.find({ engineer: engineerId })
      .sort({ createdAt: -1 });

    // Calculate attendance analytics
    const totalAttendanceDays = allAttendance.length;
    const presentDays = allAttendance.filter(attendance => attendance.status === 'present').length;
    const absentDays = allAttendance.filter(attendance => attendance.status === 'absent').length;
    // Calculate late days based on check-in time (assuming work starts at 9 AM)
    const lateDays = allAttendance.filter(attendance => {
      if (attendance.checkInTime) {
        const checkInHour = attendance.checkInTime.getHours();
        const checkInMinute = attendance.checkInTime.getMinutes();
        return checkInHour > 9 || (checkInHour === 9 && checkInMinute > 15); // Late if after 9:15 AM
      }
      return false;
    }).length;

    // Get all installations
    const allInstallations = await WifiInstallationRequest.find({ assignedEngineer: engineerId })
      .populate("userId", "firstName lastName email phoneNumber countryCode profileImage")
      .sort({ createdAt: -1 });

    // Calculate installation analytics
    const totalInstallations = allInstallations.length;
    const approvedInstallations = allInstallations.filter(installation => installation.status === 'approved').length;
    const inReviewInstallations = allInstallations.filter(installation => installation.status === 'inreview').length;
    const rejectedInstallations = allInstallations.filter(installation => installation.status === 'rejected').length;

    // Prepare comprehensive response
    const engineerDetails = {
      // Engineer basic info
      engineer: {
        _id: engineer._id,
        firstName: engineer.firstName,
        lastName: engineer.lastName,
        email: engineer.email,
        phoneNumber: engineer.phoneNumber,
        countryCode: engineer.countryCode,
        profileImage: engineer.profileImage,
        role: engineer.role,
        status: engineer.status,
        group: engineer.group,
        zone: engineer.zone,
        area: engineer.area,
        mode: engineer.mode,
        permanentAddress: engineer.permanentAddress,
        residenceAddress: engineer.residenceAddress,
        billingAddress: engineer.billingAddress,
        country: engineer.country,
        language: engineer.language,
        companyPreference: engineer.companyPreference,
        userName: engineer.userName,
        fatherName: engineer.fatherName,
        provider: engineer.provider,
        providerId: engineer.providerId,
        state: engineer.state,
        pincode: engineer.pincode,
        areaFromPincode: engineer.areaFromPincode,
        aadhaarNumber: engineer.aadhaarNumber,
        panNumber: engineer.panNumber,
        aadhaarFront: engineer.aadhaarFront,
        aadhaarBack: engineer.aadhaarBack,
        panCard: engineer.panCard,
        createdAt: engineer.createdAt,
        updatedAt: engineer.updatedAt
      },

      // Analytics summary
      analytics: {
        complaints: {
          total: totalComplaints,
          resolved: resolvedComplaints,
          pending: pendingComplaints,
          inProgress: inProgressComplaints
        },
        leaveRequests: {
          total: totalLeaveRequests,
          approved: approvedLeaveRequests,
          pending: pendingLeaveRequests,
          rejected: rejectedLeaveRequests
        },
        attendance: {
          totalDays: totalAttendanceDays,
          present: presentDays,
          absent: absentDays,
          late: lateDays,
          attendancePercentage: totalAttendanceDays > 0 ? Math.round((presentDays / totalAttendanceDays) * 100) : 0
        },
        installations: {
          total: totalInstallations,
          approved: approvedInstallations,
          inReview: inReviewInstallations,
          rejected: rejectedInstallations,
          approvalRate: totalInstallations > 0 ? Math.round((approvedInstallations / totalInstallations) * 100) : 0
        }
      },

      // Detailed records - Complete arrays
      records: {
        complaints: allAssignedComplaints, // All complaints
        leaveRequests: allLeaveRequests, // All leave requests
        attendance: allAttendance, // All attendance records
        installations: allInstallations // All installations
      }
    };

    return sendSuccess(res, engineerDetails, 'Engineer details retrieved successfully');

  } catch (error: any) {
    console.error("Error in getFullEngineerDetailsById:", error);
    return sendError(res, 'Failed to retrieve engineer details', 500, error);
  }
}


export const getAllUserForComplaintAssign = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const companyId = (req as any).userId;

    // Find all users assigned to this company with USER role
    const users = await UserModel.find({
      assignedCompany: companyId,
      role: Role.USER
    }).select('_id firstName lastName email phoneNumber countryCode profileImage customerId fatherName landlineNumber');

    // Return success response with users data
    return sendSuccess(res, users, 'Users retrieved successfully for complaint assignment');

  } catch (error: any) {
    console.error("Error in getAllUserForComplaintAssign:", error);
    return sendError(res, 'Failed to retrieve users', 500, error);
  }
};

export const getAllUserForConnect = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const companyId = (req as any).userId;

    // Find all users assigned to this company with USER role
    const users = await UserModel.find({
      assignedCompany: companyId,
      role: Role.USER
    }).select('_id firstName lastName email phoneNumber countryCode profileImage customerId fatherName landlineNumber');

    // Check Customer model for each user and add isAttached field with OLT and FDB details
    const usersWithAttachmentStatus = await Promise.all(
      users.map(async (user) => {
        const customerData = await CustomerModel.findOne({ userId: user._id })
          .populate('fdbId', 'fdbId fdbName fdbPower fdbType')
          .populate('oltId', 'oltId serialNumber oltIp macAddress')
          .lean();
        
        const isAttached = !!customerData;
        
        // Get FDB port details if connected
        let fdbPortDetails = null;
        if (customerData && customerData.fdbId) {
          const fdb = await FDBModel.findById(customerData.fdbId).lean();
          if (fdb && fdb.ports) {
            // Find which port the user is connected to
            const userPort = fdb.ports.find(port =>
              port.connectedDevice &&
              port.connectedDevice.type === "user" &&
              port.connectedDevice.id === (user._id as any).toString()
            );

            if (userPort) {
              fdbPortDetails = {
                portNumber: userPort.portNumber,
                status: userPort.status,
                connectionDate: userPort.connectionDate
              };
            }
          }
        }
        
        return {
          ...user.toObject(),
          isAttached,
          customerDetails: customerData ? {
            customerId: customerData._id,
            fdb: customerData.fdbId && typeof customerData.fdbId === 'object' ? {
              fdbId: (customerData.fdbId as any).fdbId,
              fdbName: (customerData.fdbId as any).fdbName,
              fdbPower: (customerData.fdbId as any).fdbPower,
              fdbType: (customerData.fdbId as any).fdbType,
              portDetails: fdbPortDetails
            } : null,
            olt: customerData.oltId && typeof customerData.oltId === 'object' ? {
              oltId: (customerData.oltId as any).oltId,
              serialNumber: (customerData.oltId as any).serialNumber,
              oltIp: (customerData.oltId as any).oltIp,
              macAddress: (customerData.oltId as any).macAddress
            } : null,
            isInstalled: customerData.isInstalled,
            installationDate: customerData.installationDate
          } : null
        };
      })
    );

    // Return success response with users data
    return sendSuccess(res, usersWithAttachmentStatus, 'Users retrieved successfully with customer details');

  } catch (error: any) {
    console.error("Error in getAllUserForConnect:", error);
    return sendError(res, 'Failed to retrieve users', 500, error);
  }
};

// Connect user to FDB/OLT
export const connectUserToFDB = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { userId, fdbId, oltId, portNumber } = req.body;

    // Validate required fields
    if (!userId || !fdbId || !oltId || !portNumber) {
      return sendError(res, "userId, fdbId, oltId, and portNumber are required", 400);
    }

    // Validate port number format (P1, P2, etc.)
    if (!portNumber.match(/^P\d+$/)) {
      return sendError(res, "Invalid port number format. Must be P1, P2, P3, etc.", 400);
    }

    // Check if user exists
    const user = await UserModel.findById(userId);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Start transaction
    const session = await UserModel.startSession();

    try {
      const result = await session.withTransaction(async () => {
        // Find FDB by custom fdbId
        const fdb = await FDBModel.findOne({ fdbId: fdbId });
        if (!fdb) {
          throw new Error(`FDB with ID ${fdbId} not found`);
        }

        // Find OLT by custom oltId
        const olt = await OLTModel.findOne({ oltId: oltId });
        if (!olt) {
          throw new Error(`OLT with ID ${oltId} not found`);
        }

        // Generate ports if they don't exist
        if (!fdb.ports || fdb.ports.length === 0) {
          fdb.generatePorts();
          await fdb.save({ session });
        }

        // Check if port exists for this FDB power
        const portExists = fdb.ports?.some(port => port.portNumber === portNumber);
        if (!portExists) {
          throw new Error(`Port ${portNumber} does not exist for FDB with power ${fdb.fdbPower}`);
        }

        // Check if port is available
        const port = fdb.getPort(portNumber);
        if (!port || port.status !== 'available') {
          throw new Error(`Port ${portNumber} is not available (Status: ${port?.status || 'not found'})`);
        }

        // Handle FDB port disconnection if user was previously connected
        const currentCustomer = await CustomerModel.findOne({ userId: userId }, null, { session });
        if (currentCustomer && currentCustomer.fdbId) {
          const previousFdb = await FDBModel.findById(currentCustomer.fdbId, null, { session });
          if (previousFdb && previousFdb.outputs) {
            // Find and remove user from previous FDB outputs
            const userOutputIndex = previousFdb.outputs.findIndex(output =>
              output.type === "user" && output.id === userId
            );

            if (userOutputIndex !== -1) {
              const previousPortNumber = previousFdb.outputs[userOutputIndex].portNumber;
              if (previousPortNumber) {
                // Disconnect from previous port
                await previousFdb.disconnectFromPort(previousPortNumber);
                // Remove from outputs
                previousFdb.outputs.splice(userOutputIndex, 1);
                await previousFdb.save({ session });
              }
            }
          }
        }

        // Connect user to new port
        await fdb.connectToPort(portNumber, {
          type: "user",
          id: userId,
          description: `User ${user.firstName} ${user.lastName}`
        });

        // Add to FDB outputs with validation
        const maxOutputs = fdb.fdbPower || 2;
        if (!fdb.outputs) {
          fdb.outputs = [];
        }

        // Check if user is already in outputs
        const existingOutput = fdb.outputs.find(output =>
          output.type === "user" && output.id === userId
        );

        if (existingOutput) {
          // Update existing output with new port
          existingOutput.portNumber = portNumber;
        } else {
          // Check output limit
          if (fdb.outputs.length >= maxOutputs) {
            throw new Error(`FDB with power ${fdb.fdbPower} can only have ${maxOutputs} outputs maximum`);
          }

          // Add new output
          fdb.outputs.push({
            type: "user",
            id: userId,
            portNumber: portNumber,
            description: `User ${user.firstName} ${user.lastName}`
          });
        }

        await fdb.save({ session });

        // Update or create customer record
        const customerUpdateData: any = {
          fdbId: fdb._id,
          oltId: olt._id,
          isInstalled: true,
          installationDate: new Date()
        };

        let updatedCustomer;
        if (currentCustomer) {
          // Update existing customer record
          updatedCustomer = await CustomerModel.findOneAndUpdate(
            { userId: userId },
            customerUpdateData,
            { new: true, session }
          );
        } else {
          // Create new customer record
          const createdCustomer = await CustomerModel.create([{
            userId: userId,
            ...customerUpdateData
          }], { session });
          updatedCustomer = createdCustomer[0];
        }

        return {
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          },
          fdb: {
            fdbId: fdb.fdbId,
            fdbName: fdb.fdbName,
            fdbPower: fdb.fdbPower,
            fdbType: fdb.fdbType
          },
          olt: {
            oltId: olt.oltId,
            serialNumber: olt.serialNumber,
            oltIp: olt.oltIp
          },
          port: {
            portNumber: portNumber,
            status: 'occupied',
            connectionDate: new Date()
          },
          customer: updatedCustomer
        };
      });

      return sendSuccess(res, result, "User connected to FDB successfully");

    } catch (transactionError: any) {
      console.error("Transaction failed:", transactionError);
      return sendError(res, transactionError.message || "Failed to connect user", 500);
    } finally {
      await session.endSession();
    }

  } catch (error: any) {
    console.error("Error in connectUserToFDB:", error);
    return sendError(res, error.message || "Internal server error", 500);
  }
};

export const mainDashboardData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const companyId = (req as any).userId;

    // Get all users assigned to this company
    const getOurCompanyUsers = await UserModel.find({ assignedCompany: companyId }).select("_id");
    const companyUserIds = getOurCompanyUsers.map(user => user._id);

    // Basic counts
    const totalUsers = await UserModel.countDocuments({ assignedCompany: companyId });
    const totalEngineers = await UserModel.countDocuments({ parentCompany: companyId, role: Role.ENGINEER });
    const totalComplaints = await ComplaintModel.countDocuments({ user: { $in: companyUserIds } });
    const totalOrders = await orderModel.countDocuments({ user: { $in: companyUserIds } });
    const totalLeads = await Leads.countDocuments({ byUserId: { $in: companyUserIds } });
    const totalBillRequests = await RequestBill.countDocuments({ userId: { $in: companyUserIds } });
    const totalInstallationRequests = await WifiInstallationRequest.countDocuments({ userId: { $in: companyUserIds } });

    // Complaint status breakdown
    const resolvedComplaints = await ComplaintModel.countDocuments({
      user: { $in: companyUserIds },
      status: ComplaintStatus.RESOLVED
    });
    const pendingComplaints = await ComplaintModel.countDocuments({
      user: { $in: companyUserIds },
      status: { $in: [ComplaintStatus.PENDING, ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS, ComplaintStatus.VISITED] }
    });

    // Installation status breakdown
    const approvedInstallations = await WifiInstallationRequest.countDocuments({
      userId: { $in: companyUserIds },
      status: 'approved'
    });
    const pendingInstallations = await WifiInstallationRequest.countDocuments({
      userId: { $in: companyUserIds },
      status: 'inreview'
    });

    // Recent data (last 5 items)
    const recentComplaints = await ComplaintModel.find({ user: { $in: companyUserIds } })
      .populate('user', 'firstName lastName email phoneNumber')
      .populate('engineer', 'firstName lastName')
      .select('id title status priority createdAt user engineer')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentLeads = await Leads.find({ byUserId: { $in: companyUserIds } })
      .populate('byUserId', 'firstName lastName')
      .populate('assignedTo', 'firstName lastName')
      .select('firstName lastName phoneNumber status leadPlatform priority createdAt byUserId assignedTo')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentInstallations = await WifiInstallationRequest.find({ userId: { $in: companyUserIds } })
      .populate('userId', 'firstName lastName email')
      .populate('assignedEngineer', 'firstName lastName')
      .select('name email phoneNumber status createdAt userId assignedEngineer')
      .sort({ createdAt: -1 })
      .limit(5);

    // Recent orders
    const recentOrders = await orderModel.find({ user: { $in: companyUserIds } })
      .populate('user', 'firstName lastName email')
      .populate('products.product', 'name price')
      .select('orderId orderStatus totalAmount paymentMethod createdAt user products')
      .sort({ createdAt: -1 })
      .limit(5);

    // Calculate completion rates
    const complaintResolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0;
    const installationApprovalRate = totalInstallationRequests > 0 ? Math.round((approvedInstallations / totalInstallationRequests) * 100) : 0;

    // Prepare dashboard data
    const dashboardData = {
      // Key Metrics
      metrics: {
        totalUsers,
        totalEngineers,
        totalComplaints,
        resolvedComplaints,
        pendingComplaints,
        complaintResolutionRate,
        totalOrders,
        totalLeads,
        totalBillRequests,
        totalInstallationRequests,
        approvedInstallations,
        pendingInstallations,
        installationApprovalRate
      },

      // Recent Activity
      recentActivity: {
        complaints: recentComplaints,
        leads: recentLeads,
        installations: recentInstallations,
        orders: recentOrders
      },

      // Summary Stats
      summary: {
        totalActiveRequests: pendingComplaints + pendingInstallations,
        totalCompletedRequests: resolvedComplaints + approvedInstallations,
        overallCompletionRate: totalComplaints + totalInstallationRequests > 0
          ? Math.round(((resolvedComplaints + approvedInstallations) / (totalComplaints + totalInstallationRequests)) * 100)
          : 0
      }
    };

    return sendSuccess(res, dashboardData, 'Dashboard data retrieved successfully');

  } catch (error: any) {
    console.error("Error in mainDashboardData:", error);
    return sendError(res, 'Failed to retrieve dashboard data', 500, error);
  }
};

export const fdbAvailablePort = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const fdbId = req.params.fdbId;

    // Validate fdbId
    if (!fdbId) {
      return res.status(400).json({
        success: false,
        message: "FDB ID is required"
      });
    }

    // Find FDB by ID
    const fdb = await FDBModel.findOne({ fdbId: fdbId }).populate('ownedBy', 'name email').populate('assignedEngineer', 'name email').populate('assignedCompany', 'name email');

    if (!fdb) {
      return res.status(404).json({
        success: false,
        message: "FDB not found"
      });
    }

    // Generate ports if they don't exist
    if (!fdb.ports || fdb.ports.length === 0) {
      fdb.generatePorts();
      await fdb.save();
    }

    // Get port details with allocation information
    const portDetails = fdb.ports?.map(port => ({
      portNumber: port.portNumber,
      status: port.status,
      isAvailable: port.status === 'available',
      isAllocated: port.status === 'occupied',
      allocatedTo: port.connectedDevice ? {
        type: port.connectedDevice.type,
        id: port.connectedDevice.id,
        description: port.connectedDevice.description
      } : null,
      connectionDate: port.connectionDate,
      lastMaintenance: port.lastMaintenance
    })) || [];

    // Calculate summary statistics
    const totalPorts = fdb.totalPorts || fdb.ports?.length || 0;
    const availablePorts = fdb.getAvailablePorts().length;
    const occupiedPorts = fdb.getOccupiedPorts().length;
    const maintenancePorts = fdb.ports?.filter(port => port.status === 'maintenance').length || 0;
    const faultyPorts = fdb.ports?.filter(port => port.status === 'faulty').length || 0;

    // Response data
    const responseData = {
      fdbInfo: {
        fdbId: fdb.fdbId,
        fdbName: fdb.fdbName,
        fdbType: fdb.fdbType,
        fdbPower: fdb.fdbPower,
        status: fdb.status,
        location: {
          latitude: fdb.latitude,
          longitude: fdb.longitude,
          address: fdb.address,
          city: fdb.city,
          state: fdb.state
        },
        ownedBy: fdb.ownedBy,
        assignedEngineer: fdb.assignedEngineer,
        assignedCompany: fdb.assignedCompany
      },
      portSummary: {
        totalPorts,
        availablePorts,
        occupiedPorts,
        maintenancePorts,
        faultyPorts,
        utilizationPercentage: totalPorts > 0 ? Math.round((occupiedPorts / totalPorts) * 100) : 0
      },
      portDetails,
      powerConfiguration: {
        fdbPower: fdb.fdbPower,
        expectedPorts: fdb.fdbPower ? Array.from({ length: fdb.fdbPower }, (_, i) => `P${i + 1}`) : [],
        portGenerationStatus: fdb.ports && fdb.ports.length > 0 ? 'generated' : 'not_generated'
      }
    };

    return res.status(200).json({
      success: true,
      message: "FDB port information retrieved successfully",
      data: responseData
    });

  } catch (error: any) {
    console.error("Error in fdbAvailablePort:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : "Something went wrong"
    });
  }
}

// API to connect device to FDB port
export const connectDeviceToPort = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { fdbId, portNumber, deviceType, deviceId, description } = req.body;

    // Validate required fields
    if (!fdbId || !portNumber || !deviceType || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "FDB ID, port number, device type, and device ID are required"
      });
    }

    // Find FDB
    const fdb = await FDBModel.findById(fdbId);
    if (!fdb) {
      return res.status(404).json({
        success: false,
        message: "FDB not found"
      });
    }

    // Generate ports if they don't exist
    if (!fdb.ports || fdb.ports.length === 0) {
      fdb.generatePorts();
      await fdb.save();
    }

    // Connect device to port
    await fdb.connectToPort(portNumber, {
      type: deviceType,
      id: deviceId,
      description: description || ''
    });

    // Get updated port information
    const updatedPort = fdb.getPort(portNumber);

    return res.status(200).json({
      success: true,
      message: `Device ${deviceId} connected to port ${portNumber} successfully`,
      data: {
        fdbId: fdb.fdbId,
        fdbName: fdb.fdbName,
        port: updatedPort,
        connection: {
          deviceType,
          deviceId,
          description,
          connectionDate: updatedPort?.connectionDate
        }
      }
    });

  } catch (error: any) {
    console.error("Error in connectDeviceToPort:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : "Something went wrong"
    });
  }
}

// API to disconnect device from FDB port
export const disconnectDeviceFromPort = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { fdbId, portNumber } = req.body;

    // Validate required fields
    if (!fdbId || !portNumber) {
      return res.status(400).json({
        success: false,
        message: "FDB ID and port number are required"
      });
    }

    // Find FDB
    const fdb = await FDBModel.findById(fdbId);
    if (!fdb) {
      return res.status(404).json({
        success: false,
        message: "FDB not found"
      });
    }

    // Get port info before disconnection
    const portBeforeDisconnect = fdb.getPort(portNumber);

    // Disconnect device from port
    await fdb.disconnectFromPort(portNumber);

    // Get updated port information
    const updatedPort = fdb.getPort(portNumber);

    return res.status(200).json({
      success: true,
      message: `Device disconnected from port ${portNumber} successfully`,
      data: {
        fdbId: fdb.fdbId,
        fdbName: fdb.fdbName,
        port: updatedPort,
        disconnectedDevice: portBeforeDisconnect?.connectedDevice
      }
    });

  } catch (error: any) {
    console.error("Error in disconnectDeviceFromPort:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : "Something went wrong"
    });
  }
}


export const addBsnlUserFromExcel = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { files } = req;
    const addedBy = (req as any).userId; // Logged in user ID who is uploading

    const { internetProviderId } = req.body;
    console.log(req.body, internetProviderId);


    if (!files || !Array.isArray(files) || files.length === 0) {
      return sendError(res, 'No files uploaded', 400);
    }

    // Validate each file object
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Validating file ${i}:`, {
        originalname: file?.originalname,
        mimetype: file?.mimetype,
        size: file?.size,
        hasBuffer: !!file?.buffer,
        hasPath: !!file?.path,
        bufferLength: file?.buffer?.length,
        path: file?.path,
        keys: file ? Object.keys(file) : 'undefined'
      });

      if (!file || typeof file !== 'object') {
        return sendError(res, `File at index ${i} is invalid`, 400);
      }
      if (!file.originalname) {
        return sendError(res, `File at index ${i} is missing original name`, 400);
      }
      // Check if file has either buffer (memory storage) or path (disk storage)
      if (!file.buffer && !file.path) {
        return sendError(res, `File ${file.originalname} is missing required properties (neither buffer nor path)`, 400);
      }
    }

    if (!addedBy) {
      return sendError(res, 'User authentication required', 401);
    }

    const results: {
      totalFiles: number;
      processedFiles: number;
      totalUsers: number;
      newUsers: number;
      updatedUsers: number;
      duplicateUsers: number;
      errors: string[];
      fileResults: Array<{
        fileName: string;
        totalUsers: number;
        newUsers: number;
        updatedUsers: number;
        duplicateUsers: number;
        errors: string[];
        duplicateDetails: Array<{
          phoneNumber: string;
          email: string;
          action: 'updated' | 'skipped';
        }>;
      }>;
    } = {
      totalFiles: files.length,
      processedFiles: 0,
      totalUsers: 0,
      newUsers: 0,
      updatedUsers: 0,
      duplicateUsers: 0,
      errors: [],
      fileResults: []
    };

    // Process each uploaded file
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.originalname}`);
        const fileResult = await processBsnlExcelFile(file, addedBy, internetProviderId);
        results.fileResults.push(fileResult);
        results.processedFiles++;
        results.totalUsers += fileResult.totalUsers;
        results.newUsers += fileResult.newUsers;
        results.updatedUsers += fileResult.updatedUsers;
        results.duplicateUsers += fileResult.duplicateUsers;
        results.errors.push(...fileResult.errors);
      } catch (fileError: any) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        const errorMessage = file.originalname
          ? `File ${file.originalname}: ${fileError.message}`
          : `Unknown file: ${fileError.message}`;
        results.errors.push(errorMessage);
      }
    }

    // Prepare response message
    let message = `Processed ${results.processedFiles} files. `;
    if (results.newUsers > 0) message += `Added ${results.newUsers} new users. `;
    if (results.updatedUsers > 0) message += `Updated ${results.updatedUsers} existing users. `;
    if (results.duplicateUsers > 0) message += `Found ${results.duplicateUsers} duplicate users (based on phone number). `;
    if (results.errors.length > 0) message += `${results.errors.length} errors occurred.`;

    return sendSuccess(res, results, message);
  } catch (error: any) {
    console.error('Excel upload error:', error);
    return sendError(res, 'Failed to process Excel files', 500, error);
  }
};

// Helper function to process individual Excel file
const processBsnlExcelFile = async (file: Express.Multer.File, addedBy: string, internetProviderId: string) => {
  console.log('internetProviderId', internetProviderId);

  // Validate file object
  if (!file) {
    throw new Error('File object is undefined');
  }

  if (!file.originalname) {
    throw new Error('File has no original name');
  }

  // Check if file has buffer (memory storage) or path (disk storage)
  if (!file.buffer && !file.path) {
    throw new Error('File has neither buffer data nor file path');
  }

  const fileResult = {
    fileName: file.originalname,
    totalUsers: 0,
    newUsers: 0,
    updatedUsers: 0,
    duplicateUsers: 0,
    errors: [] as string[],
    duplicateDetails: [] as Array<{
      phoneNumber: string;
      email: string;
      action: 'updated' | 'skipped';
    }>
  };

  try {
    // Debug file information
    console.log('File info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      bufferLength: file.buffer ? file.buffer.length : 'undefined',
      bufferType: file.buffer ? typeof file.buffer : 'undefined',
      path: file.path || 'undefined'
    });

    let fileBuffer: Buffer;

    // Handle both memory storage (buffer) and disk storage (path)
    if (file.buffer) {
      // Memory storage - use buffer directly
      if (!file.buffer || file.buffer.length === 0) {
        throw new Error('File buffer is empty or corrupted');
      }

      if (!Buffer.isBuffer(file.buffer)) {
        throw new Error('File buffer is not a valid Buffer object');
      }

      if (file.buffer.length < 100) {
        throw new Error('File is too small to be a valid Excel file');
      }

      fileBuffer = file.buffer;
    } else if (file.path) {
      // Disk storage - read file from disk
      try {
        fileBuffer = fs.readFileSync(file.path);

        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error('File read from disk is empty or corrupted');
        }

        if (fileBuffer.length < 100) {
          throw new Error('File read from disk is too small to be a valid Excel file');
        }
      } catch (readError: any) {
        throw new Error(`Failed to read file from disk: ${readError.message}`);
      }
    } else {
      throw new Error('No file data available (neither buffer nor path)');
    }

    // Check file extension
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    if (!fileExtension || !['xls', 'xlsx', 'csv'].includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}. Only .xls, .xlsx, and .csv files are supported`);
    }

    // Parse Excel file with error handling
    let workbook;
    try {
      // Try different parsing options
      workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
    } catch (xlsxError: any) {
      console.error('XLSX parsing error:', xlsxError);

      // Try alternative parsing method
      try {
        console.log('Trying alternative parsing method...');
        workbook = XLSX.read(fileBuffer, {
          type: 'buffer',
          cellDates: false,
          cellNF: false,
          cellText: true
        });
      } catch (altError: any) {
        console.error('Alternative parsing also failed:', altError);

        // Provide more specific error messages based on the error type
        if (xlsxError.message.includes('Cannot read properties of undefined')) {
          throw new Error('Excel file appears to be corrupted or in an unsupported format. Please ensure the file is a valid Excel file (.xls, .xlsx) and try again.');
        } else if (xlsxError.message.includes('password')) {
          throw new Error('Excel file appears to be password-protected. Please remove the password protection and try again.');
        } else {
          throw new Error(`Failed to parse Excel file: ${xlsxError.message}. Alternative method also failed: ${altError.message}`);
        }
      }
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no sheets');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error('Could not read worksheet from Excel file');
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length < 2) {
      throw new Error('Excel file must have at least header row and one data row');
    }

    // Extract headers and data
    const headers = data[0] as string[];
    if (!headers || !Array.isArray(headers)) {
      throw new Error('Invalid header row in Excel file');
    }

    const rows = data.slice(1) as any[][];
    if (!rows || !Array.isArray(rows)) {
      throw new Error('No data rows found in Excel file');
    }

    // Map Excel headers to User model fields (PHONE_NO is primary unique identifier)
    const headerMapping: { [key: string]: string } = {
      'PHONE_NO': 'landlineNumber',      // Primary unique identifier
      // 'PHONE_N': 'phoneNumber',       // Primary unique identifier
      // 'PHONE N': 'phoneNumber',       // Primary unique identifier
      'MOBILE_NO': 'phoneNumber',     // Primary unique identifier
      // 'MOBILE': 'phoneNumber',        // Primary unique identifier
      'OLT_IP': 'oltIp',
      'MTCE_FRANCHISE_CODE': 'mtceFranchise',
      'MTCE_FRANCHISE': 'mtceFranchise',
      'CATEGORY': 'category',
      'CATEG': 'category',
      'CUSTOMER_NAME': 'firstName',
      'CUSTOMER NAME': 'firstName',
      'EMAIL_ID': 'email',
      'EMAIL ID': 'email',
      'BB_USER_ID': 'bbUserId',
      'BB USER ID': 'bbUserId',
      'FTTH_EXCHANGE': 'ftthExchange',
      'FTTH_EXCH': 'ftthExchange',
      'FTTH_EXCH_PLAN': 'ftthExchangePlan',
      'PLAN_ID': 'planId',
      'BB_PLAN': 'bbPlan',
      'BB PLAN': 'bbPlan',
      'LL_INSTALL_DATE': 'llInstallDate',
      'LL_INSTALL': 'llInstallDate',
      'WKG_STATUS': 'workingStatus',
      'WKG_ST': 'workingStatus',
      'VKG_ST': 'workingStatus',
      'ASSIGNED_TO': 'assigned',
      'ASSIGNED': 'assigned',
      'RURAL_URBAN': 'ruralUrban',
      'RURAL_UR': 'ruralUrban',
      'RURAL_U': 'ruralUrban',
      'ACQUISITION_TYPE': 'acquisitionType'
    };

    // Validate required headers with flexible matching (PHONE_NO is primary unique identifier)
    const requiredHeaders = [
      { key: 'PHONE_NO', patterns: ['PHONE_NO', 'PHONE_N', 'PHONE N', 'PHONE', 'MOBILE_NO', 'MOBILE'] },
      { key: 'CUSTOMER NAME', patterns: ['CUSTOMER_NAME', 'CUSTOMER NAME', 'CUSTOMER'] },
      { key: 'EMAIL_ID', patterns: ['EMAIL_ID', 'EMAIL ID', 'EMAIL'] }
    ];

    const missingHeaders: string[] = [];

    requiredHeaders.forEach(required => {
      const found = headers.some(header =>
        header && required.patterns.some(pattern =>
          header.toString().toUpperCase().includes(pattern.replace('_', '').replace(' ', ''))
        )
      );
      if (!found) {
        missingHeaders.push(required.key);
      }
    });

    console.log('Found headers:', headers);
    console.log('Missing headers:', missingHeaders);

    // Debug header mapping
    console.log('Header mapping results:');
    headers.forEach((header, index) => {
      if (header) {
        const mappedField = headerMapping[header];
        console.log(`Column ${index}: "${header}" -> ${mappedField || 'UNMAPPED'}`);
      }
    });

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Process each row
    console.log(`Processing ${rows.length} rows`);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      try {
        if (!row || !Array.isArray(row) || row.every(cell => !cell)) {
          console.log(`Skipping empty row ${rowIndex + 2}`);
          continue; // Skip empty rows
        }

        // Map row data to user object
        const userData: any = {
          addedBy: addedBy,
          assignedCompany: addedBy,
          internetProviderId: internetProviderId,
          isActivated: true,
          isAccountVerified: true,
          isDeactivated: false,
          isSuspended: false,
          countryCode: '+91',
        };

        headers.forEach((header, colIndex) => {
          if (header && row && Array.isArray(row) && colIndex < row.length && row[colIndex] !== undefined && row[colIndex] !== null) {
            const fieldName = headerMapping[header];
            if (fieldName) {
              let value = row[colIndex];

              // Handle special field mappings
              if (fieldName === 'firstName') {
                // Split customer name into firstName and lastName
                const nameParts = value.toString().trim().split(' ');
                userData.firstName = nameParts && nameParts.length > 0 ? nameParts[0] : '';
                userData.lastName = nameParts && nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
              } else if (fieldName === 'llInstallDate') {
                // Convert date string to Date object
                try {
                  userData[fieldName] = new Date(value);
                } catch {
                  userData[fieldName] = null;
                }
              } else if (fieldName === 'expiry') {
                // Convert expiry date string to Date object
                try {
                  userData[fieldName] = new Date(value);
                } catch {
                  userData[fieldName] = null;
                }
              } else if (fieldName === 'registrationDate') {
                // Convert registration date string to Date object
                try {
                  userData[fieldName] = new Date(value);
                } catch {
                  userData[fieldName] = null;
                }
              } else if (fieldName === 'phoneNumber') {
                // Clean phone number - remove all non-numeric characters
                userData[fieldName] = value.toString().replace(/[^0-9]/g, '');
                userData.countryCode = '+91'; // Default to India
              } else {
                userData[fieldName] = value.toString().trim();
              }
            }
          }
        });

        // Validate required fields
        if (!userData.phoneNumber || !userData.email || !userData.firstName) {
          fileResult.errors.push(`Row ${rowIndex + 2}: Missing required fields (phone, email, or name)`);
          continue;
        }

        // Clean phone number for comparison
        const cleanPhoneNumber = userData.phoneNumber.replace(/[^0-9]/g, '');

        // Check if user already exists by phone number (primary unique identifier)
        const existingUser = await UserModel.findOne({
          phoneNumber: cleanPhoneNumber
        });

        if (existingUser) {
          // Check if this is a duplicate entry (same phone number)
          fileResult.duplicateUsers++;
          fileResult.totalUsers++;

          // Add to duplicate details
          fileResult.duplicateDetails.push({
            phoneNumber: cleanPhoneNumber,
            email: userData.email,
            action: 'updated'
          });

          // Update existing user with new data from Excel
          const updateData = { ...userData };

          delete updateData.phoneNumber; // Don't update phone number as it's the unique identifier

          // Update user with new information
          const updatedUser = await UserModel.findByIdAndUpdate(
            existingUser._id,
            {
              ...updateData,
              internetProviderId: internetProviderId,
              updatedAt: new Date()
            },
            { new: true, runValidators: true }
          );

          if (updatedUser) {
            fileResult.updatedUsers++;
            console.log(`Updated existing user with phone: ${cleanPhoneNumber}`);
          }
        } else {
          // Create new user
          const newUser = new UserModel({
            ...userData,
            phoneNumber: cleanPhoneNumber, // Use cleaned phone number
            email: userData.email.toLowerCase(),
            role: 'user', // Default role
            userName: userData.email.split('@')[0], // Generate username from email
            country: 'India', // Default country
            status: 'active'
          });

          const savedUser = await newUser.save();
          if (savedUser) {
            fileResult.newUsers++;
            fileResult.totalUsers++;
            console.log(`Created new user with phone: ${cleanPhoneNumber}`);
          }
        }

      } catch (rowError: any) {
        console.error(`Error processing row ${rowIndex + 2}:`, rowError);
        fileResult.errors.push(`Row ${rowIndex + 2}: ${rowError.message}`);
      }
    }

  } catch (error: any) {
    console.error('Excel file processing error:', error);
    fileResult.errors.push(`File processing error: ${error.message}`);
  }

  return fileResult;
};

export const addRailWireUserFromExcel = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { files } = req;
    const addedBy = (req as any).userId; // Logged in user ID who is uploading

    const { internetProviderId } = req.body;
    console.log(req.body, internetProviderId);


    if (!files || !Array.isArray(files) || files.length === 0) {
      return sendError(res, 'No files uploaded', 400);
    }

    // Validate each file object
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Validating file ${i}:`, {
        originalname: file?.originalname,
        mimetype: file?.mimetype,
        size: file?.size,
        hasBuffer: !!file?.buffer,
        hasPath: !!file?.path,
        bufferLength: file?.buffer?.length,
        path: file?.path,
        keys: file ? Object.keys(file) : 'undefined'
      });

      if (!file || typeof file !== 'object') {
        return sendError(res, `File at index ${i} is invalid`, 400);
      }
      if (!file.originalname) {
        return sendError(res, `File at index ${i} is missing original name`, 400);
      }
      // Check if file has either buffer (memory storage) or path (disk storage)
      if (!file.buffer && !file.path) {
        return sendError(res, `File ${file.originalname} is missing required properties (neither buffer nor path)`, 400);
      }
    }

    if (!addedBy) {
      return sendError(res, 'User authentication required', 401);
    }

    const results: {
      totalFiles: number;
      processedFiles: number;
      totalUsers: number;
      newUsers: number;
      updatedUsers: number;
      duplicateUsers: number;
      errors: string[];
      fileResults: Array<{
        fileName: string;
        totalUsers: number;
        newUsers: number;
        updatedUsers: number;
        duplicateUsers: number;
        errors: string[];
        duplicateDetails: Array<{
          phoneNumber: string;
          email: string;
          action: 'updated' | 'skipped';
        }>;
      }>;
    } = {
      totalFiles: files.length,
      processedFiles: 0,
      totalUsers: 0,
      newUsers: 0,
      updatedUsers: 0,
      duplicateUsers: 0,
      errors: [],
      fileResults: []
    };

    // Process each uploaded file
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.originalname}`);
        const fileResult = await processRailWireExcelFile(file, addedBy, internetProviderId);
        results.fileResults.push(fileResult);
        results.processedFiles++;
        results.totalUsers += fileResult.totalUsers;
        results.newUsers += fileResult.newUsers;
        results.updatedUsers += fileResult.updatedUsers;
        results.duplicateUsers += fileResult.duplicateUsers;
        results.errors.push(...fileResult.errors);
      } catch (fileError: any) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        const errorMessage = file.originalname
          ? `File ${file.originalname}: ${fileError.message}`
          : `Unknown file: ${fileError.message}`;
        results.errors.push(errorMessage);
      }
    }

    // Prepare response message
    let message = `Processed ${results.processedFiles} files. `;
    if (results.newUsers > 0) message += `Added ${results.newUsers} new users. `;
    if (results.updatedUsers > 0) message += `Updated ${results.updatedUsers} existing users. `;
    if (results.duplicateUsers > 0) message += `Found ${results.duplicateUsers} duplicate users (based on phone number). `;
    if (results.errors.length > 0) message += `${results.errors.length} errors occurred.`;

    return sendSuccess(res, results, message);
  } catch (error: any) {
    console.error('Excel upload error:', error);
    return sendError(res, 'Failed to process Excel files', 500, error);
  }
};

const processRailWireExcelFile = async (file: Express.Multer.File, addedBy: string, internetProviderId: string) => {
  console.log('internetProviderId', internetProviderId);

  // Validate file object
  if (!file) {
    throw new Error('File object is undefined');
  }

  if (!file.originalname) {
    throw new Error('File has no original name');
  }

  // Check if file has buffer (memory storage) or path (disk storage)
  if (!file.buffer && !file.path) {
    throw new Error('File has neither buffer data nor file path');
  }

  const fileResult = {
    fileName: file.originalname,
    totalUsers: 0,
    newUsers: 0,
    updatedUsers: 0,
    duplicateUsers: 0,
    errors: [] as string[],
    duplicateDetails: [] as Array<{
      phoneNumber: string;
      email: string;
      action: 'updated' | 'skipped';
    }>
  };

  try {
    // Debug file information
    console.log('File info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      bufferLength: file.buffer ? file.buffer.length : 'undefined',
      bufferType: file.buffer ? typeof file.buffer : 'undefined',
      path: file.path || 'undefined'
    });

    let fileBuffer: Buffer;

    // Handle both memory storage (buffer) and disk storage (path)
    if (file.buffer) {
      // Memory storage - use buffer directly
      if (!file.buffer || file.buffer.length === 0) {
        throw new Error('File buffer is empty or corrupted');
      }

      if (!Buffer.isBuffer(file.buffer)) {
        throw new Error('File buffer is not a valid Buffer object');
      }

      if (file.buffer.length < 100) {
        throw new Error('File is too small to be a valid Excel file');
      }

      fileBuffer = file.buffer;
    } else if (file.path) {
      // Disk storage - read file from disk
      try {
        fileBuffer = fs.readFileSync(file.path);

        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error('File read from disk is empty or corrupted');
        }

        if (fileBuffer.length < 100) {
          throw new Error('File read from disk is too small to be a valid Excel file');
        }
      } catch (readError: any) {
        throw new Error(`Failed to read file from disk: ${readError.message}`);
      }
    } else {
      throw new Error('No file data available (neither buffer nor path)');
    }

    // Check file extension
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    if (!fileExtension || !['xls', 'xlsx', 'csv'].includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}. Only .xls, .xlsx, and .csv files are supported`);
    }

    // Parse Excel file with error handling
    let workbook;
    try {
      // Try different parsing options
      workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
    } catch (xlsxError: any) {
      console.error('XLSX parsing error:', xlsxError);

      // Try alternative parsing method
      try {
        console.log('Trying alternative parsing method...');
        workbook = XLSX.read(fileBuffer, {
          type: 'buffer',
          cellDates: false,
          cellNF: false,
          cellText: true
        });
      } catch (altError: any) {
        console.error('Alternative parsing also failed:', altError);

        // Provide more specific error messages based on the error type
        if (xlsxError.message.includes('Cannot read properties of undefined')) {
          throw new Error('Excel file appears to be corrupted or in an unsupported format. Please ensure the file is a valid Excel file (.xls, .xlsx) and try again.');
        } else if (xlsxError.message.includes('password')) {
          throw new Error('Excel file appears to be password-protected. Please remove the password protection and try again.');
        } else {
          throw new Error(`Failed to parse Excel file: ${xlsxError.message}. Alternative method also failed: ${altError.message}`);
        }
      }
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no sheets');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error('Could not read worksheet from Excel file');
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length < 2) {
      throw new Error('Excel file must have at least header row and one data row');
    }

    // Handle case where first row might be empty and actual headers are in second row
    let headers: string[];
    let rows: any[][];

    // Check if first row contains actual headers or is empty
    const firstRow = data[0] as any[];
    const secondRow = data[1] as any[];

    // If first row has meaningful data (not all empty), use it as headers
    const firstRowHasMeaningfulData = firstRow && firstRow.some(cell =>
      cell && cell.toString().trim() !== '' && cell.toString().toLowerCase().includes('name')
    );

    if (firstRowHasMeaningfulData) {
      // Normal case: headers are in first row
      headers = (data[0] as string[]).map(h => h ? h.toString().toLowerCase().trim() : '');
      rows = data.slice(1) as any[][];
    } else {
      // Special case: headers are in second row (first row is empty/unnamed)
      headers = (data[1] as string[]).map(h => h ? h.toString().toLowerCase().trim() : '');
      rows = data.slice(2) as any[][];
    }

    console.log('Extracted headers:', headers);
    console.log('Number of data rows:', rows.length);

    if (!headers || !Array.isArray(headers)) {
      throw new Error('Invalid header row in Excel file');
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new Error('No data rows found in Excel file');
    }


    // Map Excel headers to User model fields (PHONE_NO is primary unique identifier)
    const headerMapping: { [key: string]: string } = {
      'firstname': 'firstName',
      'mobileno': 'phoneNumber',
      'email': 'email',
      'username': 'userName',
      'address': 'permanentAddress',

      'packagename': 'packageName',
      'billingtypeid': 'billingTypeId',
      'subscriberid': 'subscriberId',
      'gstin': 'gstin',
      'status': 'status',
      'expiry': 'expiry',
      'registrationdate': 'registrationDate',
      'balance': 'balance',
      'sub_status': 'subStatus',
      'remarks': 'remarks',
    };

    // Validate required headers with flexible matching (PHONE_NO is primary unique identifier)
    // Validate required headers with flexible matching (PHONE_NO is primary unique identifier)
    const requiredHeaders = [
      { key: 'mobileno', patterns: ['mobileno', 'mobile', 'phone'] },
      { key: 'email', patterns: ['email', 'e-mail', 'mail'] }
    ];

    const missingHeaders: string[] = [];

    requiredHeaders.forEach(required => {
      const found = headers.some(header => {
        if (!header) return false;

        const headerUpper = header.toString().toUpperCase().replace(/[_\s-]/g, '');

        return required.patterns.some(pattern => {
          const patternUpper = pattern.toUpperCase().replace(/[_\s-]/g, '');
          return headerUpper.includes(patternUpper);
        });
      });

      if (!found) {
        missingHeaders.push(required.key);
      }
    });

    console.log('Found headers:', headers);
    console.log('Missing headers:', missingHeaders);

    // Debug header mapping
    console.log('Header mapping results:');
    headers.forEach((header, index) => {
      if (header) {
        const mappedField = headerMapping[header];
        console.log(`Column ${index}: "${header}" -> ${mappedField || 'UNMAPPED'}`);
      }
    });

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }


    // Debug header mapping
    console.log('Header mapping results:');
    headers.forEach((header, index) => {
      if (header) {
        const mappedField = headerMapping[header];
        console.log(`Column ${index}: "${header}" -> ${mappedField || 'UNMAPPED'}`);
      }
    });

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Process each row
    console.log(`Processing ${rows.length} rows`);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      try {
        if (!row || !Array.isArray(row) || row.every(cell => !cell)) {
          console.log(`Skipping empty row ${rowIndex + 2}`);
          continue; // Skip empty rows
        }

        // Map row data to user object
        const userData: any = {
          addedBy: addedBy,
          assignedCompany: addedBy,
          internetProviderId: internetProviderId,
          isActivated: true,
          isAccountVerified: true,
          isDeactivated: false,
          isSuspended: false,
          countryCode: '+91',
        };

        headers.forEach((header, colIndex) => {
          if (header && row && Array.isArray(row) && colIndex < row.length && row[colIndex] !== undefined && row[colIndex] !== null) {
            const fieldName = headerMapping[header];
            if (fieldName) {
              let value = row[colIndex];

              // Handle special field mappings
              if (fieldName === 'firstName') {
                // Split customer name into firstName and lastName
                const nameParts = value.toString().trim().split(' ');
                userData.firstName = nameParts && nameParts.length > 0 ? nameParts[0] : '';
                userData.lastName = nameParts && nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
              } else if (fieldName === 'llInstallDate') {
                // Convert date string to Date object
                try {
                  userData[fieldName] = new Date(value);
                } catch {
                  userData[fieldName] = null;
                }
              } else if (fieldName === 'expiry') {
                // Convert expiry date string to Date object
                try {
                  userData[fieldName] = new Date(value);
                } catch {
                  userData[fieldName] = null;
                }
              } else if (fieldName === 'registrationDate') {
                // Convert registration date string to Date object
                try {
                  userData[fieldName] = new Date(value);
                } catch {
                  userData[fieldName] = null;
                }
              } else if (fieldName === 'phoneNumber') {
                // Clean phone number - remove all non-numeric characters
                userData[fieldName] = value.toString().replace(/[^0-9]/g, '');
                userData.countryCode = '+91'; // Default to India
              } else {
                userData[fieldName] = value.toString().trim();
              }
            }
          }
        });

        // Validate required fields
        if (!userData.phoneNumber || !userData.email || !userData.firstName) {
          fileResult.errors.push(`Row ${rowIndex + 2}: Missing required fields (phone, email, or name)`);
          continue;
        }

        // Clean phone number for comparison
        const cleanPhoneNumber = userData.phoneNumber.replace(/[^0-9]/g, '');

        // Check if user already exists by phone number (primary unique identifier)
        const existingUser = await UserModel.findOne({
          phoneNumber: cleanPhoneNumber
        });

        if (existingUser) {
          // Check if this is a duplicate entry (same phone number)
          fileResult.duplicateUsers++;
          fileResult.totalUsers++;

          // Add to duplicate details
          fileResult.duplicateDetails.push({
            phoneNumber: cleanPhoneNumber,
            email: userData.email,
            action: 'updated'
          });

          // Update existing user with new data from Excel
          const updateData = { ...userData };

          delete updateData.phoneNumber; // Don't update phone number as it's the unique identifier

          // Update user with new information
          const updatedUser = await UserModel.findByIdAndUpdate(
            existingUser._id,
            {
              ...updateData,
              internetProviderId: internetProviderId,
              updatedAt: new Date()
            },
            { new: true, runValidators: true }
          );

          if (updatedUser) {
            fileResult.updatedUsers++;
            console.log(`Updated existing user with phone: ${cleanPhoneNumber}`);
          }
        } else {
          // Create new user
          const newUser = new UserModel({
            ...userData,
            phoneNumber: cleanPhoneNumber, // Use cleaned phone number
            email: userData.email.toLowerCase(),
            role: 'user', // Default role
            // userName: userData.email.split('@')[0], // Generate username from email
            country: 'India', // Default country
            status: 'active'
          });

          const savedUser = await newUser.save();
          if (savedUser) {
            fileResult.newUsers++;
            fileResult.totalUsers++;
            console.log(`Created new user with phone: ${cleanPhoneNumber}`);
          }
        }

      } catch (rowError: any) {
        console.error(`Error processing row ${rowIndex + 2}:`, rowError);
        fileResult.errors.push(`Row ${rowIndex + 2}: ${rowError.message}`);
      }
    }

  } catch (error: any) {
    console.error('Excel file processing error:', error);
    fileResult.errors.push(`File processing error: ${error.message}`);
  }

  return fileResult;
};


export const addMyInternetUserFromExcel = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { files } = req;
    const addedBy = (req as any).userId;
    const { internetProviderId } = req.body;

    console.log('Request body:', req.body, 'internetProviderId:', internetProviderId);

    if (!files || !Array.isArray(files) || files.length === 0) {
      return sendError(res, 'No files uploaded', 400);
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || typeof file !== 'object') {
        return sendError(res, `File at index ${i} is invalid`, 400);
      }
      if (!file.originalname) {
        return sendError(res, `File at index ${i} is missing original name`, 400);
      }
      if (!file.buffer && !file.path) {
        return sendError(res, `File ${file.originalname} is missing required properties`, 400);
      }
    }

    if (!addedBy) {
      return sendError(res, 'User authentication required', 401);
    }

    const results: {
      totalFiles: number;
      processedFiles: number;
      totalUsers: number;
      newUsers: number;
      updatedUsers: number;
      duplicateUsers: number;
      errors: string[];
      fileResults: Array<{
        fileName: string;
        totalUsers: number;
        newUsers: number;
        updatedUsers: number;
        duplicateUsers: number;
        errors: string[];
        duplicateDetails: Array<{
          phoneNumber: string;
          username: string;
          action: 'updated' | 'skipped';
        }>;
      }>;
    } = {
      totalFiles: files.length,
      processedFiles: 0,
      totalUsers: 0,
      newUsers: 0,
      updatedUsers: 0,
      duplicateUsers: 0,
      errors: [],
      fileResults: []
    };

    for (const file of files) {
      try {
        console.log(`Processing file: ${file.originalname}`);
        const fileResult = await processMyInternetExcelFile(file, addedBy, internetProviderId);
        results.fileResults.push(fileResult);
        results.processedFiles++;
        results.totalUsers += fileResult.totalUsers;
        results.newUsers += fileResult.newUsers;
        results.updatedUsers += fileResult.updatedUsers;
        results.duplicateUsers += fileResult.duplicateUsers;
        results.errors.push(...fileResult.errors);
      } catch (fileError: any) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        const errorMessage = file.originalname
          ? `File ${file.originalname}: ${fileError.message}`
          : `Unknown file: ${fileError.message}`;
        results.errors.push(errorMessage);
      }
    }

    let message = `Processed ${results.processedFiles} files. `;
    if (results.newUsers > 0) message += `Added ${results.newUsers} new users. `;
    if (results.updatedUsers > 0) message += `Updated ${results.updatedUsers} existing users. `;
    if (results.duplicateUsers > 0) message += `Found ${results.duplicateUsers} duplicate users. `;
    if (results.errors.length > 0) message += `${results.errors.length} errors occurred.`;

    return sendSuccess(res, results, message);
  } catch (error: any) {
    console.error('Excel upload error:', error);
    return sendError(res, 'Failed to process Excel files', 500, error);
  }
};

const processMyInternetExcelFile = async (
  file: Express.Multer.File,
  addedBy: string,
  internetProviderId: string
) => {
  if (!file) throw new Error('File object is undefined');
  if (!file.originalname) throw new Error('File has no original name');
  if (!file.buffer && !file.path) throw new Error('File has neither buffer data nor file path');

  const fileResult = {
    fileName: file.originalname,
    totalUsers: 0,
    newUsers: 0,
    updatedUsers: 0,
    duplicateUsers: 0,
    errors: [] as string[],
    duplicateDetails: [] as Array<{
      phoneNumber: string;
      username: string;
      action: 'updated' | 'skipped';
    }>
  };

  try {
    let fileBuffer: Buffer;

    if (file.buffer) {
      if (!Buffer.isBuffer(file.buffer) || file.buffer.length < 100) {
        throw new Error('File buffer is invalid or too small');
      }
      fileBuffer = file.buffer;
    } else if (file.path) {
      try {
        fileBuffer = fs.readFileSync(file.path);
        if (!fileBuffer || fileBuffer.length < 100) {
          throw new Error('File read from disk is invalid or too small');
        }
      } catch (readError: any) {
        throw new Error(`Failed to read file from disk: ${readError.message}`);
      }
    } else {
      throw new Error('No file data available');
    }

    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    if (!fileExtension || !['xls', 'xlsx', 'csv'].includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
    } catch (xlsxError: any) {
      throw new Error(`Failed to parse Excel file: ${xlsxError.message}`);
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no sheets');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error('Could not read worksheet from Excel file');
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!data || data.length < 5) {
      throw new Error('Excel file must have at least header row and one data row');
    }

    console.log(`Total rows in Excel: ${data.length}`);

    // Find the last header row
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i] as any[];
      if (row && row.some(cell =>
        cell && (cell.toString().toLowerCase().includes('phone number') ||
          cell.toString().toLowerCase().includes('username') ||
          cell.toString().toLowerCase().includes('first name'))
      )) {
        headerRowIndex = i;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Could not find header row in Excel file');
    }

    console.log('Header row found at index:', headerRowIndex);

    const rawHeaders = data[headerRowIndex] as any[];
    const headers = rawHeaders.map(h =>
      h ? h.toString().trim().replace(/\s+/g, ' ').replace(/\u00a0/g, '').toLowerCase() : ''
    );

    const rows = data.slice(headerRowIndex + 1) as any[][];

    console.log('Extracted headers:', headers);
    console.log('Number of data rows:', rows.length);

    // Detect actual column positions from first data row
    const columnIndexMap: { [key: string]: number } = {};

    if (rows.length > 0) {
      const firstRow = rows[0];

      console.log('First row analysis:');
      firstRow.forEach((cell, idx) => {
        if (cell !== null && cell !== undefined && cell.toString().trim() !== '') {
          console.log(`  Col ${idx}: ${cell} (type: ${typeof cell})`);
        }
      });

      // Find Username (large number, likely in scientific notation)
      for (let i = 0; i < firstRow.length; i++) {
        const cell = firstRow[i];
        if (cell && typeof cell === 'number' && cell > 1e14) {
          columnIndexMap['username'] = i;
          console.log(`✓ Username at column ${i}`);
          break;
        }
      }

      // Find Status (active/expired) - but skip whitespace columns
      for (let i = 0; i < firstRow.length; i++) {
        const cell = firstRow[i];
        if (cell && typeof cell === 'string') {
          const trimmed = cell.toString().trim().replace(/\u00a0/g, '');
          if (trimmed === 'active' || trimmed === 'expired' || trimmed === 'inactive') {
            columnIndexMap['status'] = i;
            console.log(`✓ Status at column ${i}`);
            break;
          }
        }
      }

      // Find First Name (text after status)
      const statusCol = columnIndexMap['status'];
      if (statusCol !== undefined) {
        for (let i = statusCol + 1; i < firstRow.length; i++) {
          const cell = firstRow[i];
          if (cell && typeof cell === 'string') {
            const trimmed = cell.toString().trim();
            if (trimmed.length > 1 && !trimmed.includes('e+') &&
              !/^\d+$/.test(trimmed) && !/^[\u00a0\s]+$/.test(trimmed)) {
              columnIndexMap['firstname'] = i;
              console.log(`✓ First Name at column ${i}`);
              break;
            }
          }
        }
      }

      // Find Phone Number (large number after firstname, around 8-10 billion)
      const firstnameCol = columnIndexMap['firstname'];
      if (firstnameCol !== undefined) {
        for (let i = firstnameCol + 1; i < firstRow.length; i++) {
          const cell = firstRow[i];
          if (cell && typeof cell === 'number' && cell > 1e9 && cell < 1e11) {
            columnIndexMap['phonenumber'] = i;
            console.log(`✓ Phone Number at column ${i}`);
            break;
          }
        }
      }

      // Map remaining columns based on header names
      const headerToFieldMap: { [key: string]: string } = {
        'user id': 'userid',
        'activation date': 'activationdate',
        'created date': 'createddate',
        'expiration date': 'expirationdate',
        'installation date': 'installationdate',
        'static ip and mac': 'staticipandmac',
        'balance': 'balance',
        'due': 'due',
        'gst number': 'gstnumber',
        'group': 'group',
        'package': 'package',
        'sub plan': 'subplan',
        'zone': 'zone',
        'billing address 1': 'billingaddress1',
        'billing address 2': 'billingaddress2',
        'state': 'state',
        'father or company name': 'fatherorcompanyname',
        // 'area': 'area',
        'mode': 'mode'
      };

      headers.forEach((header, idx) => {
        if (header && headerToFieldMap[header]) {
          columnIndexMap[headerToFieldMap[header]] = idx;
          console.log(`✓ ${header} at column ${idx}`);
        }
      });
    }

    console.log('Final Column Index Map:', columnIndexMap);

    if (!columnIndexMap['firstname'] || !columnIndexMap['phonenumber']) {
      throw new Error('Could not detect required columns: First Name and Phone Number');
    }

    // Process each row
    console.log(`Processing ${rows.length} rows`);
    let processedCount = 0;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      try {
        if (!row || !Array.isArray(row)) continue;

        // Check if this is another header row
        const isHeaderRow = row.some(cell =>
          cell && (cell.toString().toLowerCase().includes('phone number') ||
            cell.toString().toLowerCase() === 'username')
        );
        if (isHeaderRow) {
          console.log(`Skipping duplicate header row at ${rowIndex + headerRowIndex + 2}`);
          continue;
        }

        const hasData = row.some(cell =>
          cell !== null && cell !== undefined &&
          cell.toString().trim() !== '' &&
          !/^[\u00a0\s]+$/.test(cell.toString())
        );
        if (!hasData) continue;

        // Extract data using detected column indices
        const userData: any = {
          addedBy: addedBy,
          assignedCompany: addedBy,
          internetProviderId: internetProviderId,
          isActivated: true,
          isAccountVerified: true,
          isDeactivated: false,
          isSuspended: false,
          countryCode: '+91',
          role: 'user',
          country: 'India'
        };

        // Helper function to safely extract and convert values
        const safeExtract = (fieldKey: string, transformer?: (val: any) => any) => {
          const colIdx = columnIndexMap[fieldKey];
          if (colIdx !== undefined && row[colIdx] !== null && row[colIdx] !== undefined) {
            const val = row[colIdx];
            const strVal = val.toString().trim().replace(/\u00a0/g, '');
            if (strVal !== '') {
              return transformer ? transformer(val) : val;
            }
          }
          return null;
        };

        // User ID
        const userIdVal = safeExtract('userid');
        if (userIdVal) userData.userId = userIdVal.toString();

        // Username - handle scientific notation
        const usernameVal = safeExtract('username', (val) => {
          if (val.toString().includes('e+') || val.toString().includes('E+')) {
            return Math.round(parseFloat(val.toString())).toString();
          }
          return val.toString();
        });
        if (usernameVal) userData.userName = usernameVal;

        // Status
        const statusVal = safeExtract('status');
        if (statusVal) {
          const statusStr = statusVal.toString().toLowerCase().trim();
          userData.status = statusStr;
          userData.isActivated = statusStr === 'active';
          userData.isDeactivated = statusStr === 'expired' || statusStr === 'inactive';
        }

        // First Name (REQUIRED)
        const firstNameVal = safeExtract('firstname');
        if (firstNameVal) {
          userData.firstName = firstNameVal.toString().trim();
        }

        // Phone Number (REQUIRED) - handle scientific notation
        const phoneVal = safeExtract('phonenumber', (val) => {
          if (val.toString().includes('e+') || val.toString().includes('E+')) {
            return Math.round(parseFloat(val.toString())).toString();
          }
          return val.toString().replace(/[^0-9]/g, '');
        });
        if (phoneVal) {
          userData.phoneNumber = phoneVal.toString().replace(/[^0-9]/g, '');
        }

        // Activation Date
        const activationDateVal = safeExtract('activationdate', (val) => {
          try {
            const date = new Date(val);
            return !isNaN(date.getTime()) ? date : null;
          } catch {
            return null;
          }
        });
        if (activationDateVal) userData.activationDate = activationDateVal;

        // Created Date
        const createdDateVal = safeExtract('createddate', (val) => {
          try {
            const date = new Date(val);
            return !isNaN(date.getTime()) ? date : null;
          } catch {
            return null;
          }
        });
        if (createdDateVal) userData.createdDate = createdDateVal;

        // Expiration Date
        const expiryVal = safeExtract('expirationdate', (val) => {
          try {
            const date = new Date(val);
            return !isNaN(date.getTime()) ? date : null;
          } catch {
            return null;
          }
        });
        if (expiryVal) userData.expiry = expiryVal;

        // Installation Date
        const installDateVal = safeExtract('installationdate', (val) => {
          try {
            const date = new Date(val);
            return !isNaN(date.getTime()) ? date : null;
          } catch {
            return null;
          }
        });
        if (installDateVal) userData.installationDate = installDateVal;

        // Static IP and MAC
        const staticIpMacVal = safeExtract('staticipandmac');
        if (staticIpMacVal) userData.staticIpMac = staticIpMacVal.toString();

        // Balance
        const balanceVal = safeExtract('balance', (val) => {
          const num = parseFloat(val);
          return isNaN(num) ? 0 : num;
        });
        if (balanceVal !== null) userData.balance = balanceVal;

        // Due
        const dueVal = safeExtract('due', (val) => {
          const num = parseFloat(val);
          return isNaN(num) ? 0 : num;
        });
        if (dueVal !== null) userData.due = dueVal;

        // GST Number
        const gstVal = safeExtract('gstnumber');
        if (gstVal) userData.gstin = gstVal.toString();

        // Group
        const groupVal = safeExtract('group');
        if (groupVal) userData.group = groupVal.toString();

        // Package
        const packageVal = safeExtract('package');
        if (packageVal) userData.packageName = packageVal.toString();

        // Sub Plan
        const subPlanVal = safeExtract('subplan');
        if (subPlanVal) userData.subPlan = subPlanVal.toString();

        // Zone
        const zoneVal = safeExtract('zone');
        if (zoneVal) userData.zone = zoneVal.toString();

        // Billing Address 1
        const billAddr1Val = safeExtract('billingaddress1');
        if (billAddr1Val) userData.billingAddress1 = billAddr1Val.toString();

        // Billing Address 2
        const billAddr2Val = safeExtract('billingaddress2');
        if (billAddr2Val) userData.billingAddress2 = billAddr2Val.toString();

        // State
        const stateVal = safeExtract('state');
        if (stateVal) userData.state = stateVal.toString();

        // Father Or Company Name
        const fatherNameVal = safeExtract('fatherorcompanyname');
        if (fatherNameVal) userData.fatherOrCompanyName = fatherNameVal.toString();

        // Area
        const areaVal = safeExtract('area');
        if (areaVal) {
          const areaStr = areaVal.toString().toLowerCase();
          if (areaStr === 'rural' || areaStr === 'urban') {
            userData.area = areaStr;
          }
        }

        // Mode - skip if not valid enum value
        const modeVal = safeExtract('mode');
        if (modeVal) {
          const modeStr = modeVal.toString().toLowerCase();
          if (modeStr === 'online' || modeStr === 'offline') {
            userData.mode = modeStr;
          }
          // Skip rural/urban/fiber as they are not valid Mode enum values
        }

        // Debug first row
        if (processedCount === 0) {
          console.log('Sample extracted userData:', {
            firstName: userData.firstName,
            phoneNumber: userData.phoneNumber,
            userName: userData.userName,
            status: userData.status,
            balance: userData.balance,
            zone: userData.zone
          });
        }

        // Validate required fields
        if (!userData.phoneNumber || !userData.firstName) {
          console.log(`Row ${rowIndex + headerRowIndex + 2} validation failed - Missing required fields`);
          fileResult.errors.push(
            `Row ${rowIndex + headerRowIndex + 2}: Missing required fields (phone: ${userData.phoneNumber || 'MISSING'}, firstName: ${userData.firstName || 'MISSING'})`
          );
          continue;
        }

        const cleanPhoneNumber = userData.phoneNumber.replace(/[^0-9]/g, '');

        if (cleanPhoneNumber.length < 10) {
          fileResult.errors.push(`Row ${rowIndex + headerRowIndex + 2}: Invalid phone number: ${cleanPhoneNumber}`);
          continue;
        }

        // Check if user already exists
        const existingUser = await UserModel.findOne({
          phoneNumber: cleanPhoneNumber
        });

        if (existingUser) {
          fileResult.duplicateUsers++;
          fileResult.totalUsers++;

          fileResult.duplicateDetails.push({
            phoneNumber: cleanPhoneNumber,
            username: userData.userName || 'N/A',
            action: 'updated'
          });

          const updateData = { ...userData };
          delete updateData.phoneNumber;

          // Ensure email is set to phoneNumber@yopmail.com for updates too
          updateData.email = updateData.email || `${cleanPhoneNumber}@yopmail.com`;

          const updatedUser = await UserModel.findByIdAndUpdate(
            existingUser._id,
            {
              ...updateData,
              updatedAt: new Date()
            },
            { new: true, runValidators: true }
          );

          if (updatedUser) {
            fileResult.updatedUsers++;
            processedCount++;
            console.log(`✓ Updated user ${processedCount}: ${cleanPhoneNumber}`);
          }
        } else {
          const newUser = new UserModel({
            ...userData,
            phoneNumber: cleanPhoneNumber,
            email: userData.email || `${cleanPhoneNumber}@yopmail.com`,
          });

          const savedUser = await newUser.save();
          if (savedUser) {
            fileResult.newUsers++;
            fileResult.totalUsers++;
            processedCount++;
            console.log(`✓ Created user ${processedCount}: ${cleanPhoneNumber}`);
          }
        }

      } catch (rowError: any) {
        console.error(`Error processing row ${rowIndex + headerRowIndex + 2}:`, rowError);
        fileResult.errors.push(`Row ${rowIndex + headerRowIndex + 2}: ${rowError.message}`);
      }
    }

    console.log(`Completed processing. Total users processed: ${processedCount}`);

  } catch (error: any) {
    console.error('Excel file processing error:', error);
    fileResult.errors.push(`File processing error: ${error.message}`);
  }

  return fileResult;
};


export const addConnectUserFromExcel = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { files } = req;
    const addedBy = (req as any).userId;
    const { internetProviderId } = req.body;

    console.log('Request body:', req.body, 'internetProviderId:', internetProviderId);

    if (!files || !Array.isArray(files) || files.length === 0) {
      return sendError(res, 'No files uploaded', 400);
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || typeof file !== 'object') {
        return sendError(res, `File at index ${i} is invalid`, 400);
      }
      if (!file.originalname) {
        return sendError(res, `File at index ${i} is missing original name`, 400);
      }
      if (!file.buffer && !file.path) {
        return sendError(res, `File ${file.originalname} is missing required properties`, 400);
      }
    }

    if (!addedBy) {
      return sendError(res, 'User authentication required', 401);
    }

    const results: {
      totalFiles: number;
      processedFiles: number;
      totalUsers: number;
      newUsers: number;
      updatedUsers: number;
      duplicateUsers: number;
      errors: string[];
      fileResults: Array<{
        fileName: string;
        totalUsers: number;
        newUsers: number;
        updatedUsers: number;
        duplicateUsers: number;
        errors: string[];
        duplicateDetails: Array<{
          phoneNumber: string;
          accountNumber: string;
          action: 'updated' | 'skipped';
        }>;
      }>;
    } = {
      totalFiles: files.length,
      processedFiles: 0,
      totalUsers: 0,
      newUsers: 0,
      updatedUsers: 0,
      duplicateUsers: 0,
      errors: [],
      fileResults: []
    };

    for (const file of files) {
      try {
        console.log(`Processing file: ${file.originalname}`);
        const fileResult = await processConnectExcelFile(file, addedBy, internetProviderId);
        results.fileResults.push(fileResult);
        results.processedFiles++;
        results.totalUsers += fileResult.totalUsers;
        results.newUsers += fileResult.newUsers;
        results.updatedUsers += fileResult.updatedUsers;
        results.duplicateUsers += fileResult.duplicateUsers;
        results.errors.push(...fileResult.errors);
      } catch (fileError: any) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        const errorMessage = file.originalname
          ? `File ${file.originalname}: ${fileError.message}`
          : `Unknown file: ${fileError.message}`;
        results.errors.push(errorMessage);
      }
    }

    let message = `Processed ${results.processedFiles} files. `;
    if (results.newUsers > 0) message += `Added ${results.newUsers} new users. `;
    if (results.updatedUsers > 0) message += `Updated ${results.updatedUsers} existing users. `;
    if (results.duplicateUsers > 0) message += `Found ${results.duplicateUsers} duplicate users. `;
    if (results.errors.length > 0) message += `${results.errors.length} errors occurred.`;

    return sendSuccess(res, results, message);
  } catch (error: any) {
    console.error('Excel upload error:', error);
    return sendError(res, 'Failed to process Excel files', 500, error);
  }
};

const processConnectExcelFile = async (
  file: Express.Multer.File,
  addedBy: string,
  internetProviderId: string
) => {
  if (!file) throw new Error('File object is undefined');
  if (!file.originalname) throw new Error('File has no original name');
  if (!file.buffer && !file.path) throw new Error('File has neither buffer data nor file path');

  const fileResult = {
    fileName: file.originalname,
    totalUsers: 0,
    newUsers: 0,
    updatedUsers: 0,
    duplicateUsers: 0,
    errors: [] as string[],
    duplicateDetails: [] as Array<{
      phoneNumber: string;
      accountNumber: string;
      action: 'updated' | 'skipped';
    }>
  };

  try {
    console.log('File info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path || 'undefined'
    });

    let fileBuffer: Buffer;

    if (file.buffer) {
      if (!Buffer.isBuffer(file.buffer) || file.buffer.length < 100) {
        throw new Error('File buffer is invalid or too small');
      }
      fileBuffer = file.buffer;
    } else if (file.path) {
      try {
        fileBuffer = fs.readFileSync(file.path);
        if (!fileBuffer || fileBuffer.length < 100) {
          throw new Error('File read from disk is invalid or too small');
        }
      } catch (readError: any) {
        throw new Error(`Failed to read file from disk: ${readError.message}`);
      }
    } else {
      throw new Error('No file data available');
    }

    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    if (!fileExtension || !['xls', 'xlsx', 'csv'].includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
    } catch (xlsxError: any) {
      throw new Error(`Failed to parse Excel file: ${xlsxError.message}`);
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no sheets');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error('Could not read worksheet from Excel file');
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!data || data.length < 2) {
      throw new Error('Excel file must have at least header row and one data row');
    }

    console.log(`Total rows in Excel: ${data.length}`);

    // CONNECT file has headers in first row
    const headerRow = data[0] as any[];
    const headers = headerRow.map(h =>
      h ? h.toString().trim().replace(/\s+/g, ' ') : ''
    );

    const rows = data.slice(1) as any[][];

    console.log('Extracted headers:', headers);
    console.log('Number of data rows:', rows.length);

    // Column mapping for CONNECT Excel
    const columnMapping: { [key: string]: string } = {
      'Acct_No': 'accountNumber',
      'Mob': 'phoneNumber',
      'Subs_Name': 'subsName',
      'Reg': 'registrationArea',
      'Due_date': 'dueDate',
      'Gross_Total': 'grossTotal',
      'Open_Date': 'openDate',
      'Add': 'permanentAddress',
      'Phone_No': 'landlineNumber',
      'Net Coll': 'netCollection',
      'Balance': 'balance',
      '% Age': 'paymentPercentage',
      'Slab': 'paymentSlab',
      'New_Con': 'newConnection',
      'Pymt_Tag': 'paymentTag',
      'NODE_CODE': 'nodeCode',
      'LCO Name': 'lcoName',
      'User Name': 'assignedUserName',
      'Plan2': 'planAmount',
      'LCO FOS': 'lcoFos',
      'EXP DATE': 'expiry',
      'EXPIRE RENTAL': 'expireRental'
    };

    // Validate required headers
    const requiredHeaders = ['Acct_No', 'Mob', 'Subs_Name'];
    const missingHeaders: string[] = [];

    requiredHeaders.forEach(required => {
      if (!headers.includes(required)) {
        missingHeaders.push(required);
      }
    });

    console.log('Required headers check:', requiredHeaders);
    console.log('Missing headers:', missingHeaders);

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Debug header mapping
    console.log('Header mapping results:');
    headers.forEach((header, index) => {
      if (header) {
        const mappedField = columnMapping[header];
        console.log(`Column ${index}: "${header}" -> ${mappedField || 'UNMAPPED'}`);
      }
    });

    // Process each row
    console.log(`Processing ${rows.length} rows`);
    let processedCount = 0;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      try {
        if (!row || !Array.isArray(row)) continue;

        const hasData = row.some(cell =>
          cell !== null && cell !== undefined && cell.toString().trim() !== ''
        );
        if (!hasData) continue;

        // Extract data using column mapping
        const userData: any = {
          addedBy: addedBy,
          assignedCompany: addedBy,
          internetProviderId: internetProviderId,
          isActivated: true,
          isAccountVerified: true,
          isDeactivated: false,
          isSuspended: false,
          countryCode: '+91',
          role: 'user',
          country: 'India'
        };

        headers.forEach((header, colIndex) => {
          if (header && columnMapping[header] && row[colIndex] !== null && row[colIndex] !== undefined) {
            const fieldName = columnMapping[header];
            let value = row[colIndex];

            // Skip empty values
            if (value === '' || (typeof value === 'string' && value.trim() === '')) {
              return;
            }

            // Handle special field mappings
            if (fieldName === 'accountNumber') {
              userData[fieldName] = value.toString().trim();
            } else if (fieldName === 'phoneNumber') {
              // Handle scientific notation for phone numbers
              if (typeof value === 'number' || value.toString().includes('e+')) {
                const phoneNum = Math.round(parseFloat(value.toString())).toString();
                userData[fieldName] = phoneNum;
              } else {
                userData[fieldName] = value.toString().replace(/[^0-9]/g, '');
              }
              if (fieldName === 'phoneNumber') {
                userData.countryCode = '+91';
              }
            } else if (fieldName === 'subsName') {
              // Extract first and last name from subscriber name
              const fullName = value.toString().trim();
              const nameParts = fullName.split(/\s+/);
              userData.firstName = nameParts[0] || '';
              userData.lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
              userData.subsName = fullName;
            } else if (fieldName === 'dueDate' || fieldName === 'openDate' || fieldName === 'expiry') {
              try {
                // Handle date strings and Excel serial dates
                if (typeof value === 'number') {
                  // Excel serial date
                  const excelEpoch = new Date(1899, 11, 30);
                  const date = new Date(excelEpoch.getTime() + value * 86400000);
                  userData[fieldName] = date;
                } else if (typeof value === 'string') {
                  // Try to parse date string
                  const parsed = new Date(value);
                  if (!isNaN(parsed.getTime())) {
                    userData[fieldName] = parsed;
                  }
                } else if (value instanceof Date) {
                  userData[fieldName] = value;
                }
              } catch {
                userData[fieldName] = null;
              }
            } else if (fieldName === 'grossTotal' || fieldName === 'netCollection' ||
              fieldName === 'balance' || fieldName === 'paymentPercentage' ||
              fieldName === 'planAmount' || fieldName === 'expireRental') {
              const numValue = parseFloat(value);
              userData[fieldName] = isNaN(numValue) ? 0 : numValue;
            } else if (fieldName === 'newConnection') {
              // Convert to boolean
              if (typeof value === 'number') {
                userData[fieldName] = value > 0;
              } else if (typeof value === 'string') {
                const val = value.toLowerCase();
                userData[fieldName] = val === 'yes' || val === 'true' || val === '1';
              } else {
                userData[fieldName] = Boolean(value);
              }
            } else if (fieldName === 'paymentSlab') {
              const slab = value.toString().trim().toUpperCase();
              userData[fieldName] = slab;
              // Update activation status based on payment slab
              if (slab === 'NOT PAID') {
                userData.isDeactivated = true;
                userData.isActivated = false;
              } else if (slab === 'PAID') {
                userData.isActivated = true;
                userData.isDeactivated = false;
              }
            } else {
              userData[fieldName] = value.toString().trim();
            }
          }
        });

        // Debug first row
        if (processedCount === 0) {
          console.log('Sample extracted userData:', {
            accountNumber: userData.accountNumber,
            firstName: userData.firstName,
            phoneNumber: userData.phoneNumber,
            alternatePhone: userData.alternatePhone,
            balance: userData.balance,
            paymentSlab: userData.paymentSlab
          });
        }

        // Validate required fields
        if (!userData.phoneNumber || !userData.firstName) {
          console.log(`Row ${rowIndex + 2} validation failed - Missing required fields`);
          fileResult.errors.push(
            `Row ${rowIndex + 2}: Missing required fields (phone: ${userData.phoneNumber || 'MISSING'}, firstName: ${userData.firstName || 'MISSING'})`
          );
          continue;
        }

        const cleanPhoneNumber = userData.phoneNumber.replace(/[^0-9]/g, '');

        if (cleanPhoneNumber.length < 10) {
          fileResult.errors.push(`Row ${rowIndex + 2}: Invalid phone number: ${cleanPhoneNumber}`);
          continue;
        }

        // Check if user already exists by phone number OR account number
        const existingUser = await UserModel.findOne({
          $or: [
            { phoneNumber: cleanPhoneNumber },
            { accountNumber: userData.accountNumber }
          ]
        });

        if (existingUser) {
          fileResult.duplicateUsers++;
          fileResult.totalUsers++;

          fileResult.duplicateDetails.push({
            phoneNumber: cleanPhoneNumber,
            accountNumber: userData.accountNumber || 'N/A',
            action: 'updated'
          });

          const updateData = { ...userData };
          // delete updateData.phoneNumber; // Don't update phone number

          const updatedUser = await UserModel.findByIdAndUpdate(
            existingUser._id,
            {
              ...updateData,
              updatedAt: new Date(),
              email: userData.email || `${cleanPhoneNumber}@yopmail.com`,
            },
            { new: true, runValidators: true }
          );

          if (updatedUser) {
            fileResult.updatedUsers++;
            processedCount++;
            console.log(`✓ Updated user ${processedCount}: ${cleanPhoneNumber} (Account: ${userData.accountNumber})`);
          }
        } else {
          const newUser = new UserModel({
            ...userData,
            phoneNumber: cleanPhoneNumber,
            email: userData.email || `${cleanPhoneNumber}@yopmail.com`,
          });

          const savedUser = await newUser.save();
          if (savedUser) {
            fileResult.newUsers++;
            fileResult.totalUsers++;
            processedCount++;
            console.log(`✓ Created user ${processedCount}: ${cleanPhoneNumber} (Account: ${userData.accountNumber})`);
          }
        }

      } catch (rowError: any) {
        console.error(`Error processing row ${rowIndex + 2}:`, rowError);
        fileResult.errors.push(`Row ${rowIndex + 2}: ${rowError.message}`);
      }
    }

    console.log(`Completed processing. Total users processed: ${processedCount}`);

  } catch (error: any) {
    console.error('Excel file processing error:', error);
    fileResult.errors.push(`File processing error: ${error.message}`);
  }

  return fileResult;
};

import { Request, Response, NextFunction } from 'express';
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
      page = 1, 
      limit = 6, 
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

    // Calculate skip value for pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get total count for pagination
    const totalEngineers = await UserModel.countDocuments(filterConditions);

    // Get engineers with pagination and population
    const engineers = await UserModel.find(filterConditions)
      .select('_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode lastLogin createdAt updatedAt isDeactivated isSuspended isAccountVerified permanentAddress billingAddress country language companyPreference userName fatherName')
      .populate('profileImage', 'url')
      .sort(sortConditions)
      .skip(skip)
      .limit(Number(limit));

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

      // Engineer List with pagination
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

      // Pagination Info
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalEngineers / Number(limit)),
        totalItems: totalEngineers,
        itemsPerPage: Number(limit),
        hasNextPage: Number(page) < Math.ceil(totalEngineers / Number(limit)),
        hasPrevPage: Number(page) > 1
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
      billingAddress, 
      country, 
      language, 
      companyPreference,
      userName,
      fatherName,
      provider,
      providerId
    } = req.body;

    // Handle uploaded profile image
    let profileImage = null;
    if (req.file) {
      try {
        // Validate file type
        if (!req.file.mimetype.startsWith('image/')) {
          return sendError(res, 'Profile image must be an image file', 400);
        }
        
        // Extract file URL from the uploaded file path
        const absolutePath = req.file.path.replace(/\\/g, "/");
        const viewIndex = absolutePath.lastIndexOf("/view/");
        if (viewIndex !== -1) {
          profileImage = absolutePath.substring(viewIndex);
        } else {
          profileImage = req.file.path;
        }
        console.log('Profile image uploaded:', profileImage);
      } catch (fileError) {
        console.error('Error processing uploaded file:', fileError);
        return sendError(res, 'Error processing uploaded profile image', 400);
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

    // Generate random password only (no OTP needed for admin-created accounts)
    const randomPassword = generateRandomPassword();
    const hashedPassword = await hashPassword(randomPassword);

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
      billingAddress,
      country,
      language,
      companyPreference,
      userName: userName || `${firstName.toLowerCase()}${lastName.toLowerCase()}${Date.now()}`,
      fatherName,
      provider,
      providerId,
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
      text: `Your engineer account credentials:\nEmail: ${email}\nPassword: ${randomPassword}\n\nYour account is already verified and ready to use.`,
      html: generateEngineerCredentialsEmail(email, randomPassword, firstName)
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
      billingAddress, 
      country, 
      language, 
      companyPreference,
      userName,
      fatherName,
      provider,
      providerId
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

    // Handle uploaded profile image
    let profileImage = existingEngineer.profileImage; // Keep existing image by default
    if (req.file) {
      try {
        // Validate file type
        if (!req.file.mimetype.startsWith('image/')) {
          return sendError(res, 'Profile image must be an image file', 400);
        }
        
        // Extract file URL from the uploaded file path
        const absolutePath = req.file.path.replace(/\\/g, "/");
        const viewIndex = absolutePath.lastIndexOf("/view/");
        if (viewIndex !== -1) {
          profileImage = absolutePath.substring(viewIndex);
        } else {
          profileImage = req.file.path;
        }
        console.log('New profile image uploaded:', profileImage);
      } catch (fileError) {
        console.error('Error processing uploaded file:', fileError);
        return sendError(res, 'Error processing uploaded profile image', 400);
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
    if (billingAddress !== undefined) updateData.billingAddress = billingAddress;
    if (country !== undefined) updateData.country = country;
    if (language !== undefined) updateData.language = language;
    if (companyPreference !== undefined) updateData.companyPreference = companyPreference;
    if (userName !== undefined) updateData.userName = userName;
    if (fatherName !== undefined) updateData.fatherName = fatherName;
    if (provider !== undefined) updateData.provider = provider;
    if (providerId !== undefined) updateData.providerId = providerId;
    
    // Update profile image if new one was uploaded
    if (req.file) {
      updateData.profileImage = profileImage;
    }

    // Update engineer
    const updatedEngineer = await UserModel.findByIdAndUpdate(
      engineerId,
      updateData,
      { new: true, runValidators: true }
    ).select('_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode permanentAddress billingAddress country language companyPreference userName fatherName provider providerId updatedAt');

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
      billingAddress: updatedEngineer.billingAddress,
      country: updatedEngineer.country,
      language: updatedEngineer.language,
      companyPreference: updatedEngineer.companyPreference,
      userName: updatedEngineer.userName,
      fatherName: updatedEngineer.fatherName,
      provider: updatedEngineer.provider,
      providerId: updatedEngineer.providerId,
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
    const engineer:any = await UserModel.findById(userId).select('_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode lastLogin createdAt updatedAt isDeactivated isSuspended isAccountVerified permanentAddress billingAddress country language companyPreference userName fatherName').populate("parentCompany",
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
      company:{
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
      errors: string[];
      fileResults: Array<{
        fileName: string;
        totalUsers: number;
        newUsers: number;
        updatedUsers: number;
        errors: string[];
      }>;
    } = {
      totalFiles: files.length,
      processedFiles: 0,
      totalUsers: 0,
      newUsers: 0,
      updatedUsers: 0,
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
    errors: [] as string[]
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

    // Map Excel headers to User model fields
    const headerMapping: { [key: string]: string } = {
      'PHONE_NO': 'phoneNumber',
      'PHONE_N': 'phoneNumber',
      'PHONE N': 'phoneNumber',
      'OLT_IP': 'oltIp',
      'MTCE_FRANCHISE_CODE': 'mtceFranchise',
      'MTCE_FRANCHISE': 'mtceFranchise',
      'CATEGORY': 'category',
      'CATEG': 'category',
      'CUSTOMER_NAME': 'customerName',
      'CUSTOMER NAME': 'customerName',
      'MOBILE_NO': 'mobile',
      'MOBILE': 'mobile',
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

    // Validate required headers with flexible matching
    const requiredHeaders = [
      { key: 'PHONE_N', patterns: ['PHONE_NO', 'PHONE_N', 'PHONE N', 'PHONE'] },
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
          isActivated: false
        };

        headers.forEach((header, colIndex) => {
          if (header && row && Array.isArray(row) && colIndex < row.length && row[colIndex] !== undefined && row[colIndex] !== null) {
            const fieldName = headerMapping[header];
            if (fieldName) {
              let value = row[colIndex];

              // Handle special field mappings
              if (fieldName === 'customerName') {
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
              } else if (fieldName === 'phoneNumber') {
                // Clean phone number
                userData[fieldName] = value.toString().replace(/[^0-9-]/g, '');
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

        // Check if user already exists by email
        const existingUser = await UserModel.findOne({ 
          email: userData.email.toLowerCase() 
        });

        if (existingUser) {
          // Update existing user
          const updateData = { ...userData };
          delete updateData.email; // Don't update email
          delete updateData.phoneNumber; // Don't update phone number
          delete updateData.firstName; // Don't update firstName
          delete updateData.lastName; // Don't update lastName

          // Update only the new fields from Excel
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
            fileResult.totalUsers++;
          }
        } else {
          // Create new user
          const newUser = new UserModel({
            ...userData,
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

export const getUserManagementData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const companyId = (req as any).userId;
    
    // Get pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get customer data first to find which users have customer records
    const customerData = await CustomerModel.find({
      userId: { $exists: true }
    }).select("_id userId fdbId oltId isInstalled createdAt updatedAt")
      .populate('fdbId', 'fdbId fdbName')
      .populate('oltId', 'oltId oltName');

    // Extract user IDs from customer data
    const userIds = customerData.map(customer => customer.userId as any);

    // Handle search functionality
    let filteredUserIds = userIds;
    if(req.query.search){
      const searchTerm = req.query.search as string;
      console.log('Search term:', searchTerm);
      
      // Search in User collection across ALL users (not limited by customer records)
      const userSearchQuery = {
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
      
      // Filter to only include users who have customer records AND match search
      filteredUserIds = userIds.filter(id => searchResultUserIds.includes(id.toString()));
      console.log('Filtered user IDs:', filteredUserIds.length);
    }

    // Get total count for pagination (users with customer records + search filter)
    const totalUsersCount = await UserModel.countDocuments({ 
      _id: { $in: filteredUserIds },
      assignedCompany: companyId,
      role: Role.USER
    });

    // Get paginated users who have customer records (with search filter)
    const userManagementData = await UserModel.find({ 
      _id: { $in: filteredUserIds },
      assignedCompany: companyId,
      role: Role.USER
    }).select("_id firstName lastName email phoneNumber companyPreference permanentAddress residentialAddress landlineNumber mtceFranchise bbUserId bbPassword ruralUrban acquisitionType category ftthExchangePlan llInstallDate bbPlan workingStatus createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get modem data for these users
    const modemData = await Modem.find({
      userId: { $in: filteredUserIds }
    }).select("_id userId modemName ontType modelNumber serialNumber ontMac username password createdAt updatedAt");

    // Combine user data with customer and modem information
    const combinedData = userManagementData.map((user, index) => {
      const customer = customerData.find(c => c.userId.toString() === userIds[index].toString());
      const modem = modemData.find(m => m.userId.toString() === userIds[index].toString());

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
        } : null
      };
    });

    // Calculate summary statistics (GLOBAL - from ALL users, not just current page)
    const totalUsers = totalUsersCount;
    const usersWithCustomerData = totalUsers; // All users have customer data since we filtered by it
    
    // Get ALL modem data for global statistics
    const allModemData = await Modem.find({
      userId: { $in: userIds }
    }).select("_id userId");
    
    const usersWithModemData = allModemData.length;
    
    // Get ALL customer data for global statistics
    const allCustomerData = await CustomerModel.find({
      userId: { $in: userIds }
    }).select("_id userId isInstalled");
    
    const installedUsers = allCustomerData.filter(customer => customer.isInstalled === true).length;
    const pendingInstallation = allCustomerData.filter(customer => customer.isInstalled === false).length;
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalUsersCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = {
      summary: {
        totalUsers,
        usersWithCustomerData,
        usersWithModemData,
        installedUsers,
        pendingInstallation,
        usersWithoutCustomerData: totalUsers - usersWithCustomerData,
        usersWithoutModemData: totalUsers - usersWithModemData
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
      isInstalled = true
    } = req.body;

    const companyId = (req as any).userId;

    // Check if user already exists
    const checkUser = await UserModel.findOne({ email });
    if(checkUser){
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    // Check if landline number already exists
    const checkLandLine = await UserModel.findOne({ landlineNumber });
    if(checkLandLine){
      return res.status(400).json({
        success: false,
        message: "Landline number already exists"
      });
    }
    
    // Generate random password using a-z and 0-9
    const generatedPassword = generateRandomPassword(8);
    const hashedPassword = await hashPassword(generatedPassword);
    
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
      assignedCompany:companyId,
      password:hashedPassword,
      isAccountVerified:true,
      isDeactivated:false,
      isSuspended:false
    };

    // Validate OLT and FDB before starting transaction
    const olt = await OLTModel.findOne({oltId});
    if(!olt){
      return res.status(400).json({
        success: false,
        message: "OLT not found"
      });
    }

    const fdb = await FDBModel.findOne({fdbId});
    if(!fdb){
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
            fdbId:fdb._id,
            oltId:olt._id,
            isInstalled: isInstalled
          }], { session })
        ]);

        // Return all created records
        return {
          newUser,
          modemResult: modemResult[0],
          customerResult: customerResult[0]
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
          customerId: result.customerResult._id
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
      .select('_id firstName lastName email phoneNumber companyPreference permanentAddress residentialAddress landlineNumber mtceFranchise bbUserId bbPassword ruralUrban acquisitionType category ftthExchangePlan llInstallDate bbPlan workingStatus createdAt updatedAt')
      .lean();

    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Fetch related modem details
    const modemDetails = await Modem.findOne({ userId: userId }).lean();
    
    // Fetch related customer details
    const customerDetails = await CustomerModel.findOne({ userId: userId }).populate("fdbId", "fdbId fdbName").populate("oltId", "oltId serialNumber oltIp macAddress ").lean();

    return sendSuccess(res, {
      user,
      modemDetails,
      customerDetails
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
      isInstalled
    } = req.body;

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

        // Always update customer record
        let updatedCustomer = null;
        const customerUpdateData: any = {};
        
        
        // Update isInstalled if provided
        if (isInstalled !== undefined) {
          customerUpdateData.isInstalled = isInstalled;
        }

        // Always update customer record (even if no fields changed, it will refresh the record)
        updatedCustomer = await CustomerModel.findOneAndUpdate(
          { userId: userId },
          customerUpdateData,
          { new: true, session }
        );

        return {
          updatedUser,
          updatedModem,
          updatedCustomer
        };
      });

      return sendSuccess(res, {
        user: result.updatedUser,
        modem: result.updatedModem,
        customer: result.updatedCustomer
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




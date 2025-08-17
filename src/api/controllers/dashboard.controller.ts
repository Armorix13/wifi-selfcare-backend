import { Request, Response, NextFunction } from 'express';
import Product from '../models/product.model';
import Order from '../models/order.model';
import { CategoryModel } from '../models/category.model';
import { UserModel } from '../models/user.model';
import { IptvPlan } from '../models/iptvPlan.model';
import { OttPlan } from '../models/ottPlan.model';
import { Plan } from '../models/plan.model';
import { sendSuccess, sendError } from '../../utils/helper';

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

    // Build filter conditions
    const filterConditions: any = {
      role: 'engineer',
      isDeleted: false
    };

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
      .select('_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode lastLogin createdAt isDeactivated isSuspended isAccountVerified')
      .populate('profileImage', 'url')
      .sort(sortConditions)
      .skip(skip)
      .limit(Number(limit));

    // Calculate analytics
    const totalEngineersCount = await UserModel.countDocuments({ role: 'engineer', isDeleted: false });
    const activeEngineersCount = await UserModel.countDocuments({ 
      role: 'engineer', 
      isDeleted: false, 
      isDeactivated: false, 
      isSuspended: false, 
      isAccountVerified: true 
    });
    const inactiveEngineersCount = totalEngineersCount - activeEngineersCount;

    // Calculate average rating (if you have rating system)
    // For now, we'll use a placeholder - you can implement actual rating logic
    const avgRating = 89.4; // This should come from your rating system

    // Get status distribution
    const statusDistribution = await UserModel.aggregate([
      { $match: { role: 'engineer', isDeleted: false } },
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

    // Get group distribution
    const groupDistribution = await UserModel.aggregate([
      { $match: { role: 'engineer', isDeleted: false, group: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$group',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get zone distribution
    const zoneDistribution = await UserModel.aggregate([
      { $match: { role: 'engineer', isDeleted: false, zone: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$zone',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get area distribution
    const areaDistribution = await UserModel.aggregate([
      { $match: { role: 'engineer', isDeleted: false, area: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$area',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get mode distribution
    const modeDistribution = await UserModel.aggregate([
      { $match: { role: 'engineer', isDeleted: false, mode: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$mode',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentActivity = await UserModel.countDocuments({
      role: 'engineer',
      isDeleted: false,
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
        isActive: !engineer.isDeactivated && !engineer.isSuspended && engineer.isAccountVerified,
        accountStatus: {
          isDeactivated: engineer.isDeactivated,
          isSuspended: engineer.isSuspended,
          isAccountVerified: engineer.isAccountVerified
        }
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

    const engineer = await UserModel.findOne({ 
      _id: id, 
      role: 'engineer', 
      isDeleted: false 
    })
    .select('_id firstName lastName email phoneNumber countryCode profileImage role status group zone area mode lastLogin createdAt isDeactivated isSuspended isAccountVerified permanentAddress billingAddress country language companyPreference')
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
      isActive: !engineer.isDeactivated && !engineer.isSuspended && engineer.isAccountVerified,
      accountStatus: {
        isDeactivated: engineer.isDeactivated,
        isSuspended: engineer.isSuspended,
        isAccountVerified: engineer.isAccountVerified
      },
      // Additional details
      permanentAddress: engineer.permanentAddress,
      billingAddress: engineer.billingAddress,
      country: engineer.country,
      language: engineer.language,
      companyPreference: engineer.companyPreference
    };

    return sendSuccess(res, engineerData, 'Engineer details fetched successfully');
  } catch (error: any) {
    console.error('Get engineer by ID error:', error);
    return sendError(res, 'Failed to fetch engineer details', 500, error);
  }
};

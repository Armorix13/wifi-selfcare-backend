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
    const fibreFilters = { ...filters };
    if (fibreFilters.$or) {
      fibreFilters.$or = fibreFilters.$or.map((or: any) => {
        if (or.name) or.title = or.name;
        return or;
      });
    }
    delete fibreFilters.name;
    fibreFilters.planType = { $regex: /fibre|broadband|internet/i };
    
    const fibrePlans = await Plan.find(fibreFilters)
      .select('title price validity speed dataLimit provider logo benefits description planType')
      .sort({ price: 1 })
      .skip(skip)
      .limit(Number(limit));

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
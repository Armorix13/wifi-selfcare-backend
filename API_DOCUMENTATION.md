# WiFi Selfcare Analytics API Documentation

## Overview
This API provides comprehensive analytics for products, orders, and dashboard data with advanced filtering and pagination capabilities.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Dashboard Analytics

### Get Comprehensive Dashboard Analytics
**GET** `/dashboard/analytics`

Returns comprehensive analytics combining products and orders data.

#### Query Parameters
- `dateRange` (optional): Date range filter in format "startDate,endDate" (ISO format)
- `category` (optional): Filter by category ID
- `productType` (optional): Filter by product type ("user_sale" or "engineer_only")
- `userType` (optional): Filter by user type ("user" or "engineer")
- `status` (optional): Filter by order status

#### Response
```json
{
  "success": true,
  "message": "Dashboard analytics data fetched successfully",
  "data": {
    "metrics": {
      "totalProducts": 8,
      "activeProducts": 8,
      "inactiveProducts": 0,
      "inventoryValue": 2379074,
      "averageRating": 4.5,
      "lowStockAlerts": 0,
      "positiveReviews": 100,
      "totalOrders": 5,
      "completedOrders": 2,
      "pendingOrders": 1,
      "totalRevenue": 57692,
      "completedRevenue": 17997,
      "averageOrderValue": 11538.4,
      "recentProducts": 2,
      "recentOrders": 3
    },
    "categoryDistribution": [
      {
        "category": "Router",
        "count": 2,
        "percentage": 25
      },
      {
        "category": "Modem",
        "count": 1,
        "percentage": 12.5
      }
    ],
    "productTypeDistribution": [
      {
        "_id": "user_sale",
        "count": 4
      },
      {
        "_id": "engineer_only",
        "count": 4
      }
    ],
    "userTypeDistribution": [
      {
        "_id": "user",
        "count": 3,
        "totalAmount": 42996
      },
      {
        "_id": "engineer",
        "count": 2,
        "totalAmount": 14696
      }
    ],
    "orderStatusDistribution": [
      {
        "status": "pending",
        "count": 1,
        "percentage": 20
      },
      {
        "status": "delivered",
        "count": 2,
        "percentage": 40
      }
    ],
    "topSellingProducts": [
      {
        "_id": "product_id",
        "totalQuantity": 5,
        "totalRevenue": 12999,
        "productName": "TP-Link Archer AX73 WiFi 6 Router",
        "productType": "user_sale"
      }
    ],
    "filters": {
      "categories": [...],
      "productTypes": [
        { "value": "user_sale", "label": "User Sale" },
        { "value": "engineer_only", "label": "Engineer Only" }
      ],
      "userTypes": [
        { "value": "user", "label": "Customer" },
        { "value": "engineer", "label": "Engineer" }
      ],
      "statusOptions": [
        { "value": "pending", "label": "Pending" },
        { "value": "confirmed", "label": "Confirmed" },
        { "value": "shipped", "label": "Shipped" },
        { "value": "delivered", "label": "Delivered" },
        { "value": "cancelled", "label": "Cancelled" }
      ]
    }
  }
}
```

---

## Product Analytics

### Get Product Analytics
**GET** `/products/analytics`

Returns comprehensive product analytics with filtering and pagination.

#### Query Parameters
- `category` (optional): Filter by category ID
- `productType` (optional): Filter by product type ("user_sale" or "engineer_only")
- `status` (optional): Filter by product status ("active" or "inactive")
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search in title, brand, or SKU
- `sortBy` (optional): Sort field (default: "createdAt")
- `sortOrder` (optional): Sort order "asc" or "desc" (default: "desc")

#### Response
```json
{
  "success": true,
  "message": "Product analytics data fetched successfully",
  "data": {
    "analytics": {
      "totalProducts": 8,
      "activeProducts": 8,
      "inactiveProducts": 0,
      "inventoryValue": 2379074,
      "averageRating": 4.5,
      "lowStockAlerts": 0,
      "recentProducts": 2,
      "stockAnalysis": {
        "outOfStock": 0,
        "lowStock": 0,
        "inStock": 8
      },
      "priceRanges": {
        "low": 2,
        "medium": 3,
        "high": 2,
        "premium": 1
      }
    },
    "categoryDistribution": [...],
    "productTypeDistribution": [...],
    "products": {
      "data": [
        {
          "_id": "product_id",
          "title": "TP-Link Archer AX73 WiFi 6 Router",
          "brand": "TP-Link",
          "sku": "TP-Link - Archer AX73",
          "category": {
            "_id": "category_id",
            "name": "Router",
            "image": "router.jpg",
            "description": "Network routers"
          },
          "productType": "user_sale",
          "stock": 45,
          "price": 12999,
          "finalPrice": 12999,
          "isActive": true,
          "averageRating": 4.5,
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 8,
        "totalPages": 1
      }
    },
    "filters": {
      "categories": [...],
      "productTypes": [...],
      "statusOptions": [...]
    }
  }
}
```

---

## Order Analytics

### Get Order Analytics
**GET** `/orders/analytics`

Returns comprehensive order analytics with filtering and pagination.

#### Query Parameters
- `status` (optional): Filter by order status
- `productType` (optional): Filter by product type in orders
- `userType` (optional): Filter by user type ("user" or "engineer")
- `dateRange` (optional): Date range filter in format "startDate,endDate"
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search in order details
- `sortBy` (optional): Sort field (default: "createdAt")
- `sortOrder` (optional): Sort order "asc" or "desc" (default: "desc")

#### Response
```json
{
  "success": true,
  "message": "Order analytics data fetched successfully",
  "data": {
    "analytics": {
      "totalOrders": 5,
      "completedOrders": 2,
      "pendingOrders": 1,
      "totalRevenue": 57692,
      "completedRevenue": 17997,
      "averageOrderValue": 11538.4,
      "recentOrders": 3,
      "priorityAnalysis": {
        "low": 1,
        "medium": 2,
        "high": 1,
        "urgent": 1
      }
    },
    "statusDistribution": [
      {
        "status": "pending",
        "count": 1,
        "percentage": 20
      },
      {
        "status": "delivered",
        "count": 2,
        "percentage": 40
      }
    ],
    "userTypeDistribution": [
      {
        "_id": "user",
        "count": 3,
        "totalAmount": 42996
      },
      {
        "_id": "engineer",
        "count": 2,
        "totalAmount": 14696
      }
    ],
    "productTypeDistribution": [
      {
        "_id": "user_sale",
        "count": 3,
        "totalQuantity": 4,
        "totalAmount": 42996
      },
      {
        "_id": "engineer_only",
        "count": 2,
        "totalQuantity": 4,
        "totalAmount": 14696
      }
    ],
    "orders": {
      "data": [
        {
          "_id": "order_id",
          "orderNumber": "ORD-2024-001",
          "products": [
            {
              "product": {
                "_id": "product_id",
                "title": "TP-Link Archer AX73 WiFi 6 Router",
                "productType": "user_sale"
              },
              "quantity": 1,
              "amount": 12999
            }
          ],
          "customer": {
            "name": "Rajesh Kumar",
            "role": "user",
            "isEngineer": false
          },
          "totalAmount": 12999,
          "orderStatus": "delivered",
          "paymentMethod": "cash_on_delivery",
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 5,
        "totalPages": 1
      }
    },
    "filters": {
      "statusOptions": [...],
      "productTypes": [...],
      "userTypes": [...]
    }
  }
}
```

---

## Product Management

### Add Product
**POST** `/products`

Add a new product with product type support.

#### Request Body
```json
{
  "title": "TP-Link Archer AX73 WiFi 6 Router",
  "description": "High-speed WiFi 6 router",
  "price": 12999,
  "discount": 0,
  "category": "category_id",
  "stock": 45,
  "sku": "TP-Link - Archer AX73",
  "brand": "TP-Link",
  "tags": ["router", "wifi6"],
  "attributes": {
    "wifi_speed": "5400 Mbps",
    "ports": 4
  },
  "productType": "user_sale"
}
```

#### Response
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "_id": "product_id",
    "title": "TP-Link Archer AX73 WiFi 6 Router",
    "productType": "user_sale",
    "price": 12999,
    "stock": 45,
    "isActive": true
  }
}
```

### Update Product
**PUT** `/products/:id`

Update an existing product.

#### Request Body
Same as Add Product, all fields are optional.

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information",
  "statusCode": 400
}
```

Common HTTP Status Codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

---

## Usage Examples

### Get Dashboard Analytics for Last 30 Days
```bash
curl -X GET "http://localhost:3000/api/dashboard/analytics?dateRange=2024-01-01,2024-01-31" \
  -H "Authorization: Bearer your-jwt-token"
```

### Get Product Analytics Filtered by Category
```bash
curl -X GET "http://localhost:3000/api/products/analytics?category=category_id&productType=user_sale" \
  -H "Authorization: Bearer your-jwt-token"
```

### Get Order Analytics for Engineers Only
```bash
curl -X GET "http://localhost:3000/api/orders/analytics?userType=engineer&status=delivered" \
  -H "Authorization: Bearer your-jwt-token"
```

---

## Data Models

### Product Type
- `user_sale`: Products available for regular customers
- `engineer_only`: Products available only for engineers

### Order Status
- `pending`: Order is pending
- `confirmed`: Order is confirmed
- `shipped`: Order is shipped
- `delivered`: Order is delivered
- `cancelled`: Order is cancelled
- `returned`: Order is returned

### User Types
- `user`: Regular customer
- `engineer`: Engineer/technical staff
- `admin`: Administrator
- `superadmin`: Super administrator 
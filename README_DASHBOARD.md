# Complaint Management Dashboard API

## Overview
The complaint management dashboard provides comprehensive analytics and insights for managing WiFi and CCTV complaints. The dashboard includes KPIs, distributions, trends, and additional global data.

## New Endpoint

### GET `/api/complaints/dashboard`
Returns comprehensive dashboard data including KPIs, distributions, trends, and additional analytics.

**Authentication:** Required (Admin/Manager/SuperAdmin only)

**Query Parameters:**
- `startDate` (optional): Start date for filtering data (ISO date string)
- `endDate` (optional): End date for filtering data (ISO date string)

## Response Structure

```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "dashboardData": {
      "kpis": {
        "totalComplaints": {
          "value": 6,
          "change": "12.0",
          "trend": "up"
        },
        "resolutionRate": {
          "value": "0.0",
          "change": "5.2",
          "trend": "up"
        },
        "avgResolutionTime": {
          "value": "2.5",
          "change": "-0.25",
          "trend": "up"
        },
        "pendingIssues": {
          "value": 3,
          "change": "-8.0",
          "trend": "up"
        }
      },
      "distributions": {
        "status": [
          {
            "status": "pending",
            "count": 3,
            "percentage": "50.0"
          },
          {
            "status": "assigned",
            "count": 3,
            "percentage": "50.0"
          }
        ],
        "type": [
          {
            "type": "WIFI",
            "count": 5,
            "percentage": "83.3"
          },
          {
            "type": "CCTV",
            "count": 1,
            "percentage": "16.7"
          }
        ]
      },
      "trends": {
        "daily": [
          {
            "date": "2024-08-01",
            "newComplaints": 2,
            "resolved": 1
          }
          // ... 7 days of data
        ]
      },
      "summary": {
        "currentPeriod": {
          "total": 6,
          "resolved": 0,
          "pending": 3,
          "avgResolutionTime": 2.5
        },
        "lastMonth": {
          "total": 5,
          "resolved": 1,
          "pending": 2,
          "avgResolutionTime": 2.75
        }
      },
      "additionalData": {
        "priorityDistribution": [
          {
            "priority": "medium",
            "count": 4
          },
          {
            "priority": "high",
            "count": 2
          }
        ],
        "topIssueTypes": [
          {
            "issueType": "Connection Issues",
            "count": 3
          },
          {
            "issueType": "Slow Speed",
            "count": 2
          }
        ],
        "engineerPerformance": [
          {
            "engineer": "John Doe",
            "totalAssigned": 5,
            "resolved": 4,
            "resolutionRate": "80.0"
          }
        ],
        "recentActivity": [
          {
            "id": "complaint_id",
            "title": "WiFi not working",
            "status": "pending",
            "type": "WIFI",
            "priority": "high",
            "createdAt": "2024-08-07T10:00:00Z",
            "user": "Jane Smith",
            "engineer": "John Doe"
          }
        ]
      }
    }
  }
}
```

## Features

### 1. Key Performance Indicators (KPIs)
- **Total Complaints**: Current period total with month-over-month change
- **Resolution Rate**: Percentage of resolved complaints with trend
- **Average Resolution Time**: Average time to resolve complaints in hours
- **Pending Issues**: Number of pending complaints with trend

### 2. Distributions
- **Status Distribution**: Pie chart data showing complaint status breakdown
- **Type Distribution**: WIFI vs CCTV complaint distribution

### 3. Trends
- **Daily Trends**: Last 7 days of new complaints and resolutions
- **Month-over-Month Comparison**: Current period vs last month

### 4. Additional Analytics
- **Priority Distribution**: Breakdown by priority levels
- **Top Issue Types**: Most common issue types
- **Engineer Performance**: Top 5 engineers by resolution rate
- **Recent Activity**: Last 10 complaints with details

## Usage Examples

### Get Current Month Dashboard
```bash
GET /api/complaints/dashboard
```

### Get Custom Date Range Dashboard
```bash
GET /api/complaints/dashboard?startDate=2024-08-01&endDate=2024-08-31
```

## Data Calculations

### Resolution Rate
```
Resolution Rate = (Resolved Complaints / Total Complaints) × 100
```

### Average Resolution Time
```
Avg Resolution Time = Sum(Resolution Time for each resolved complaint) / Number of resolved complaints
```

### Trend Calculations
- **Positive Trend**: Current value is better than previous period
- **Negative Trend**: Current value is worse than previous period
- For resolution time and pending issues, lower values are considered better

## Error Handling

The endpoint includes proper error handling for:
- Authentication failures
- Authorization failures (non-admin users)
- Database query errors
- Invalid date parameters

## Performance Considerations

- Uses MongoDB aggregation pipelines for efficient data processing
- Includes database indexes on frequently queried fields
- Implements pagination for large datasets
- Caches frequently accessed data where appropriate 
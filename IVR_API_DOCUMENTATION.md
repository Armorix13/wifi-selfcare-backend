# IVR API Documentation

## Overview
Complete API endpoints for managing IVR (Interactive Voice Response) numbers and their association with companies.

## Base URL
All IVR endpoints are prefixed with `/ivr`

## Authentication
Most endpoints require authentication. Use the `authenticate` middleware.
**Note:** Public endpoints (for IVR system integration) do not require authentication.

---

## API Endpoints

### 1. Add IVR
**POST** `/ivr/add`

Create a new IVR number.

**Request Body:**
```json
{
  "ivrNumber": "1800-1234-5678",
  "name": "Customer Support IVR",
  "area": "urban",
  "description": "Main customer support line",
  "associatedCompany": "companyId (optional)",
  "status": "inactive"
}
```

**Response:**
```json
{
  "success": true,
  "message": "IVR added successfully",
  "data": {
    "ivr": {
      "_id": "...",
      "ivrNumber": "1800-1234-5678",
      "name": "Customer Support IVR",
      "area": "urban",
      "isAssigned": false,
      "status": "inactive",
      ...
    }
  }
}
```

---

### 2. Get All IVRs
**GET** `/ivr/all`

Get all IVRs with filters. Includes associated company information.

**Query Parameters:**
- `isAssigned` (boolean): Filter by assignment status
- `area` (string): Filter by area ("rural" or "urban")
- `status` (string): Filter by status ("active", "inactive", "assigned", "unassigned")
- `companyId` (string): Filter by company ID

**Example:**
- `/ivr/all` - Get all IVRs
- `/ivr/all?isAssigned=true` - Get only assigned IVRs
- `/ivr/all?area=urban` - Get urban IVRs
- `/ivr/all?companyId=507f1f77bcf86cd799439011` - Get IVRs for specific company

**Response:**
```json
{
  "success": true,
  "message": "IVRs fetched successfully",
  "data": {
    "ivrs": [
      {
        "_id": "...",
        "ivrNumber": "1800-1234-5678",
        "name": "Customer Support IVR",
        "area": "urban",
        "isAssigned": true,
        "assignedToCompany": {
          "companyName": "ABC Internet",
          "email": "admin@abc.com",
          "companyPhone": "+911234567890"
        },
        "status": "assigned",
        ...
      }
    ],
    "summary": {
      "total": 10,
      "assigned": 7,
      "unassigned": 3
    }
  }
}
```

---

### 3. Get IVR by ID
**GET** `/ivr/:ivrId`

Get a specific IVR by its ID.

**Response:**
```json
{
  "success": true,
  "message": "IVR fetched successfully",
  "data": {
    "ivr": {
      "_id": "...",
      "ivrNumber": "1800-1234-5678",
      "name": "Customer Support IVR",
      "assignedToCompany": {...},
      "associatedCompany": {...},
      "addedBy": {...},
      ...
    }
  }
}
```

---

### 4. Update IVR
**PUT** `/ivr/:ivrId`

Update IVR details.

**Request Body:**
```json
{
  "ivrNumber": "1800-1234-5678",
  "name": "Updated IVR Name",
  "area": "rural",
  "description": "Updated description",
  "status": "active"
}
```

**Note:** All fields are optional. Only include fields you want to update.

**Response:**
```json
{
  "success": true,
  "message": "IVR updated successfully",
  "data": {
    "ivr": {...}
  }
}
```

---

### 5. Delete IVR
**DELETE** `/ivr/:ivrId`

Delete an IVR.

**Response:**
```json
{
  "success": true,
  "message": "IVR deleted successfully",
  "data": {
    "ivr": {...}
  }
}
```

---

### 6. Assign IVR to Company
**POST** `/ivr/:ivrId/assign`

Assign an IVR to a company (user with ADMIN role).

**Request Body:**
```json
{
  "companyId": "507f1f77bcf86cd799439011"
}
```

**Response:**
```json
{
  "success": true,
  "message": "IVR assigned to company successfully",
  "data": {
    "ivr": {
      "_id": "...",
      "isAssigned": true,
      "assignedToCompany": "507f1f77bcf86cd799439011",
      "status": "assigned",
      ...
    }
  }
}
```

**Validation:**
- IVR must not be already assigned
- Company must exist
- Company user must have ADMIN role

---

### 7. Unassign IVR from Company
**POST** `/ivr/:ivrId/unassign`

Unassign an IVR from its current company.

**Response:**
```json
{
  "success": true,
  "message": "IVR unassigned from company successfully",
  "data": {
    "ivr": {
      "_id": "...",
      "isAssigned": false,
      "assignedToCompany": null,
      "status": "unassigned",
      ...
    }
  }
}
```

---

### 8. Get IVRs by Company
**GET** `/ivr/company/:companyId`

Get all IVRs assigned to a specific company.

**Response:**
```json
{
  "success": true,
  "message": "IVRs fetched successfully",
  "data": {
    "ivrs": [...],
    "count": 5
  }
}
```

---

### 9. Get Assigned IVRs
**GET** `/ivr/status/assigned`

Get all assigned IVRs with company information.

**Response:**
```json
{
  "success": true,
  "message": "Assigned IVRs fetched successfully",
  "data": {
    "ivrs": [...],
    "count": 7
  }
}
```

---

### 10. Get Unassigned IVRs
**GET** `/ivr/status/unassigned`

Get all unassigned IVRs.

**Response:**
```json
{
  "success": true,
  "message": "Unassigned IVRs fetched successfully",
  "data": {
    "ivrs": [...],
    "count": 3
  }
}
```

---

### 11. Get IVRs by Area
**GET** `/ivr/area/:area`

Get IVRs filtered by area (rural or urban).

**Parameters:**
- `area`: "rural" or "urban"

**Example:**
- `/ivr/area/urban`
- `/ivr/area/rural`

**Response:**
```json
{
  "success": true,
  "message": "IVRs fetched successfully",
  "data": {
    "ivrs": [...],
    "count": 10
  }
}
```

---

### 12. Toggle IVR Status
**PATCH** `/ivr/:ivrId/status`

Update IVR status.

**Request Body:**
```json
{
  "status": "active"
}
```

**Valid Status Values:**
- "active"
- "inactive"
- "assigned"
- "unassigned"

**Response:**
```json
{
  "success": true,
  "message": "IVR status updated successfully",
  "data": {
    "ivr": {...}
  }
}
```

---

### 13. Check Customer Details (Public)
**POST** `/ivr/check-customer`

Check customer details by mobile number. This endpoint is designed for IVR systems to verify customer information.

**Authentication:** Not required (Public endpoint)

**Request Body:**
```json
{
  "mobile": "829433530"
}
```

**Mobile Number Formats Supported:**
- `829433530` (10 digits)
- `+91829433530` (with country code)
- `+91-8294335230` (with country code and dash)

**Response (User Found):**
```json
{
  "success": true,
  "message": "User details fetched successfully",
  "data": {
    "success": true,
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phoneNumber": "829433530",
      "mobile": "829433530",
      "countryCode": "+91",
      "userName": "johndoe",
      "permanentAddress": "123 Main St",
      "residentialAddress": "123 Main St",
      "billingAddress": "123 Main St",
      "landlineNumber": "02212345678",
      "bbUserId": "BB12345",
      "bbPlan": "100 Mbps",
      "status": "active"
    }
  }
}
```

**Response (User Not Found):**
```json
{
  "success": false,
  "message": "User not found with this mobile number",
  "error": null
}
```

**Status Codes:**
- `200` - Success (user found)
- `400` - Bad Request (missing or invalid mobile number)
- `404` - Not Found (user not found)

**Example Usage:**
```javascript
// Check customer by mobile number
POST /ivr/check-customer
{
  "mobile": "+91-8294335230"
}
```

---

### 14. Add Complaint by IVR (Public)
**POST** `/ivr/add-complaint`

Create a complaint via IVR system. This endpoint allows IVR systems to automatically create complaints for customers.

**Authentication:** Not required (Public endpoint)

**Request Body:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "complaintId": "2"
}
```

**Request Parameters:**
- `id` (required): User ID (ObjectId format)
- `complaintId` (required): Issue Type ID (dt field value from IssueType collection, e.g., "1", "2", "3", "4", "5", "6")

**Available Issue Types (complaintId values):**
- `"1"` - [Issue Type 1 - To be added]
- `"2"` - Internet is not working
- `"3"` - Slow Internet Speed
- `"4"` - Landline service not working
- `"5"` - Change your wifi password
- `"6"` - Other Assistance

**Issue Type Details:**

| complaintId | Name | Description | Type |
|------------|------|-------------|------|
| `"1"` | [Red Light] | [Description to be added] | WIFI |
| `"2"` | Internet is not working | Report any issue or concern that doesn't fall under the predefined categories | WIFI |
| `"3"` | Slow Internet Speed | Report any issue or concern that doesn't fall under the predefined categories | WIFI |
| `"4"` | Landline service not working | Report any issue or concern that doesn't fall under the predefined categories | WIFI |
| `"5"` | Change your wifi password | Report any issue or concern that doesn't fall under the predefined categories | WIFI |
| `"6"` | Other Assistance | Report any issue or concern that doesn't fall under the predefined categories | WIFI |

**Complete Issue Type Schema:**

```json
{
  "_id": "[To be added]",
  "name": "[To be added]",
  "description": "[To be added]",
  "type": "WIFI",
  "dt": "1",
  "createdAt": "[To be added]",
  "updatedAt": "[To be added]",
  "__v": 0
}
```

```json
{
  "_id": "690bab61d19f9b7ed43b43d9",
  "name": "Internet is not working",
  "description": "Report any issue or concern that doesn't fall under the predefined categories",
  "type": "WIFI",
  "dt": "2",
  "createdAt": "2025-11-05T19:54:09.482+00:00",
  "updatedAt": "2025-11-05T19:54:09.482+00:00",
  "__v": 0
}
```

```json
{
  "_id": "690bac0cd19f9b7ed43b43dc",
  "name": "Slow Internet Speed",
  "description": "Report any issue or concern that doesn't fall under the predefined categories",
  "type": "WIFI",
  "dt": "3",
  "createdAt": "2025-11-05T19:57:00.261+00:00",
  "updatedAt": "2025-11-05T19:57:00.261+00:00",
  "__v": 0
}
```

```json
{
  "_id": "690bac3bd19f9b7ed43b43df",
  "name": "Landline service not working",
  "description": "Report any issue or concern that doesn't fall under the predefined categories",
  "type": "WIFI",
  "dt": "4",
  "createdAt": "2025-11-05T19:57:47.745+00:00",
  "updatedAt": "2025-11-05T19:57:47.745+00:00",
  "__v": 0
}
```

```json
{
  "_id": "690bac7bd19f9b7ed43b43e2",
  "name": "Change your wifi password",
  "description": "Report any issue or concern that doesn't fall under the predefined categories",
  "type": "WIFI",
  "dt": "5",
  "createdAt": "2025-11-05T19:58:51.404+00:00",
  "updatedAt": "2025-11-05T19:58:51.404+00:00",
  "__v": 0
}
```

```json
{
  "_id": "690bac96d19f9b7ed43b43e5",
  "name": "Other Assistance",
  "description": "Report any issue or concern that doesn't fall under the predefined categories",
  "type": "WIFI",
  "dt": "6",
  "createdAt": "2025-11-05T19:59:18.829+00:00",
  "updatedAt": "2025-11-05T19:59:18.829+00:00",
  "__v": 0
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Complaint created successfully via IVR",
  "data": {
    "complaint": {
      "_id": "507f1f77bcf86cd799439012",
      "id": "WIFI-00001",
      "complaintId": "2",
      "user": "507f1f77bcf86cd799439011",
      "title": "Internet is not working",
      "issueDescription": "Report any issue or concern that doesn't fall under the predefined categories",
      "issueType": "507f1f77bcf86cd799439013",
      "phoneNumber": "829433530",
      "complaintType": "WIFI",
      "type": "WIFI",
      "status": "pending",
      "statusColor": "#FFA500",
      "priority": "medium",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

**Response (Error - User Not Found):**
```json
{
  "success": false,
  "message": "User not found",
  "error": null
}
```

**Response (Error - Issue Type Not Found):**
```json
{
  "success": false,
  "message": "Issue type not found with the provided complaint ID",
  "error": null
}
```

**Status Codes:**
- `201` - Created (complaint created successfully)
- `400` - Bad Request (missing or invalid parameters)
- `404` - Not Found (user or issue type not found)
- `500` - Internal Server Error

**Validation Rules:**
- User ID must be a valid ObjectId format
- Complaint ID must exist in IssueType collection (dt field)
- User must exist in the system

**Example Usage:**
```javascript
// Create complaint for user
POST /ivr/add-complaint
{
  "id": "507f1f77bcf86cd799439011",
  "complaintId": "2"
}
```

**Note:** The complaint is automatically created with:
- Title: Issue Type name (e.g., "Internet is not working")
- Description: Issue Type description
- Type: Issue Type type (WIFI or CCTV)
- Status: "pending"
- Priority: "medium" (default)
- Phone Number: Retrieved from user profile

---

## IVR Model Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ivrNumber | String | Yes | Unique IVR number |
| name | String | Yes | Name/label for the IVR |
| area | Enum | Yes | "rural" or "urban" |
| isAssigned | Boolean | No | Whether IVR is assigned (default: false) |
| assignedToCompany | ObjectId | Conditional | Reference to User (company) - required if isAssigned is true |
| associatedCompany | ObjectId | No | Reference to parent company/admin |
| status | Enum | No | Status: "active", "inactive", "assigned", "unassigned" (default: "inactive") |
| description | String | No | Optional description |
| addedBy | ObjectId | No | Reference to User who added this IVR |
| createdAt | Date | Auto | Creation timestamp |
| updatedAt | Date | Auto | Update timestamp |

---

## User Model Integration

Users with role "ADMIN" can have an optional `ivrNumber` field that references the IVR model.

**User Schema Addition:**
```typescript
ivrNumber?: mongoose.Types.ObjectId; // Reference to IVR model
```

---

## Error Responses

All endpoints return error responses in this format:

```json
{
  "success": false,
  "message": "Error message",
  "error": {...}
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

---

## Usage Examples

### 1. Create and Assign IVR
```javascript
// Step 1: Create IVR
POST /ivr/add
{
  "ivrNumber": "1800-1234-5678",
  "name": "Support Line",
  "area": "urban"
}

// Step 2: Assign to Company
POST /ivr/{ivrId}/assign
{
  "companyId": "507f1f77bcf86cd799439011"
}
```

### 2. Get All Unassigned Urban IVRs
```javascript
GET /ivr/all?isAssigned=false&area=urban
```

### 3. Get IVRs for a Specific Company
```javascript
GET /ivr/company/507f1f77bcf86cd799439011
```

---

## Public Endpoints (No Authentication Required)

The following endpoints are designed for IVR system integration and do not require authentication:

1. **Check Customer Details** - `/ivr/check-customer`
   - Verify customer information by mobile number
   - Returns customer details if found

2. **Add Complaint by IVR** - `/ivr/add-complaint`
   - Create complaints automatically via IVR system
   - Requires valid user ID and complaint type ID

---

## Notes

1. **Unique IVR Numbers**: Each IVR number must be unique across the system
2. **Company Assignment**: Only users with ADMIN role can be assigned IVRs
3. **Area Types**: Currently supports "rural" and "urban" areas
4. **Status Management**: IVR status automatically updates when assigned/unassigned
5. **Authentication**: Most endpoints require valid authentication token (except public IVR endpoints)
6. **Public Endpoints**: IVR integration endpoints (`/check-customer` and `/add-complaint`) are public and don't require authentication for seamless IVR system integration
7. **Phone Number Format**: Mobile numbers are automatically normalized (removes non-digit characters, extracts last 10 digits if country code is present)
8. **Complaint Creation**: Complaints created via IVR automatically use issue type details (name, description, type) from the IssueType collection


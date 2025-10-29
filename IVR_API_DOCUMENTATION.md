# IVR API Documentation

## Overview
Complete API endpoints for managing IVR (Interactive Voice Response) numbers and their association with companies.

## Base URL
All IVR endpoints are prefixed with `/ivr`

## Authentication
All endpoints require authentication. Use the `authenticate` middleware.

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

## Notes

1. **Unique IVR Numbers**: Each IVR number must be unique across the system
2. **Company Assignment**: Only users with ADMIN role can be assigned IVRs
3. **Area Types**: Currently supports "rural" and "urban" areas
4. **Status Management**: IVR status automatically updates when assigned/unassigned
5. **Authentication**: All endpoints require valid authentication token


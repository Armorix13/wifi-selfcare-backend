# Topology System Documentation

## Overview
This system implements **EXACT** topology rules for fiber optic network planning, including splitter losses, PON capacity limits, and the tube system topology as specified by the user.

## Core Rules Implementation

### 1. Splitter Losses (EXACT VALUES)
```
1:2  → -3 dB
1:4  → -7 dB
1:8  → -10 dB
1:16 → -13 dB
1:32 → -17 dB
1:64 → -20 dB
```

### 2. OLT PON Port Capacity
```
EPON  → 64 ONUs
GPON  → 128 ONUs
XGPON → 128 ONUs
XGSPON → 128 ONUs
```

### 3. Topology Decision Rules
```
If < 12 subscribers → DIRECT (no splitter chain, direct client attach)
If ≥ 12 subscribers → start from 1×16 primary then use tube system (4-4)
```

### 4. Power Loss Hard Limit
```
If total passive loss == 20 dB → STOP
- No MS, sub-MS, ×2, FDB, or any further passive stage
- Clients must be connected directly

If total passive loss < 20 dB → 
- May attach clients directly
- Further splitters can be considered only while keeping total ≤ 20 dB
```

## Tube System Implementation

### Standard Tube System Pattern
```
1×16 → four 1×4 secondaries
Total Loss: 13 dB + 7 dB = 20 dB (EXACT LIMIT)
```

**After this secondary split:**
- ✅ Clients should be connected directly
- ❌ No more passive devices allowed
- ❌ No MS, SUBMS, X2, or FDB additions

## API Endpoints

### 1. Plan Topology
**Endpoint:** `POST /api/topology/plan`

**Request Body:**
```json
{
  "subscriberCount": 24,
  "oltType": "gpon"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "topology": {
      "type": "tube_system",
      "totalLoss": 20,
      "stages": [
        {
          "stage": 1,
          "deviceType": "ms",
          "splitterType": "1x16",
          "loss": -13,
          "cumulativeLoss": -13,
          "outputPorts": 16,
          "canAddMore": true
        },
        {
          "stage": 2,
          "deviceType": "subms",
          "splitterType": "1x4",
          "loss": -7,
          "cumulativeLoss": -20,
          "outputPorts": 4,
          "canAddMore": false
        }
      ],
      "maxSubscribers": 64,
      "isValid": true,
      "message": "Tube system topology: 1×16 → 4×1×4 (total loss: -20 dB). No further passive elements allowed."
    },
    "validation": {
      "isValid": true,
      "errors": []
    },
    "recommendations": [
      "Use TUBE SYSTEM topology: 1×16 → 4×1×4",
      "Total loss will be 20 dB (13 + 7)",
      "No further passive elements allowed after 20 dB",
      "Maximum 64 subscribers supported"
    ],
    "rules": {
      "SPLITTER_LOSSES": {
        "1x2": -3,
        "1x4": -7,
        "1x8": -10,
        "1x16": -13,
        "1x32": -17,
        "1x64": -20
      },
      "PON_CAPACITY": {
        "epon": 64,
        "gpon": 128
      },
      "SUBSCRIBER_THRESHOLD": 12,
      "MAX_PASSIVE_LOSS": 20
    }
  }
}
```

### 2. Get Topology Rules
**Endpoint:** `GET /api/topology/rules`

**Response:**
```json
{
  "success": true,
  "data": {
    "rules": {
      "SPLITTER_LOSSES": {
        "1x2": -3,
        "1x4": -7,
        "1x8": -10,
        "1x16": -13,
        "1x32": -17,
        "1x64": -20
      },
      "PON_CAPACITY": {
        "epon": 64,
        "gpon": 128,
        "xgpon": 128,
        "xgspon": 128
      },
      "SUBSCRIBER_THRESHOLD": 12,
      "MAX_PASSIVE_LOSS": 20,
      "TUBE_SYSTEM": {
        "PRIMARY": "1x16",
        "SECONDARY": "1x4",
        "SECONDARY_COUNT": 4
      }
    },
    "description": "Exact topology rules for splitter losses, PON capacity, and tube system"
  }
}
```

### 3. Validate Existing Topology
**Endpoint:** `GET /api/topology/validate/:oltId`

**Response:**
```json
{
  "success": true,
  "data": {
    "olt": { /* OLT details */ },
    "topologyAnalysis": {
      "totalLoss": -20,
      "stages": [
        {
          "stage": 1,
          "deviceType": "ms",
          "deviceId": "ms_id",
          "splitterType": "1x16",
          "loss": -13,
          "cumulativeLoss": -13
        },
        {
          "stage": 2,
          "deviceType": "subms",
          "deviceId": "subms_id",
          "splitterType": "1x4",
          "loss": -7,
          "cumulativeLoss": -20
        }
      ],
      "compliance": {
        "isValid": true,
        "errors": [],
        "warnings": [
          "Total loss is at maximum limit (20 dB). No further passive elements can be added."
        ]
      },
      "recommendations": [
        "Cannot add more passive elements. Loss limit reached.",
        "Tube system topology detected - compliant with rules"
      ]
    }
  }
}
```

### 4. Get Topology Examples
**Endpoint:** `GET /api/topology/examples`

**Response:**
```json
{
  "success": true,
  "data": {
    "examples": [
      {
        "scenario": "Small Network (< 12 subscribers)",
        "subscriberCount": 8,
        "oltType": "gpon",
        "topology": {
          "type": "direct",
          "totalLoss": 0,
          "message": "Direct topology for 8 subscribers. No passive elements needed."
        },
        "description": "Direct connection - no passive elements needed"
      },
      {
        "scenario": "Medium Network (12-64 subscribers)",
        "subscriberCount": 24,
        "oltType": "gpon",
        "topology": {
          "type": "tube_system",
          "totalLoss": -20,
          "message": "Tube system topology: 1×16 → 4×1×4 (total loss: -20 dB). No further passive elements allowed."
        },
        "description": "Tube system: 1×16 → 4×1×4 (total loss: 20 dB)"
      }
    ]
  }
}
```

## Topology Decision Flow

### Quick Decision Flow (One-liner)
```
Count subscribers.
If < 12 → Direct.
Else → use 1×16 primary → 4×1×4 secondaries (tube 4-4).
Always keep total splitter loss ≤ 20 dB.
If total loss = 20 dB → stop adding passive elements; attach clients directly.
```

### Detailed Decision Tree
```
1. Check subscriber count
   ├─ < 12 → DIRECT topology (no passive elements)
   └─ ≥ 12 → TUBE SYSTEM topology

2. TUBE SYSTEM implementation
   ├─ Stage 1: 1×16 MS (loss: -13 dB)
   └─ Stage 2: 4×1×4 SUBMS (loss: -7 dB each)
      Total: -13 + (-7) = -20 dB

3. After 20 dB limit
   ├─ ❌ No more MS, SUBMS, X2, FDB
   ├─ ❌ No further passive stages
   └─ ✅ Connect clients directly
```

## Examples with Exact Calculations

### Example 1: 10 Users
```
Subscriber Count: 10
Decision: < 12 → DIRECT
Topology: OLT → Direct Client Connection
Total Loss: 0 dB
Passive Elements: None
```

### Example 2: 24 Users
```
Subscriber Count: 24
Decision: ≥ 12 → TUBE SYSTEM
Topology: OLT → 1×16 MS → 4×1×4 SUBMS
Calculations:
- Stage 1: 1×16 MS = -13 dB
- Stage 2: 1×4 SUBMS = -7 dB
- Total Loss: -13 + (-7) = -20 dB
Result: 16 × 4 = 64 ports available
Status: At 20 dB limit, no more passive elements allowed
```

### Example 3: 64 Users (EPON Limit)
```
Subscriber Count: 64
Decision: ≥ 12 → TUBE SYSTEM
Topology: Same as 24 users (1×16 → 4×1×4)
Total Loss: -20 dB
Capacity: 64 subscribers (fills tube system)
Note: Cannot exceed EPON 64 ONU limit
```

### Example 4: 128 Users (GPON)
```
Subscriber Count: 128
Decision: ≥ 12 → TUBE SYSTEM
Topology: Multiple tube systems needed
Option 1: Use multiple OLT ports
Option 2: Use multiple identical PON trees
Note: Must respect 20 dB loss limit per tree
```

## Validation Rules

### Topology Compliance Checks
1. **Total Loss Limit**: Must not exceed 20 dB
2. **Tube System Pattern**: Must follow 1×16 → 4×1×4 exactly
3. **Stage Count**: Tube system must have exactly 2 stages
4. **Splitter Types**: Primary must be 1×16, secondary must be 1×4
5. **Capacity Limits**: Must not exceed PON technology limits

### Error Conditions
- ❌ Total loss > 20 dB
- ❌ Incorrect tube system pattern
- ❌ Subscriber count exceeds PON capacity
- ❌ Adding passive elements after 20 dB limit

### Warning Conditions
- ⚠️ Total loss = 20 dB (limit reached)
- ⚠️ Non-standard topology pattern
- ⚠️ Approaching capacity limits

## Implementation Notes

### Key Features
1. **Exact Loss Values**: All splitter losses are hardcoded to exact specifications
2. **Automatic Validation**: System automatically validates against all rules
3. **Real-time Analysis**: Can analyze existing topologies for compliance
4. **Recommendations**: Provides actionable recommendations for network planning
5. **Examples**: Pre-built examples for common scenarios

### Business Logic
- **Direct Topology**: For small networks (< 12 subscribers)
- **Tube System**: For medium to large networks (≥ 12 subscribers)
- **Loss Management**: Automatic calculation and validation of cumulative losses
- **Capacity Planning**: Respects PON technology limits
- **Compliance Checking**: Ensures network designs follow industry standards

### Technical Implementation
- **Service Layer**: `TopologyService` class handles all calculations
- **Rule Constants**: All rules are defined as constants for easy maintenance
- **Validation Engine**: Comprehensive validation against all specified rules
- **Error Handling**: Detailed error messages and recommendations
- **Type Safety**: Full TypeScript interfaces for all data structures

## Usage in Frontend

### Planning New Networks
```javascript
const planNetwork = async (subscriberCount, oltType) => {
  const response = await fetch('/api/topology/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriberCount, oltType })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Topology:', result.data.topology);
    console.log('Recommendations:', result.data.recommendations);
  }
};
```

### Validating Existing Networks
```javascript
const validateNetwork = async (oltId) => {
  const response = await fetch(`/api/topology/validate/${oltId}`);
  const result = await response.json();
  
  if (result.success) {
    const analysis = result.data.topologyAnalysis;
    console.log('Total Loss:', analysis.totalLoss);
    console.log('Compliance:', analysis.compliance.isValid);
    console.log('Recommendations:', analysis.recommendations);
  }
};
```

This system ensures that all network topologies strictly follow the exact rules you specified, preventing design errors and ensuring optimal network performance within the 20 dB loss limit.

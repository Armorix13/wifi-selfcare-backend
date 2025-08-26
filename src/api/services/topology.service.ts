import { OLTModel } from '../models/olt.model';
import { MSModel } from '../models/ms.model';
import { SUBMSModel } from '../models/subms.model';
import { FDBModel } from '../models/fdb.model';
import { X2Model } from '../models/x2.model';

// Topology Constants - EXACT RULES
export const TOPOLOGY_RULES = {
  // Splitter Losses (dB)
  SPLITTER_LOSSES: {
    '1x2': -3,
    '1x4': -7,
    '1x8': -10,
    '1x16': -13,
    '1x32': -17,
    '1x64': -20
  } as any,

  // OLT PON Port Capacity
  PON_CAPACITY: {
    'epon': 64,
    'gpon': 128,
    'xgpon': 128,
    'xgspon': 128
  } as any,

  // Topology Decision Thresholds
  SUBSCRIBER_THRESHOLD: 12,
  MAX_PASSIVE_LOSS: 20, // dB

  // Tube System Configuration
  TUBE_SYSTEM: {
    PRIMARY: '1x16',    // Start with 1x16
    SECONDARY: '1x4',   // Use 1x4 for secondary
    SECONDARY_COUNT: 4  // Four 1x4 secondaries
  }
};

// Topology Types
export enum TopologyType {
  DIRECT = 'direct',
  TUBE_SYSTEM = 'tube_system',
  CUSTOM = 'custom'
}

// Topology Result Interface
export interface ITopologyResult {
  type: TopologyType;
  totalLoss: number;
  stages: ITopologyStage[];
  maxSubscribers: number;
  isValid: boolean;
  message: string;
}

// Topology Stage Interface
export interface ITopologyStage {
  stage: number;
  deviceType: 'olt' | 'ms' | 'subms' | 'fdb' | 'x2';
  splitterType: string;
  loss: number;
  cumulativeLoss: number;
  outputPorts: number;
  canAddMore: boolean;
}

// ==================== TOPOLOGY PLANNING FUNCTIONS ====================

/**
 * Calculate topology based on subscriber count and OLT type
 * Implements EXACT rules specified by user
 */
export const calculateTopology = (subscriberCount: number, oltType: string): ITopologyResult => {
  const oltTypeLower = oltType.toLowerCase();

  // Check PON capacity limits
  const maxCapacity = TOPOLOGY_RULES.PON_CAPACITY[oltTypeLower as keyof typeof TOPOLOGY_RULES.PON_CAPACITY] || 128;

  if (subscriberCount > maxCapacity) {
    return {
      type: TopologyType.CUSTOM,
      totalLoss: 0,
      stages: [],
      maxSubscribers: maxCapacity,
      isValid: false,
      message: `Subscriber count ${subscriberCount} exceeds ${oltType.toUpperCase()} capacity limit of ${maxCapacity}`
    };
  }

  // Rule 1: If < 12 → DIRECT (no splitter chain, direct client attach)
  if (subscriberCount < TOPOLOGY_RULES.SUBSCRIBER_THRESHOLD) {
    return createDirectTopology(subscriberCount);
  }

  // Rule 2: If ≥ 12 → start from 1×16 primary then use tube system (4-4)
  if (subscriberCount >= TOPOLOGY_RULES.SUBSCRIBER_THRESHOLD) {
    return createTubeSystemTopology(subscriberCount);
  }

  return {
    type: TopologyType.CUSTOM,
    totalLoss: 0,
    stages: [],
    maxSubscribers: subscriberCount,
    isValid: false,
    message: 'Invalid topology configuration'
  };
};

/**
 * Create DIRECT topology for < 12 subscribers
 * No passive elements, direct client connection
 */
const createDirectTopology = (subscriberCount: number): ITopologyResult => {
  return {
    type: TopologyType.DIRECT,
    totalLoss: 0,
    stages: [
      {
        stage: 1,
        deviceType: 'olt',
        splitterType: 'direct',
        loss: 0,
        cumulativeLoss: 0,
        outputPorts: subscriberCount,
        canAddMore: false
      }
    ],
    maxSubscribers: subscriberCount,
    isValid: true,
    message: `Direct topology for ${subscriberCount} subscribers. No passive elements needed.`
  };
};

/**
 * Create TUBE SYSTEM topology for ≥ 12 subscribers
 * 1×16 primary → four 1×4 secondaries (total loss: 13 + 7 = 20 dB)
 */
const createTubeSystemTopology = (subscriberCount: number): ITopologyResult => {
  const primaryLoss = TOPOLOGY_RULES.SPLITTER_LOSSES[TOPOLOGY_RULES.TUBE_SYSTEM.PRIMARY];
  const secondaryLoss = TOPOLOGY_RULES.SPLITTER_LOSSES[TOPOLOGY_RULES.TUBE_SYSTEM.SECONDARY];
  const totalLoss = primaryLoss + secondaryLoss; // 13 + 7 = 20 dB

  // Rule: If total passive loss == 20 dB → stop. No further passive stages.
  const stages: ITopologyStage[] = [
    {
      stage: 1,
      deviceType: 'ms',
      splitterType: TOPOLOGY_RULES.TUBE_SYSTEM.PRIMARY,
      loss: primaryLoss,
      cumulativeLoss: primaryLoss,
      outputPorts: 16,
      canAddMore: true
    },
    {
      stage: 2,
      deviceType: 'subms',
      splitterType: TOPOLOGY_RULES.TUBE_SYSTEM.SECONDARY,
      loss: secondaryLoss,
      cumulativeLoss: totalLoss,
      outputPorts: 4,
      canAddMore: false // Cannot add more after 20 dB
    }
  ];

  return {
    type: TopologyType.TUBE_SYSTEM,
    totalLoss,
    stages,
    maxSubscribers: 64, // 16 × 4 = 64 subscribers
    isValid: true,
    message: `Tube system topology: 1×16 → 4×1×4 (total loss: ${totalLoss} dB). No further passive elements allowed.`
  };
};

/**
 * Validate if additional passive elements can be added
 * Rule: If total passive loss == 20 dB → stop
 */
export const canAddPassiveElement = (currentLoss: number, newElementLoss: number): boolean => {
  const totalLoss = currentLoss + newElementLoss;
  return totalLoss <= TOPOLOGY_RULES.MAX_PASSIVE_LOSS;
};

/**
 * Get splitter loss for a specific splitter type
 */
export const getSplitterLoss = (splitterType: string): number => {
  return TOPOLOGY_RULES.SPLITTER_LOSSES[splitterType as keyof typeof TOPOLOGY_RULES.SPLITTER_LOSSES] || 0;
};

/**
 * Calculate cumulative loss for a topology
 */
export const calculateCumulativeLoss = (stages: ITopologyStage[]): number => {
  return stages.reduce((total, stage) => total + stage.loss, 0);
};

/**
 * Get maximum subscribers for a topology
 */
export const getMaxSubscribers = (stages: ITopologyStage[]): number => {
  if (stages.length === 0) return 0;

  let maxSubscribers = 1;
  stages.forEach(stage => {
    if (stage.splitterType !== 'direct') {
      const outputPorts = parseInt(stage.splitterType.split('x')[1]);
      maxSubscribers *= outputPorts;
    }
  });

  return maxSubscribers;
};

/**
 * Validate topology against all rules
 */
export const validateTopology = (topology: ITopologyResult): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check total loss limit
  if (topology.totalLoss > TOPOLOGY_RULES.MAX_PASSIVE_LOSS) {
    errors.push(`Total loss ${topology.totalLoss} dB exceeds maximum allowed ${TOPOLOGY_RULES.MAX_PASSIVE_LOSS} dB`);
  }

  // Check if topology can support subscriber count
  if (topology.maxSubscribers < topology.stages[0]?.outputPorts || 0) {
    errors.push(`Topology cannot support required subscriber count`);
  }

  // Check for rule violations
  if (topology.type === TopologyType.TUBE_SYSTEM) {
    if (topology.stages.length !== 2) {
      errors.push('Tube system must have exactly 2 stages: 1×16 → 4×1×4');
    }

    if (topology.stages[0]?.splitterType !== '1x16') {
      errors.push('Tube system must start with 1×16 primary splitter');
    }

    if (topology.stages[1]?.splitterType !== '1x4') {
      errors.push('Tube system secondary must be 1×4 splitter');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generate topology recommendations
 */
export const generateRecommendations = (subscriberCount: number, oltType: string): string[] => {
  const recommendations: string[] = [];

  if (subscriberCount < TOPOLOGY_RULES.SUBSCRIBER_THRESHOLD) {
    recommendations.push('Use DIRECT topology - no passive elements needed');
    recommendations.push('Connect clients directly to OLT port');
  } else {
    recommendations.push('Use TUBE SYSTEM topology: 1×16 → 4×1×4');
    recommendations.push('Total loss will be 20 dB (13 + 7)');
    recommendations.push('No further passive elements allowed after 20 dB');
    recommendations.push('Maximum 64 subscribers supported');
  }

  const maxCapacity = TOPOLOGY_RULES.PON_CAPACITY[oltType.toLowerCase() as keyof typeof TOPOLOGY_RULES.PON_CAPACITY] || 128;
  if (subscriberCount > maxCapacity) {
    recommendations.push(`Consider using multiple OLT ports or ${oltType.toUpperCase()} for ${subscriberCount} subscribers`);
  }

  return recommendations;
};

/**
 * Create topology diagram data
 */
export const createTopologyDiagram = (topology: ITopologyResult): any => {
  const diagram = {
    type: topology.type,
    totalLoss: topology.totalLoss,
    stages: topology.stages.map(stage => ({
      ...stage,
      deviceName: getDeviceName(stage.deviceType, stage.stage),
      connections: getConnections(stage)
    }))
  };

  return diagram;
};

/**
 * Get device name for topology diagram
 */
const getDeviceName = (deviceType: string, stage: number): string => {
  const prefixes = {
    'olt': 'OLT',
    'ms': 'MS',
    'subms': 'SUBMS',
    'fdb': 'FDB',
    'x2': 'X2'
  };

  return `${prefixes[deviceType as keyof typeof prefixes] || 'DEV'}_${stage}`;
};

/**
 * Get connections for a stage
 */
const getConnections = (stage: ITopologyStage): any[] => {
  if (stage.deviceType === 'olt') {
    return [{ type: 'client', count: stage.outputPorts }];
  }

  return [{ type: 'next_stage', count: stage.outputPorts }];
};

// Export all functions for use in other modules
export default {
  calculateTopology,
  canAddPassiveElement,
  getSplitterLoss,
  calculateCumulativeLoss,
  getMaxSubscribers,
  validateTopology,
  generateRecommendations,
  createTopologyDiagram,
  TOPOLOGY_RULES
};

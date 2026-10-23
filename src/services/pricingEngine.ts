import {
  ComplexityModifier,
  ComplexityTier,
  PartItem,
  PartsSourcingMode,
  ServiceCatalogItem,
  VehicleFlags,
} from '../types/domain';

export interface QuoteCalculationInput {
  selectedServices: ServiceCatalogItem[];
  selectedModifiers: ComplexityModifier[];
  applyComboDiscount: boolean;
  comboDiscountAmountGbp?: number;
  applyDiagnosticRepairDiscount: boolean;
  partsSourcingMode?: PartsSourcingMode;
  parts?: PartItem[];
  dropOffSlot?: string; // e.g., "09:30"
}

export interface QuoteCalculationResult {
  baseServicesGbp: number;
  modifiersTotalGbp: number;
  comboDiscountGbp: number;
  diagnosticDiscountGbp: number;
  labourTotalGbp: number;
  partsCostTotalGbp: number;
  partsClientTotalGbp: number;
  partsProfitGbp: number;
  grossTotalGbp: number;
  netProfitGbp: number;
  totalEstimatedMinutes: number; // Real mechanic bay time
  customerPromisedMinutes: number; // Safe turnaround time promised to customer (includes rust/coffee/cooling buffer)
  dropOffSlot: string;
  promisedReadyTime: string; // e.g., "10:45"
  overallComplexity: ComplexityTier;
  projectedHourlyRateGbp: number;
  isComboEligible: boolean;
  isDiagnosticRepairEligible: boolean;
}

/**
 * Adds minutes to an "HH:MM" 24-hour slot and rounds up to the nearest 5-minute mark
 */
export function calculatePromisedReadyTime(dropOffSlot: string, promisedMinutes: number): string {
  const parts = dropOffSlot.split(':').map((n) => parseInt(n, 10));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return '10:30';
  }
  const roundedBufferMins = Math.ceil(promisedMinutes / 5) * 5;
  const totalMinutesFromMidnight = parts[0] * 60 + parts[1] + roundedBufferMins;
  const finalHours = Math.floor(totalMinutesFromMidnight / 60) % 24;
  const finalMins = totalMinutesFromMidnight % 60;
  return `${finalHours.toString().padStart(2, '0')}:${finalMins.toString().padStart(2, '0')}`;
}

const COMPLEXITY_RANK: Record<ComplexityTier, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
  EXTREME: 4,
};

/**
 * Pure deterministic pricing & scheduling engine ("Calculadora Anti-Trouxa — 100% Mão de Obra")
 */
export function calculateSmartQuote(input: QuoteCalculationInput): QuoteCalculationResult {
  const baseServicesGbp = input.selectedServices.reduce((sum, s) => sum + s.basePriceGbp, 0);
  const modifiersTotalGbp = input.selectedModifiers.reduce((sum, m) => sum + m.surchargeGbp, 0);

  const isComboEligible = input.selectedServices.length >= 2;
  const comboDiscountGbp =
    isComboEligible && input.applyComboDiscount ? (input.comboDiscountAmountGbp ?? 5) : 0;

  // Rule: £10 discount if Launch CRP919X Diagnostic is selected alongside at least 1 repair/service
  const hasDiagnostic = input.selectedServices.some((s) => s.code === 'LAUNCH_DIAGNOSTIC');
  const hasOtherService = input.selectedServices.some((s) => s.code !== 'LAUNCH_DIAGNOSTIC');
  const isDiagnosticRepairEligible = hasDiagnostic && hasOtherService;
  const diagnosticDiscountGbp =
    isDiagnosticRepairEligible && input.applyDiagnosticRepairDiscount ? 10 : 0;

  const labourTotalGbp = Math.max(
    0,
    baseServicesGbp + modifiersTotalGbp - comboDiscountGbp - diagnosticDiscountGbp
  );

  const baseMinutes = input.selectedServices.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const modifierMinutes = input.selectedModifiers.reduce((sum, m) => sum + m.extraMinutes, 0);
  const totalEstimatedMinutes = Math.max(15, baseMinutes + modifierMinutes);

  // Customer Buffer Calculation: ensures the mechanic never promises a tight time and gets stressed
  const serviceBuffers = input.selectedServices.reduce(
    (sum, s) => sum + (s.customerBufferMinutes ?? 15),
    0
  );
  const modifierBuffers = input.selectedModifiers.length * 10;
  const customerPromisedMinutes = Math.ceil((totalEstimatedMinutes + serviceBuffers + modifierBuffers) / 15) * 15;

  const dropOffSlot = input.dropOffSlot || '09:30';
  const promisedReadyTime = calculatePromisedReadyTime(dropOffSlot, customerPromisedMinutes);

  // Determine overall Complexity Tier
  let maxRank = 1;
  for (const s of input.selectedServices) {
    const rank = COMPLEXITY_RANK[s.complexityTier || 'EASY'];
    if (rank > maxRank) maxRank = rank;
  }
  if (input.selectedModifiers.some((m) => m.code === 'SCOTTISH_RUST')) {
    maxRank = Math.max(maxRank, 3);
  }
  const overallComplexity: ComplexityTier =
    maxRank >= 4 ? 'EXTREME' : maxRank === 3 ? 'HARD' : maxRank === 2 ? 'MEDIUM' : 'EASY';

  let partsCostTotalGbp = 0;
  let partsClientTotalGbp = 0;

  if (input.partsSourcingMode === 'LT_AUTO_SUPPLIES' && input.parts) {
    for (const part of input.parts) {
      partsCostTotalGbp += part.costGbp;
      partsClientTotalGbp += part.clientPriceGbp;
    }
  }

  const partsProfitGbp = Math.max(0, Number((partsClientTotalGbp - partsCostTotalGbp).toFixed(2)));
  const grossTotalGbp = Number((labourTotalGbp + partsClientTotalGbp).toFixed(2));
  const netProfitGbp = Number((labourTotalGbp + partsProfitGbp).toFixed(2));

  const projectedHourlyRateGbp =
    totalEstimatedMinutes > 0
      ? Number(((netProfitGbp / totalEstimatedMinutes) * 60).toFixed(2))
      : 0;

  return {
    baseServicesGbp,
    modifiersTotalGbp,
    comboDiscountGbp,
    diagnosticDiscountGbp,
    labourTotalGbp,
    partsCostTotalGbp: Number(partsCostTotalGbp.toFixed(2)),
    partsClientTotalGbp: Number(partsClientTotalGbp.toFixed(2)),
    partsProfitGbp,
    grossTotalGbp,
    netProfitGbp,
    totalEstimatedMinutes,
    customerPromisedMinutes,
    dropOffSlot,
    promisedReadyTime,
    overallComplexity,
    projectedHourlyRateGbp,
    isComboEligible,
    isDiagnosticRepairEligible,
  };
}

/**
 * Recommends complexity modifier IDs automatically based on vehicle technical flags & selected services
 */
export function getRecommendedModifierIds(
  flags: VehicleFlags,
  selectedServices: ServiceCatalogItem[]
): string[] {
  const recommended = new Set<string>();
  const serviceCodes = new Set(selectedServices.map((s) => s.code));

  if (
    flags.hasEPB &&
    (serviceCodes.has('REAR_PADS_MANUAL') ||
      serviceCodes.has('REAR_PADS_EPB') ||
      serviceCodes.has('DISCS_AND_PADS') ||
      serviceCodes.has('DISCS_PADS_FRONT_AND_REAR'))
  ) {
    recommended.add('mod-epb');
  }

  if (
    flags.hasComplexUndertray &&
    (serviceCodes.has('OIL_FILTER') ||
      serviceCodes.has('FULL_BASIC_SERVICE') ||
      serviceCodes.has('MAJOR_DIESEL_SERVICE') ||
      serviceCodes.has('ALTERNATOR_OR_STARTER'))
  ) {
    recommended.add('mod-undertray');
  }

  if (
    flags.dieselFilterPriming &&
    (serviceCodes.has('FULL_BASIC_SERVICE') || serviceCodes.has('MAJOR_DIESEL_SERVICE'))
  ) {
    recommended.add('mod-diesel-bleed');
  }

  if (
    flags.scottishRustRisk &&
    (serviceCodes.has('DISCS_AND_PADS') ||
      serviceCodes.has('DISCS_PADS_FRONT_AND_REAR') ||
      serviceCodes.has('REAR_PADS_MANUAL') ||
      serviceCodes.has('REAR_PADS_EPB') ||
      serviceCodes.has('TRACKACE_ALIGNMENT') ||
      serviceCodes.has('DROP_LINKS_PAIR') ||
      serviceCodes.has('TRACK_ROD_END') ||
      serviceCodes.has('LOWER_WISHBONE_ARM') ||
      serviceCodes.has('FRONT_COIL_SPRING_STRUT') ||
      serviceCodes.has('WHEEL_BEARING_HUB') ||
      serviceCodes.has('EXHAUST_SECTION_SWAP'))
  ) {
    recommended.add('mod-scottish-rust');
  }

  return Array.from(recommended);
}

/**
 * Calculates real-time hourly profit & efficiency tier during/after a job in the bay
 */
export interface LiveYieldAnalysis {
  actualMinutes: number;
  realHourlyRateGbp: number;
  projectedHourlyRateGbp: number;
  efficiencyTier: 'EMERALD' | 'NORMAL' | 'AMBER_RED';
  variancePercent: number;
}

export function analyzeLiveBayYield(
  netProfitGbp: number,
  estimatedMinutes: number,
  actualSecondsSpent: number
): LiveYieldAnalysis {
  const actualMinutes = Math.max(1, Number((actualSecondsSpent / 60).toFixed(1)));
  const realHourlyRateGbp = Number(((netProfitGbp / actualMinutes) * 60).toFixed(2));
  const projectedHourlyRateGbp =
    estimatedMinutes > 0 ? Number(((netProfitGbp / estimatedMinutes) * 60).toFixed(2)) : 0;

  const variancePercent =
    estimatedMinutes > 0
      ? Number((((actualMinutes - estimatedMinutes) / estimatedMinutes) * 100).toFixed(1))
      : 0;

  let efficiencyTier: 'EMERALD' | 'NORMAL' | 'AMBER_RED' = 'NORMAL';
  if (actualMinutes <= estimatedMinutes * 0.85 || realHourlyRateGbp >= 65) {
    efficiencyTier = 'EMERALD';
  } else if (actualMinutes > estimatedMinutes * 1.15 || realHourlyRateGbp < 40) {
    efficiencyTier = 'AMBER_RED';
  }

  return {
    actualMinutes,
    realHourlyRateGbp,
    projectedHourlyRateGbp,
    efficiencyTier,
    variancePercent,
  };
}

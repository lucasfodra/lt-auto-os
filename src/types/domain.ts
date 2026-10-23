/**
 * LT Auto OS — Core Domain Models & Types
 * Built for LT Auto (Livingston, Scotland, UK)
 * 100% Labour-Only Workshop Model (Customer brings parts, LT Auto charges pure skilled labour)
 */

export type Language = 'PT-BR' | 'EN-GB';

export type DriverProfile = 'private' | 'high_mileage';

export type FuelType = 'Petrol' | 'Diesel' | 'Hybrid' | 'EV';

export type ComplexityTier = 'EASY' | 'MEDIUM' | 'HARD' | 'EXTREME';

export interface VehicleFlags {
  hasEPB: boolean; // Electronic Parking Brake
  hasComplexUndertray: boolean; // Heavy/multi-screw undertray
  difficultOilFilter: boolean; // Difficult oil filter access
  dieselFilterPriming?: boolean;
  scottishRustRisk?: boolean;
}

export interface VehicleHistoryEntry {
  id: string;
  date: string;
  mileage: number;
  servicesSummary: string;
  dtcCodes: string[];
  oilSpecUsed?: string;
  advisories?: string;
  labourChargedGbp: number;
  partsCostGbp: number;
  actualMinutes: number;
}

export interface Vehicle {
  id: string;
  vrm: string; // UK Registration Plate e.g., SH64 WRF
  vin?: string;
  make: string;
  model: string;
  year: number;
  engine: string;
  fuelType: FuelType;
  mileage: number;
  oilSpec: string;
  flags: VehicleFlags;
  motExpiryDate: string; // ISO YYYY-MM-DD
  nextServiceDueDate: string; // ISO YYYY-MM-DD
  customerId: string;
  history: VehicleHistoryEntry[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // WhatsApp ready e.g., +44 7700 900123
  preferredLanguage: Language;
  driverProfile: DriverProfile; // high_mileage triggers 3-month oil alerts instead of 12-month
  notes?: string;
}

export type ServiceCategory =
  | 'Oil & Servicing'
  | 'Brakes'
  | 'Suspension & Steering'
  | 'Diagnostics & Electrical'
  | 'Ignition, Cooling & Belts'
  | 'Exhaust, DPF & Clutch'
  | 'Ignition & Alignment'
  | 'Diagnostics & MOT'
  | 'Heavy Repair';

export interface ServiceCatalogItem {
  id: string;
  code: string;
  namePt: string;
  nameEn: string;
  category: ServiceCategory;
  basePriceGbp: number;
  maxPriceGbp?: number;
  estimatedMinutes: number;
  customerBufferMinutes?: number; // Extra safety margin promised to the customer
  complexityTier?: ComplexityTier; // EASY, MEDIUM, HARD, EXTREME
  partsCustomerShouldBringPt?: string; // Exact list of parts customer needs to buy & bring
  partsCustomerShouldBringEn?: string;
  ruleNotePt?: string;
  ruleNoteEn?: string;
}

export interface ComplexityModifier {
  id: string;
  code:
    | 'EPB_SCANNER'
    | 'HEAVY_UNDERTRAY'
    | 'DIESEL_BLEED'
    | 'SCOTTISH_RUST'
    | 'TIGHT_ENGINE_BAY'
    | 'DIAG_REPAIR_DISCOUNT';
  namePt: string;
  nameEn: string;
  surchargeGbp: number;
  extraMinutes: number;
}

export type PartsSourcingMode = 'CUSTOMER_SUPPLIES' | 'LT_AUTO_SUPPLIES';

export interface PartItem {
  id: string;
  name: string;
  costGbp: number;
  markupPercent: number;
  convenienceFeeGbp: number;
  clientPriceGbp: number;
}

export type WorkOrderStatus = 'Quoted' | 'Booked' | 'InProgress' | 'Completed' | 'Paid';

export interface TechnicalChecklist {
  torqueWheelNuts: boolean;
  pumpBrakePedal: boolean;
  resetServiceLight: boolean;
  checkFluidLevels: boolean;
  attachHealthReport: boolean;
}

export type PaymentMethod = 'UK_BANK' | 'REVOLUT_QR' | 'CASH';

export interface WorkOrder {
  id: string;
  orderNumber: string; // e.g., LT-2026-104
  createdAt: string;
  completedAt?: string;
  status: WorkOrderStatus;
  vehicleId: string;
  customerId: string;
  vrm: string;
  vehicleLabel: string;
  customerName: string;
  customerPhone: string;
  customerLanguage: Language;
  selectedServiceIds: string[];
  selectedModifierIds: string[];
  comboDiscountApplied: boolean;
  comboDiscountGbp: number;
  diagnosticDiscountApplied: boolean;
  partsSourcingMode: PartsSourcingMode;
  parts: PartItem[];
  labourTotalGbp: number;
  partsCostTotalGbp: number;
  partsClientTotalGbp: number;
  grossTotalGbp: number;
  netProfitGbp: number;
  estimatedMinutes: number;
  actualSecondsSpent: number;
  timerRunning: boolean;
  timerLastStartedAt?: number; // epoch ms
  scheduledDate?: string; // ISO YYYY-MM-DD (e.g. "2026-10-24")
  dropOffSlot?: string; // e.g. "09:30"
  promisedReadyTime?: string; // e.g. "11:00"
  customerPromisedMinutes?: number;
  checklist: TechnicalChecklist;
  dtcFaults: string[];
  advisoryNotes: string;
  oilSpecUsed?: string;
  recordedMileage: number;
  paymentMethod?: PaymentMethod;
}

export interface FlipCarProject {
  id: string;
  vrm: string;
  makeModel: string;
  source: 'Copart UK' | 'BCA' | 'Private' | 'Trade-In';
  purchasePriceGbp: number;
  partsSpentGbp: number;
  recoveryAndFeesGbp: number;
  hoursInvested: number;
  status: 'In Prep' | 'Listed' | 'Sold';
  salePriceGbp?: number;
  soldDate?: string;
  notes: string;
}

export interface WorkshopSettings {
  workshopName: string;
  location: string;
  phone: string;
  ukBankName: string;
  ukSortCode: string;
  ukAccountNumber: string;
  ukPaymentLink: string;
  monthlyProfitTargetGbp: number;
  dvlaApiKey?: string;
  dvsaClientId?: string;
  dvsaClientSecret?: string;
  dvsaApiKey?: string;
  dvsaTokenUrl?: string;
  dvsaScopeUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  enableSupabaseSync: boolean;
}

export interface AppDatabaseState {
  customers: Customer[];
  vehicles: Vehicle[];
  serviceCatalog: ServiceCatalogItem[];
  modifiersCatalog: ComplexityModifier[];
  workOrders: WorkOrder[];
  flipCars: FlipCarProject[];
  settings: WorkshopSettings;
}

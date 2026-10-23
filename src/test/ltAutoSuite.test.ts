import { describe, expect, it } from 'vitest';
import {
  analyzeLiveBayYield,
  calculateSmartQuote,
  getRecommendedModifierIds,
} from '../services/pricingEngine';
import { INITIAL_MODIFIERS_CATALOG, INITIAL_SERVICE_CATALOG } from '../data/seedData';
import { UK_VEHICLE_SPECS_DB } from '../data/ukVehicleDatabase';
import { decodeUkPlateYear, searchUkVehicleDatabase } from '../services/ukDvlaLookup';
import { generateWhatsAppQuoteText } from '../services/whatsappGenerator';
import { LTAutoRepository } from '../services/repository';

describe('LT Auto OS — Core Business Logic & Encapsulated Test Suite (Scotland / UK)', () => {
  describe('Module 1: Smart Quoting & Dynamic Pricing Engine ("Calculadora Anti-Trouxa")', () => {
    it('calculates base services + combo discount (-£5.00) and projected hourly rate accurately', () => {
      const oilService = INITIAL_SERVICE_CATALOG.find((s) => s.code === 'OIL_FILTER')!; // £30, 30m
      const frontPads = INITIAL_SERVICE_CATALOG.find((s) => s.code === 'FRONT_PADS')!; // £25, 30m

      const res = calculateSmartQuote({
        selectedServices: [oilService, frontPads],
        selectedModifiers: [],
        applyComboDiscount: true,
        comboDiscountAmountGbp: 5,
        applyDiagnosticRepairDiscount: false,
        partsSourcingMode: 'CUSTOMER_SUPPLIES',
        parts: [],
      });

      expect(res.baseServicesGbp).toBe(55);
      expect(res.isComboEligible).toBe(true);
      expect(res.comboDiscountGbp).toBe(5);
      expect(res.labourTotalGbp).toBe(50);
      expect(res.grossTotalGbp).toBe(50);
      expect(res.netProfitGbp).toBe(50);
      expect(res.totalEstimatedMinutes).toBe(60);
      expect(res.customerPromisedMinutes).toBe(90);
      expect(res.promisedReadyTime).toBe('11:00');
      expect(res.projectedHourlyRateGbp).toBe(50);
    });

    it('applies the £10 Launch CRP919X Diagnostic discount rule when booked with a repair', () => {
      const diag = INITIAL_SERVICE_CATALOG.find((s) => s.code === 'LAUNCH_DIAGNOSTIC')!; // £30
      const rearPadsEpb = INITIAL_SERVICE_CATALOG.find((s) => s.code === 'REAR_PADS_EPB')!; // £40
      const epbMod = INITIAL_MODIFIERS_CATALOG.find((m) => m.code === 'EPB_SCANNER')!; // +£10

      const res = calculateSmartQuote({
        selectedServices: [diag, rearPadsEpb],
        selectedModifiers: [epbMod],
        applyComboDiscount: true,
        applyDiagnosticRepairDiscount: true,
        partsSourcingMode: 'CUSTOMER_SUPPLIES',
        parts: [],
      });

      expect(res.isDiagnosticRepairEligible).toBe(true);
      expect(res.diagnosticDiscountGbp).toBe(10);
      expect(res.comboDiscountGbp).toBe(5);
      // 30 + 40 + 10 - 10 - 5 = £65
      expect(res.labourTotalGbp).toBe(65);
    });

    it('separates Gross Revenue from Net Labour + Parts Profit when LT Auto supplies parts', () => {
      const fullService = INITIAL_SERVICE_CATALOG.find((s) => s.code === 'FULL_BASIC_SERVICE')!; // £40

      const res = calculateSmartQuote({
        selectedServices: [fullService],
        selectedModifiers: [],
        applyComboDiscount: false,
        applyDiagnosticRepairDiscount: false,
        partsSourcingMode: 'LT_AUTO_SUPPLIES',
        parts: [
          {
            id: 'p1',
            name: 'Mann Filter Kit + 5L Oil',
            costGbp: 30,
            markupPercent: 20,
            convenienceFeeGbp: 5,
            clientPriceGbp: 41, // £11 margin
          },
        ],
      });

      expect(res.labourTotalGbp).toBe(40);
      expect(res.partsCostTotalGbp).toBe(30);
      expect(res.partsClientTotalGbp).toBe(41);
      expect(res.partsProfitGbp).toBe(11);
      expect(res.grossTotalGbp).toBe(81);
      expect(res.netProfitGbp).toBe(51);
    });

    it('auto-recommends complexity modifiers based on vehicle flags (EPB, Undertray, Scottish Rust)', () => {
      const rearPads = INITIAL_SERVICE_CATALOG.find((s) => s.code === 'REAR_PADS_EPB')!;
      const oil = INITIAL_SERVICE_CATALOG.find((s) => s.code === 'OIL_FILTER')!;

      const rec = getRecommendedModifierIds(
        {
          hasEPB: true,
          hasComplexUndertray: true,
          difficultOilFilter: false,
          scottishRustRisk: true,
        },
        [rearPads, oil]
      );

      expect(rec).toContain('mod-epb');
      expect(rec).toContain('mod-undertray');
      expect(rec).toContain('mod-scottish-rust');
    });
  });

  describe('Scottish & UK Vehicle Technical Spec Database & VRM Age Decoder', () => {
    it('contains comprehensive technical specs (oil viscosity, OEM spec, capacity, sump & wheel torques) for common UK cars', () => {
      expect(UK_VEHICLE_SPECS_DB.length).toBeGreaterThanOrEqual(20);

      const ecoboost = searchUkVehicleDatabase('EcoBoost')[0];
      expect(ecoboost).toBeDefined();
      expect(ecoboost.oilViscosity).toBe('5W-20');
      expect(ecoboost.oilCapacityLitres).toBe(4.6);
      expect(ecoboost.wheelNutTorqueNm).toBe(135);

      const priusUber = searchUkVehicleDatabase('Prius')[0];
      expect(priusUber).toBeDefined();
      expect(priusUber.oilViscosity).toBe('0W-20');
    });

    it('decodes UK registration plate (VRM) year and Scottish regional prefix accurately', () => {
      const sh64 = decodeUkPlateYear('SH64 WRF');
      expect(sh64.year).toBe(2014);
      expect(sh64.isScottishRegistered).toBe(true);

      const so18 = decodeUkPlateYear('SO18 XZP');
      expect(so18.year).toBe(2018);
      expect(so18.isScottishRegistered).toBe(true);

      const dv66 = decodeUkPlateYear('DV66 UKB');
      expect(dv66.year).toBe(2016);
      expect(dv66.isScottishRegistered).toBe(false);
    });
  });

  describe('Module 2: Live Bay Stopwatch Yield & Efficiency Analyzer', () => {
    it('flags EMERALD efficiency when 45-min £45 job is completed in 30 minutes (£90/h)', () => {
      const yieldRes = analyzeLiveBayYield(45, 45, 30 * 60);
      expect(yieldRes.actualMinutes).toBe(30);
      expect(yieldRes.realHourlyRateGbp).toBe(90);
      expect(yieldRes.efficiencyTier).toBe('EMERALD');
    });

    it('flags AMBER_RED overtime alert when 45-min £45 job takes 90 minutes (£30/h)', () => {
      const yieldRes = analyzeLiveBayYield(45, 45, 90 * 60);
      expect(yieldRes.actualMinutes).toBe(90);
      expect(yieldRes.realHourlyRateGbp).toBe(30);
      expect(yieldRes.efficiencyTier).toBe('AMBER_RED');
    });
  });

  describe('Bilingual Document Output (PT-BR vs EN-GB UK Terminology)', () => {
    it('generates WhatsApp quotes in either PT-BR or EN-GB with UK Faster Payments / Revolut / Cash', () => {
      const oilService = INITIAL_SERVICE_CATALOG[0];
      const calc = calculateSmartQuote({
        selectedServices: [oilService],
        selectedModifiers: [],
        applyComboDiscount: false,
        applyDiagnosticRepairDiscount: false,
        partsSourcingMode: 'CUSTOMER_SUPPLIES',
        parts: [],
      });

      const msgPt = generateWhatsAppQuoteText({
        outputLanguage: 'PT-BR',
        customerName: 'Matheus Oliveira',
        vrm: 'SH64 WRF',
        vehicleLabel: '2014 Ford Focus 1.0 EcoBoost',
        selectedServices: [oilService],
        selectedModifiers: [],
        calculation: calc,
        partsSourcingMode: 'CUSTOMER_SUPPLIES',
        parts: [],
        oilSpec: '5W-20',
      });

      const msgEn = generateWhatsAppQuoteText({
        outputLanguage: 'EN-GB',
        customerName: 'Callum MacLeod',
        vrm: 'DV66 UKB',
        vehicleLabel: '2016 Vauxhall Corsa 1.4',
        selectedServices: [oilService],
        selectedModifiers: [],
        calculation: calc,
        partsSourcingMode: 'CUSTOMER_SUPPLIES',
        parts: [],
        oilSpec: '5W-30',
      });

      expect(msgPt).toContain('Mão de Obra Especializada');
      expect(msgPt).toContain('SH64 WRF');
      expect(msgPt).not.toContain('PIX');
      expect(msgEn).toContain('Itemised Labour');
      expect(msgEn).toContain('Complimentary with Service');
      expect(msgEn).toContain('DV66 UKB');
    });
  });

  describe('Repository Pattern Persistence & Seed Data Integrity', () => {
    it('loads realistic Livingston LT Auto seed data and extended 16-item UK service catalog', () => {
      const repo = new LTAutoRepository();
      const state = repo.resetToSeedData();

      expect(state.vehicles.length).toBeGreaterThanOrEqual(5);
      expect(state.serviceCatalog.length).toBeGreaterThanOrEqual(30);
      expect(state.vehicles[0].vrm).toBe('SH64 WRF');
      expect(state.workOrders.length).toBeGreaterThanOrEqual(5);
    });
  });
});

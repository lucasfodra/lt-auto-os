import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Gauge,
  KeyRound,
  PackageCheck,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UkPlateBadge } from '../common/UkPlateBadge';
import {
  calculateSmartQuote,
  getRecommendedModifierIds,
} from '../../services/pricingEngine';
import {
  buildAutodocUkUrl,
  buildEuroCarPartsUrl,
  buildGovUkMotHistoryUrl,
  generateWhatsAppQuoteText,
} from '../../services/whatsappGenerator';
import {
  UK_VEHICLE_SPECS_DB,
  UkVehicleTechnicalSpec,
} from '../../data/ukVehicleDatabase';
import {
  decodeUkPlateYear,
  DvsaVehicleMotResponse,
  fetchDvsaVehicleAndMotHistory,
  searchUkVehicleDatabase,
} from '../../services/ukDvlaLookup';
import { ComplexityTier, FuelType, ServiceCategory, VehicleFlags } from '../../types/domain';
import { t } from '../../i18n/translations';

interface SmartQuotingModuleProps {
  onNavigateToOrders: () => void;
  onNavigateToSettings?: () => void;
}

const DROP_OFF_SLOTS = [
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '11:00',
  '12:00',
  '13:30',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

const COMPLEXITY_BADGE_STYLES: Record<
  ComplexityTier,
  { labelPt: string; labelEn: string; classes: string }
> = {
  EASY: {
    labelPt: 'FÁCIL',
    labelEn: 'EASY',
    classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  MEDIUM: {
    labelPt: 'MÉDIO',
    labelEn: 'MEDIUM',
    classes: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  HARD: {
    labelPt: 'PESADO',
    labelEn: 'HARD',
    classes: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
  EXTREME: {
    labelPt: 'EXTREMO',
    labelEn: 'EXTREME',
    classes: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
};

export const SmartQuotingModule: React.FC<SmartQuotingModuleProps> = ({
  onNavigateToOrders,
  onNavigateToSettings,
}) => {
  const { db, uiLang, docLang, setDocLang, addWorkOrder } = useApp();
  const isPt = uiLang === 'PT-BR';

  // Vehicle & Customer State
  const [vrm, setVrm] = useState('SH64 WRF');
  const [make, setMake] = useState('Ford');
  const [model, setModel] = useState('Focus Zetec Navigator');
  const [year, setYear] = useState(2014);
  const [engine, setEngine] = useState('1.0 EcoBoost 125ps (Wet Belt)');
  const [fuelType, setFuelType] = useState<FuelType>('Petrol');
  const [oilSpec, setOilSpec] = useState('5W-20 WSS-M2C948-B (4.6L)');
  const [mileage, setMileage] = useState(84210);
  const [customerName, setCustomerName] = useState('Matheus Oliveira');
  const [customerPhone, setCustomerPhone] = useState('+447700900412');

  // Active Technical Spec + DVSA MOT Report
  const [activeTechSpec, setActiveTechSpec] = useState<UkVehicleTechnicalSpec | null>(
    UK_VEHICLE_SPECS_DB[0]
  );
  const [dvsaReport, setDvsaReport] = useState<DvsaVehicleMotResponse | null>(null);
  const [loadingDvsa, setLoadingDvsa] = useState(false);
  const [ukDbSearchQuery, setUkDbSearchQuery] = useState('');
  const [showUkDatabaseDrawer, setShowUkDatabaseDrawer] = useState(false);

  // Category & Service Filter State
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'ALL'>('ALL');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

  // Drop-off Date & Time Slot Scheduler
  const [scheduledDate, setScheduledDate] = useState('2026-10-24');
  const [dropOffSlot, setDropOffSlot] = useState('09:30');

  const [flags, setFlags] = useState<VehicleFlags>({
    hasEPB: false,
    hasComplexUndertray: true,
    difficultOilFilter: true,
    dieselFilterPriming: false,
    scottishRustRisk: true,
  });

  // Selected Services & Modifiers
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([
    'srv-oil-basic',
    'srv-front-pads',
  ]);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>(['mod-undertray']);
  const [applyComboDiscount, setApplyComboDiscount] = useState(true);
  const [applyDiagnosticDiscount, setApplyDiagnosticDiscount] = useState(true);

  const [copiedToast, setCopiedToast] = useState(false);
  const [orderCreatedBanner, setOrderCreatedBanner] = useState<string | null>(null);

  const filteredUkDatabase = useMemo(
    () => searchUkVehicleDatabase(ukDbSearchQuery),
    [ukDbSearchQuery]
  );

  const categoriesList = useMemo(
    () => Array.from(new Set(db.serviceCatalog.map((s) => s.category))),
    [db.serviceCatalog]
  );

  const filteredServiceCatalog = useMemo(() => {
    return db.serviceCatalog.filter((srv) => {
      const matchesCat = selectedCategory === 'ALL' || srv.category === selectedCategory;
      const q = serviceSearchQuery.trim().toLowerCase();
      if (!q) return matchesCat;
      const matchesText =
        srv.namePt.toLowerCase().includes(q) ||
        srv.nameEn.toLowerCase().includes(q) ||
        srv.category.toLowerCase().includes(q) ||
        (srv.partsCustomerShouldBringPt || '').toLowerCase().includes(q) ||
        (srv.partsCustomerShouldBringEn || '').toLowerCase().includes(q);
      return matchesCat && matchesText;
    });
  }, [db.serviceCatalog, selectedCategory, serviceSearchQuery]);

  const handleSelectUkTechSpec = (spec: UkVehicleTechnicalSpec) => {
    setActiveTechSpec(spec);
    setMake(spec.make);
    setModel(spec.model);
    setEngine(spec.engineLabel);
    setFuelType(spec.fuelType);
    setOilSpec(`${spec.oilViscosity} ${spec.oilOemSpec} (${spec.oilCapacityLitres}L)`);
    setFlags(spec.flags);

    const decoded = decodeUkPlateYear(vrm);
    if (decoded.year) setYear(decoded.year);

    const currentServices = db.serviceCatalog.filter((s) =>
      selectedServiceIds.includes(s.id)
    );
    const recMods = getRecommendedModifierIds(spec.flags, currentServices);
    setSelectedModifierIds(recMods);
    setShowUkDatabaseDrawer(false);
  };

  const handleLookupVrm = async (targetVrm = vrm) => {
    setLoadingDvsa(true);
    const normalized = targetVrm.replace(/\s+/g, '').toUpperCase();
    const foundVeh = db.vehicles.find(
      (v) => v.vrm.replace(/\s+/g, '').toUpperCase() === normalized
    );

    const dvsaData = await fetchDvsaVehicleAndMotHistory(targetVrm, db.settings);
    setDvsaReport(dvsaData);
    setLoadingDvsa(false);

    if (foundVeh) {
      setVrm(foundVeh.vrm);
      setMake(foundVeh.make);
      setModel(foundVeh.model);
      setYear(foundVeh.year);
      setEngine(foundVeh.engine);
      setFuelType(foundVeh.fuelType);
      setOilSpec(foundVeh.oilSpec);
      setMileage(foundVeh.mileage);
      setFlags(foundVeh.flags);

      const matchedSpec =
        dvsaData.matchedTechSpec ||
        UK_VEHICLE_SPECS_DB.find((s) =>
          s.make.toLowerCase().includes(foundVeh.make.toLowerCase())
        );
      if (matchedSpec) setActiveTechSpec(matchedSpec);

      const owner = db.customers.find((c) => c.id === foundVeh.customerId);
      if (owner) {
        setCustomerName(owner.name);
        setCustomerPhone(owner.phone);
        setDocLang(owner.preferredLanguage);
      }

      const currentServices = db.serviceCatalog.filter((s) =>
        selectedServiceIds.includes(s.id)
      );
      const recMods = getRecommendedModifierIds(foundVeh.flags, currentServices);
      setSelectedModifierIds(recMods);
    } else if (dvsaData.matchedTechSpec) {
      const spec = dvsaData.matchedTechSpec;
      setActiveTechSpec(spec);
      setMake(dvsaData.make);
      setModel(dvsaData.model);
      setEngine(spec.engineLabel);
      setFuelType(dvsaData.fuelType);
      setOilSpec(`${spec.oilViscosity} ${spec.oilOemSpec} (${spec.oilCapacityLitres}L)`);
      setFlags(spec.flags);

      const latestOdo = parseInt(dvsaData.motTests?.[0]?.odometerValue || '0', 10);
      if (latestOdo > 0) setMileage(latestOdo);

      const decoded = decodeUkPlateYear(targetVrm);
      if (decoded.year) setYear(decoded.year);

      const currentServices = db.serviceCatalog.filter((s) =>
        selectedServiceIds.includes(s.id)
      );
      const recMods = getRecommendedModifierIds(spec.flags, currentServices);
      setSelectedModifierIds(recMods);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) => {
      const next = prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId];

      const nextServices = db.serviceCatalog.filter((s) => next.includes(s.id));
      const recMods = getRecommendedModifierIds(flags, nextServices);
      setSelectedModifierIds((currMods) =>
        Array.from(new Set([...currMods, ...recMods]))
      );
      return next;
    });
  };

  const toggleModifier = (modId: string) => {
    setSelectedModifierIds((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  };

  const toggleFlag = (key: keyof VehicleFlags) => {
    setFlags((prev) => {
      const nextFlags = { ...prev, [key]: !prev[key] };
      const currentServices = db.serviceCatalog.filter((s) =>
        selectedServiceIds.includes(s.id)
      );
      const recMods = getRecommendedModifierIds(nextFlags, currentServices);
      setSelectedModifierIds(recMods);
      return nextFlags;
    });
  };

  const selectedServices = useMemo(
    () => db.serviceCatalog.filter((s) => selectedServiceIds.includes(s.id)),
    [db.serviceCatalog, selectedServiceIds]
  );

  const selectedModifiers = useMemo(
    () => db.modifiersCatalog.filter((m) => selectedModifierIds.includes(m.id)),
    [db.modifiersCatalog, selectedModifierIds]
  );

  const calculation = useMemo(
    () =>
      calculateSmartQuote({
        selectedServices,
        selectedModifiers,
        applyComboDiscount,
        comboDiscountAmountGbp: 5,
        applyDiagnosticRepairDiscount: applyDiagnosticDiscount,
        partsSourcingMode: 'CUSTOMER_SUPPLIES',
        parts: [],
        dropOffSlot,
      }),
    [
      selectedServices,
      selectedModifiers,
      applyComboDiscount,
      applyDiagnosticDiscount,
      dropOffSlot,
    ]
  );

  const whatsappMessage = useMemo(
    () =>
      generateWhatsAppQuoteText({
        outputLanguage: docLang,
        customerName,
        vrm,
        vehicleLabel: `${year} ${make} ${model} (${engine})`,
        selectedServices,
        selectedModifiers,
        calculation,
        scheduledDate,
        partsSourcingMode: 'CUSTOMER_SUPPLIES',
        oilSpec,
      }),
    [
      docLang,
      customerName,
      vrm,
      year,
      make,
      model,
      engine,
      selectedServices,
      selectedModifiers,
      calculation,
      scheduledDate,
      oilSpec,
    ]
  );

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleOpenWhatsApp = () => {
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCreateWorkOrder = () => {
    const matchedVeh = db.vehicles.find(
      (v) => v.vrm.replace(/\s+/g, '').toUpperCase() === vrm.replace(/\s+/g, '').toUpperCase()
    );
    const created = addWorkOrder({
      status: 'Booked',
      vehicleId: matchedVeh?.id || 'veh-custom',
      customerId: matchedVeh?.customerId || 'cust-custom',
      vrm: vrm.toUpperCase(),
      vehicleLabel: `${year} ${make} ${model} (${engine})`,
      customerName,
      customerPhone,
      customerLanguage: docLang,
      selectedServiceIds,
      selectedModifierIds,
      comboDiscountApplied: calculation.comboDiscountGbp > 0,
      comboDiscountGbp: calculation.comboDiscountGbp,
      diagnosticDiscountApplied: calculation.diagnosticDiscountGbp > 0,
      partsSourcingMode: 'CUSTOMER_SUPPLIES',
      parts: [],
      labourTotalGbp: calculation.labourTotalGbp,
      partsCostTotalGbp: 0,
      partsClientTotalGbp: 0,
      grossTotalGbp: calculation.labourTotalGbp,
      netProfitGbp: calculation.labourTotalGbp,
      estimatedMinutes: calculation.totalEstimatedMinutes,
      actualSecondsSpent: 0,
      timerRunning: false,
      scheduledDate,
      dropOffSlot: calculation.dropOffSlot,
      promisedReadyTime: calculation.promisedReadyTime,
      customerPromisedMinutes: calculation.customerPromisedMinutes,
      checklist: {
        torqueWheelNuts: false,
        pumpBrakePedal: false,
        resetServiceLight: false,
        checkFluidLevels: false,
        attachHealthReport: false,
      },
      dtcFaults: [],
      advisoryNotes: activeTechSpec
        ? isPt
          ? activeTechSpec.mechanicNotesPt
          : activeTechSpec.mechanicNotesEn
        : '',
      oilSpecUsed: oilSpec,
      recordedMileage: mileage,
    });

    setOrderCreatedBanner(created.orderNumber);
    setTimeout(() => setOrderCreatedBanner(null), 4000);
  };

  return (
    <div className="space-y-5">
      {/* ====================================================================
          TOP BAR: UK PLATE INPUT + DVSA LOOKUP + QUICK VEHICLE SPECS BAR
         ==================================================================== */}
      <section className="bg-[#161F30] border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <UkPlateBadge vrm={vrm} size="md" editable onChange={setVrm} />

            <button
              type="button"
              onClick={() => void handleLookupVrm(vrm)}
              disabled={loadingDvsa}
              className="h-11 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg flex items-center gap-2 text-xs sm:text-sm shadow transition"
            >
              <Zap className="w-4 h-4" />
              {loadingDvsa
                ? 'Buscando...'
                : isPt
                ? 'Buscar Placa (DVSA)'
                : 'Lookup VRM (DVSA)'}
            </button>

            <button
              type="button"
              onClick={() => setShowUkDatabaseDrawer((v) => !v)}
              className="h-11 px-3.5 bg-slate-900 hover:bg-slate-800 border border-amber-500/60 text-amber-300 font-bold rounded-lg flex items-center gap-2 text-xs transition"
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              {isPt
                ? `Escolher Carro Manual (${UK_VEHICLE_SPECS_DB.length} Modelos)`
                : `Select UK Car Model (${UK_VEHICLE_SPECS_DB.length})`}
            </button>
          </div>

          {/* Seed Plates + API Key Shortcut */}
          <div className="flex flex-wrap items-center gap-1.5">
            {db.vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => void handleLookupVrm(v.vrm)}
                className={`px-2 py-1 rounded text-[11px] font-mono font-bold border transition ${
                  v.vrm === vrm
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500'
                }`}
              >
                {v.vrm}
              </button>
            ))}

            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="ml-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-[11px] font-bold flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" /> Config API DVSA
              </button>
            )}
          </div>
        </div>

        {/* Drawer to pick any Scottish/UK Car Spec */}
        {showUkDatabaseDrawer && (
          <div className="bg-slate-950 border border-amber-500/60 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-400">
                🏴󠁧󠁢󠁳󠁣󠁴󠁿{' '}
                {isPt
                  ? 'Clique no carro para carregar Óleo, Litros, Torques e Dicas:'
                  : 'Select UK Vehicle Spec:'}
              </span>
              <button
                type="button"
                onClick={() => setShowUkDatabaseDrawer(false)}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                {isPt ? 'Fechar' : 'Close'}
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={ukDbSearchQuery}
                onChange={(e) => setUkDbSearchQuery(e.target.value)}
                placeholder="Ex: Fiesta EcoBoost, Corsa 1.4, Golf TDI, Prius, PureTech, BMW 320d..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
              {filteredUkDatabase.map((spec) => (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => handleSelectUkTechSpec(spec)}
                  className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/90 hover:border-amber-500 text-left transition"
                >
                  <div className="text-xs font-black text-white">
                    {spec.make} {spec.model}
                  </div>
                  <div className="text-[11px] font-bold text-amber-400">{spec.engineLabel}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    🛢️ {spec.oilViscosity} ({spec.oilCapacityLitres}L) • 🔩 {spec.wheelNutTorqueNm}Nm
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Compact Vehicle Info + Technical Spec Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2 border-t border-slate-800/80">
          <div>
            <label className="text-[11px] text-slate-400 font-semibold">Carro / Modelo</label>
            <input
              value={`${make} ${model}`}
              onChange={(e) => setModel(e.target.value)}
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-semibold">Motor</label>
            <input
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-400 font-semibold">
              Óleo OEM &amp; Capacidade (Litros)
            </label>
            <input
              value={oilSpec}
              onChange={(e) => setOilSpec(e.target.value)}
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-semibold">Cliente</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-semibold">WhatsApp (+44)</label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
            />
          </div>
        </div>

        {/* One-Line Technical Torques & Note Bar */}
        {activeTechSpec && (
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3 font-mono">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5" />
                Torques:
              </span>
              <span className="text-slate-300">
                Bujão: <strong className="text-white">{activeTechSpec.sumpPlugTorqueNm} Nm</strong>
              </span>
              <span className="text-slate-300">
                Roda: <strong className="text-white">{activeTechSpec.wheelNutTorqueNm} Nm</strong>
              </span>
              <span className="text-emerald-400">
                Cárter: <strong>{activeTechSpec.oilCapacityLitres}L</strong>
              </span>
            </div>
            <span className="text-amber-200/90 text-[11px] truncate max-w-xl">
              💡 {isPt ? activeTechSpec.mechanicNotesPt : activeTechSpec.mechanicNotesEn}
            </span>
          </div>
        )}

        {/* DVSA Advisories Box (Only when Lookup VRM is clicked) */}
        {dvsaReport && dvsaReport.motTests?.[0]?.defects && (
          <div className="bg-emerald-950/30 border border-emerald-500/50 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1 text-xs">
              <div className="font-bold text-emerald-300">
                🇬🇧 DVSA MOT ({dvsaReport.registration}) — Vence: {dvsaReport.motTests[0].expiryDate}{' '}
                • {Number(dvsaReport.motTests[0].odometerValue).toLocaleString()} mi
              </div>
              {dvsaReport.motTests[0].defects.map((d, i) => (
                <div key={i} className="text-slate-300 text-[11px]">
                  • <strong className="text-amber-400">[{d.type}]</strong> {d.text}
                </div>
              ))}
            </div>
            {dvsaReport.recommendedServiceIds.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setSelectedServiceIds((prev) =>
                    Array.from(new Set([...prev, ...dvsaReport.recommendedServiceIds]))
                  )
                }
                className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Incluir Reparos do MOT (+{dvsaReport.recommendedServiceIds.length})
              </button>
            )}
          </div>
        )}
      </section>

      {/* ====================================================================
          MAIN 2-COLUMN WORKSPACE: SERVICES ON LEFT (7) | SCHEDULE & QUOTE ON RIGHT (5)
         ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Clean Service Picker + Complexity Surcharges */}
        <div className="lg:col-span-7 space-y-5">
          <section className="bg-[#161F30] border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-white">
                {isPt
                  ? `1. Escolha os Serviços (${db.serviceCatalog.length} opções — Só Mão de Obra)`
                  : `1. Select Labour Services (${db.serviceCatalog.length} jobs)`}
              </h2>
              <span className="text-xs font-mono bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 rounded-full">
                {selectedServiceIds.length} {isPt ? 'marcados' : 'selected'}
              </span>
            </div>

            {/* Search & Category Tabs */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={serviceSearchQuery}
                onChange={(e) => setServiceSearchQuery(e.target.value)}
                placeholder={
                  isPt
                    ? 'Pesquisar serviço (ex: óleo, pastilha, disco, mola, bieleta, bandeja, alternador)...'
                    : 'Search service (e.g. oil, pads, discs, spring, drop link, wishbone)...'
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  selectedCategory === 'ALL'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
                }`}
              >
                Todos ({db.serviceCatalog.length})
              </button>
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Clean Service Cards List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredServiceCatalog.map((srv) => {
                const isSelected = selectedServiceIds.includes(srv.id);
                const tier = srv.complexityTier || 'EASY';
                const badge = COMPLEXITY_BADGE_STYLES[tier];
                const totalWithBuffer = srv.estimatedMinutes + (srv.customerBufferMinutes ?? 15);

                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => toggleService(srv.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 shadow'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <span className="text-xs font-bold text-slate-100 leading-snug">
                        {isPt ? srv.namePt : srv.nameEn}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-xs font-black shrink-0 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-amber-400'
                        }`}
                      >
                        £{srv.basePriceGbp}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px] w-full">
                      <span className={`px-1.5 py-0.5 rounded border font-bold ${badge.classes}`}>
                        {isPt ? badge.labelPt : badge.labelEn}
                      </span>
                      <span className="font-mono text-slate-300">
                        Box: {srv.estimatedMinutes}m | Cliente:{' '}
                        <strong className="text-emerald-400">~{totalWithBuffer}m</strong>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Compact Complexity Modifiers & Discounts */}
          <section className="bg-[#161F30] border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
            <h3 className="text-sm font-black text-white">
              {isPt
                ? '2. Adicionais de Dificuldade (Ferrugem / EPB / Protetor) & Descontos'
                : '2. Complexity Surcharges & Combo Discounts'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {db.modifiersCatalog.map((mod) => {
                const active = selectedModifierIds.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModifier(mod.id)}
                    className={`p-2.5 rounded-lg border flex items-center justify-between text-left text-xs transition ${
                      active
                        ? 'bg-red-950/40 border-red-500 text-red-200 font-bold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="truncate pr-2">{isPt ? mod.namePt : mod.nameEn}</span>
                    <span className="font-mono font-black shrink-0 text-red-400">
                      +£{mod.surchargeGbp} (+{mod.extraMinutes}m)
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={!calculation.isComboEligible}
                onClick={() => setApplyComboDiscount((v) => !v)}
                className={`p-2.5 rounded-lg border font-bold text-xs flex items-center justify-between transition ${
                  !calculation.isComboEligible
                    ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                    : applyComboDiscount
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                <span>✨ {t(uiLang, 'comboAvailable')}</span>
                <span className="font-mono font-black">-£5.00</span>
              </button>

              <button
                type="button"
                disabled={!calculation.isDiagnosticRepairEligible}
                onClick={() => setApplyDiagnosticDiscount((v) => !v)}
                className={`p-2.5 rounded-lg border font-bold text-xs flex items-center justify-between transition ${
                  !calculation.isDiagnosticRepairEligible
                    ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                    : applyDiagnosticDiscount
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                <span>✓ {t(uiLang, 'diagRuleAvailable')}</span>
                <span className="font-mono font-black">-£10.00</span>
              </button>
            </div>
          </section>
        </div>

        {/* Right 5 Cols: Schedule + Total Price + WhatsApp Ready */}
        <div className="lg:col-span-5 space-y-5">
          {/* Unified Schedule + Price + Create Booking Card */}
          <section className="bg-[#161F30] border-2 border-amber-500/70 rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {isPt ? '3. HORÁRIO, TEMPO & FECHAMENTO' : '3. SCHEDULE, TIME & TOTAL'}
              </span>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white"
              />
            </div>

            {/* Drop-off Time Grid */}
            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1.5">
                {isPt ? 'Horário de Chegada do Cliente:' : 'Customer Drop-Off Slot:'}
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {DROP_OFF_SLOTS.map((slot) => {
                  const isSlotBusy = db.workOrders.some(
                    (w) =>
                      w.scheduledDate === scheduledDate &&
                      w.dropOffSlot === slot &&
                      w.status !== 'Paid'
                  );
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setDropOffSlot(slot)}
                      className={`py-1.5 rounded-lg font-mono text-xs font-black border transition ${
                        dropOffSlot === slot
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : isSlotBusy
                          ? 'bg-amber-950/60 text-amber-300 border-amber-600/60'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Turnaround Summary */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
              <div>
                <span className="text-[10px] text-slate-400 block">Tempo Box</span>
                <span className="text-base font-black font-mono text-amber-400">
                  ~{calculation.totalEstimatedMinutes}m
                </span>
              </div>
              <div className="border-x border-slate-800">
                <span className="text-[10px] text-slate-400 block">Prazo Cliente</span>
                <span className="text-base font-black font-mono text-white">
                  ~{calculation.customerPromisedMinutes}m
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-400 font-bold block">Pronto às</span>
                <span className="text-lg font-black font-mono text-emerald-400">
                  {calculation.promisedReadyTime}
                </span>
              </div>
            </div>

            {/* Parts Customer Must Bring */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <PackageCheck className="w-3.5 h-3.5" />
                  {isPt ? 'Peças p/ Cliente Trazer:' : 'Parts Customer Brings:'}
                </span>
                <div className="flex gap-2">
                  <a
                    href={buildEuroCarPartsUrl(vrm)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline font-bold"
                  >
                    EuroCarParts ↗
                  </a>
                  <a
                    href={buildAutodocUkUrl(make, model, engine)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:underline font-bold"
                  >
                    Autodoc ↗
                  </a>
                </div>
              </div>
              <ul className="space-y-1 text-xs text-slate-300">
                {selectedServices.map((s) => (
                  <li key={s.id}>
                    • {isPt ? s.partsCustomerShouldBringPt : s.partsCustomerShouldBringEn}
                  </li>
                ))}
              </ul>
            </div>

            {/* Final Price & Hourly Rate */}
            <div className="flex items-end justify-between pt-2 border-t border-slate-800">
              <div>
                <span className="text-[11px] uppercase font-bold text-slate-400 block">
                  Seu Ganho / Hora
                </span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  £{calculation.projectedHourlyRateGbp.toFixed(2)}/h
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase font-bold text-amber-400 block">
                  Total Mão de Obra
                </span>
                <span className="text-3xl font-black font-mono text-white">
                  £{calculation.labourTotalGbp.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateWorkOrder}
              className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 shadow-lg transition text-sm"
            >
              <Wrench className="w-4 h-4" />
              Agendar na Oficina ({dropOffSlot} → {calculation.promisedReadyTime})
            </button>

            {orderCreatedBanner && (
              <div className="p-2.5 rounded-lg bg-emerald-950 border border-emerald-500 text-emerald-200 text-xs font-bold flex items-center justify-between">
                <span>✓ Agendado: #{orderCreatedBanner}</span>
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className="underline text-amber-300"
                >
                  Ver na Agenda →
                </button>
              </div>
            )}
          </section>

          {/* WhatsApp Message Card */}
          <section className="bg-[#161F30] border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-amber-400">
                4. Mensagem Pronta p/ WhatsApp
              </span>
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setDocLang('PT-BR')}
                  className={`px-2 py-1 rounded font-bold ${
                    docLang === 'PT-BR' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  🇧🇷 PT
                </button>
                <button
                  type="button"
                  onClick={() => setDocLang('EN-GB')}
                  className={`px-2 py-1 rounded font-bold ${
                    docLang === 'EN-GB' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  🇬🇧 EN
                </button>
              </div>
            </div>

            <pre className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto">
              {whatsappMessage}
            </pre>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 text-xs border border-slate-700"
              >
                {copiedToast ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copiar Texto
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="min-h-[44px] bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black rounded-lg flex items-center justify-center gap-1.5 text-xs shadow"
              >
                <Send className="w-4 h-4" /> Enviar no Zap
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

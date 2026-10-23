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
    labelPt: 'FÁCIL / RÁPIDO',
    labelEn: 'EASY / FAST',
    classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  MEDIUM: {
    labelPt: 'MÉDIO / PADRÃO',
    labelEn: 'MEDIUM / STD',
    classes: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  HARD: {
    labelPt: 'PESADO / FERRUGEM',
    labelEn: 'HEAVY / HARD',
    classes: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
  EXTREME: {
    labelPt: 'ALTA COMPLEXIDADE',
    labelEn: 'EXTREME',
    classes: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
};

export const SmartQuotingModule: React.FC<SmartQuotingModuleProps> = ({
  onNavigateToOrders,
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

  // Active Technical Spec from Scottish/UK Database + DVSA MOT API Report
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

  const categoriesList = useMemo(() => {
    const unique = Array.from(new Set(db.serviceCatalog.map((s) => s.category)));
    return unique;
  }, [db.serviceCatalog]);

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

  // Apply a vehicle spec from the Scottish/UK Common Cars Database
  const handleSelectUkTechSpec = (spec: UkVehicleTechnicalSpec) => {
    setActiveTechSpec(spec);
    setMake(spec.make);
    setModel(spec.model);
    setEngine(spec.engineLabel);
    setFuelType(spec.fuelType);
    setOilSpec(`${spec.oilViscosity} ${spec.oilOemSpec} (${spec.oilCapacityLitres}L)`);
    setFlags(spec.flags);

    const decoded = decodeUkPlateYear(vrm);
    if (decoded.year) {
      setYear(decoded.year);
    }

    const currentServices = db.serviceCatalog.filter((s) =>
      selectedServiceIds.includes(s.id)
    );
    const recMods = getRecommendedModifierIds(spec.flags, currentServices);
    setSelectedModifierIds(recMods);
    setShowUkDatabaseDrawer(false);
  };

  // Lookup VRM via DVSA MOT History API + Local LT Auto Fleet + Scottish Tech Spec DB
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 7 Cols: UK VRM Plate Lookup, Scottish Vehicle Technical Database & 31-Service Labour Menu */}
      <div className="lg:col-span-7 space-y-6">
        {/* Step 1: UK VRM Plate Lookup & Scottish Vehicle Technical Spec Database */}
        <section className="bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                1. {t(uiLang, 'quickLookupVrm')} &amp; UK Car Database
              </span>
              <h2 className="text-lg font-extrabold text-white">
                {isPt
                  ? 'Placa UK + Banco Técnico dos Carros da Escócia'
                  : 'UK VRM Lookup + Scottish Common Vehicles Technical Database'}
              </h2>
            </div>

            {/* Quick Seed Fleet VRM Pills */}
            <div className="flex flex-wrap gap-1.5">
              {db.vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleLookupVrm(v.vrm)}
                  className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold border transition ${
                    v.vrm === vrm
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900/90 text-amber-300 border-slate-700 hover:border-amber-500'
                  }`}
                >
                  {v.vrm}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <UkPlateBadge vrm={vrm} size="lg" editable onChange={setVrm} />
            <button
              type="button"
              onClick={() => void handleLookupVrm(vrm)}
              disabled={loadingDvsa}
              className="min-h-[52px] px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg flex items-center justify-center gap-2 shadow transition text-sm"
            >
              <Zap className="w-4 h-4" />
              {loadingDvsa
                ? 'Consultando DVSA...'
                : isPt
                ? 'Consultar Placa (DVSA MOT)'
                : 'Lookup VRM (DVSA MOT)'}
            </button>

            <button
              type="button"
              onClick={() => setShowUkDatabaseDrawer((v) => !v)}
              className="min-h-[52px] flex-1 px-4 bg-slate-900 hover:bg-slate-800 border-2 border-amber-500/70 text-amber-300 font-extrabold rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition"
            >
              <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
              {isPt
                ? `Banco de Carros da Escócia (${UK_VEHICLE_SPECS_DB.length} Modelos)`
                : `Scottish / UK Car Specs DB (${UK_VEHICLE_SPECS_DB.length} Models)`}
            </button>
          </div>

          {/* DVSA Trade MOT History API Live Result & 1-Click Quote Advisories Banner */}
          {dvsaReport && dvsaReport.motTests && dvsaReport.motTests[0] && (
            <div className="mb-4 bg-emerald-950/30 border-2 border-emerald-500/60 rounded-xl p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono text-[10px] font-black uppercase">
                    DVSA MOT API
                  </span>
                  <span className="text-xs font-extrabold text-white">
                    {dvsaReport.make} {dvsaReport.model} ({dvsaReport.engineSize}cc •{' '}
                    {dvsaReport.primaryColour})
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-300">
                  MOT Exp: <strong>{dvsaReport.motTests[0].expiryDate || 'N/A'}</strong> • Odo:{' '}
                  <strong>
                    {Number(dvsaReport.motTests[0].odometerValue).toLocaleString()}{' '}
                    {dvsaReport.motTests[0].odometerUnit}
                  </strong>
                </span>
              </div>

              {dvsaReport.motTests[0].defects && dvsaReport.motTests[0].defects.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-emerald-500/30">
                  <span className="text-[11px] font-bold uppercase text-amber-300 block">
                    🔍 Advisories / Falhas Registradas no Último MOT da Placa {dvsaReport.registration}:
                  </span>
                  {dvsaReport.motTests[0].defects.map((def, idx) => (
                    <div
                      key={idx}
                      className="text-xs bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2"
                    >
                      <span className="text-slate-200">
                        <strong
                          className={
                            def.type === 'ADVISORY' ? 'text-amber-400' : 'text-red-400'
                          }
                        >
                          [{def.type}]
                        </strong>{' '}
                        {def.text}
                      </span>
                    </div>
                  ))}

                  {dvsaReport.recommendedServiceIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedServiceIds((prev) =>
                          Array.from(new Set([...prev, ...dvsaReport.recommendedServiceIds]))
                        );
                      }}
                      className="mt-2 w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isPt
                        ? `Orçar Reparo desses Advisories do MOT em 1 Clique (+${dvsaReport.recommendedServiceIds.length} serviços)`
                        : `Add Recommended MOT Advisory Repairs in 1-Click (+${dvsaReport.recommendedServiceIds.length} jobs)`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Interactive Scottish / UK Vehicle Technical Database Browser */}
          {showUkDatabaseDrawer && (
            <div className="mb-5 bg-slate-950 border-2 border-amber-500/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  🏴󠁧󠁢󠁳󠁣󠁴󠁿{' '}
                  {isPt
                    ? 'Selecione o Carro/Motor (Preenche Óleo OEM, Litros, Torques e Complexidade Automaticamente)'
                    : 'Select UK Vehicle Spec (Auto-fills OEM Oil, Capacity, Torques & Complexity Flags)'}
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
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={ukDbSearchQuery}
                  onChange={(e) => setUkDbSearchQuery(e.target.value)}
                  placeholder={
                    isPt
                      ? 'Buscar carro/motor na Escócia (ex: Fiesta EcoBoost, Corsa 1.4, Golf TDI, Prius Uber, PureTech, BMW 320d)...'
                      : 'Search UK car/engine (e.g. Fiesta EcoBoost, Corsa 1.4, Golf TDI, Prius Hybrid, PureTech, BMW 320d)...'
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredUkDatabase.map((spec) => (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => handleSelectUkTechSpec(spec)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      activeTechSpec?.id === spec.id
                        ? 'bg-amber-500/20 border-amber-400'
                        : 'bg-slate-900/90 border-slate-800 hover:border-amber-500/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-white">
                          {spec.make} {spec.model}
                        </span>
                        <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-amber-300">
                          {spec.yearsRange}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-amber-400 mt-0.5">
                        {spec.engineLabel}
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-300">
                      <span>
                        🛢️ {spec.oilViscosity} ({spec.oilCapacityLitres}L)
                      </span>
                      <span>🔩 Roda: {spec.wheelNutTorqueNm}Nm</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Vehicle Technical Data Sheet Banner */}
          {activeTechSpec && (
            <div className="mb-4 bg-slate-950/90 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4" />
                  {isPt ? 'Ficha Técnica de Bancada UK:' : 'UK Workshop Technical Spec Sheet:'}{' '}
                  <strong className="text-white">
                    {activeTechSpec.make} {activeTechSpec.model} — {activeTechSpec.engineCode}
                  </strong>
                </span>
                <a
                  href={buildGovUkMotHistoryUrl(vrm)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  GOV.UK MOT History ({vrm}) <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Óleo &amp; Norma OEM</span>
                  <span className="text-amber-300 font-bold">{activeTechSpec.oilViscosity}</span>
                </div>
                <div className="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Capacidade Cárter</span>
                  <span className="text-emerald-400 font-bold">
                    {activeTechSpec.oilCapacityLitres} Litros
                  </span>
                </div>
                <div className="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Torque Bujão (Sump)</span>
                  <span className="text-white font-bold">{activeTechSpec.sumpPlugTorqueNm} Nm</span>
                </div>
                <div className="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Torque Roda (Wheel)</span>
                  <span className="text-white font-bold">{activeTechSpec.wheelNutTorqueNm} Nm</span>
                </div>
              </div>

              <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 leading-relaxed">
                ⚠️ <strong>{isPt ? 'Dica de Box:' : 'Mechanic Note:'}</strong>{' '}
                {isPt ? activeTechSpec.mechanicNotesPt : activeTechSpec.mechanicNotesEn}
              </p>
            </div>
          )}

          {/* Vehicle Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold">Make / Marca</label>
              <input
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="w-full mt-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-semibold"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Model / Modelo</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full mt-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-semibold"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Engine / Motor</label>
              <input
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                className="w-full mt-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-semibold"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Oil Spec + Litros</label>
              <input
                value={oilSpec}
                onChange={(e) => setOilSpec(e.target.value)}
                className="w-full mt-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-300 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                {isPt ? 'Nome do Cliente' : 'Customer Name'}
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full mt-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">WhatsApp (+44)</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full mt-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">Mileage (Milhas)</label>
              <input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(Number(e.target.value))}
                className="w-full mt-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>

          {/* Vehicle Technical Risk Flags */}
          <div className="pt-3 border-t border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              {isPt
                ? 'Flags de Complexidade deste Carro (Ajustam Tempo & Preço Automaticamente)'
                : 'Vehicle Complexity Flags (Auto-Adjust Time & Surcharges)'}
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  key: 'hasEPB' as const,
                  labelPt: 'Freio Eletrônico (EPB Scanner)',
                  labelEn: 'Electronic Parking Brake (EPB)',
                },
                {
                  key: 'hasComplexUndertray' as const,
                  labelPt: 'Protetor de Cárter Pesado',
                  labelEn: 'Complex Undertray / Shield',
                },
                {
                  key: 'difficultOilFilter' as const,
                  labelPt: 'Filtro Difícil Acesso',
                  labelEn: 'Difficult Oil Filter Access',
                },
                {
                  key: 'dieselFilterPriming' as const,
                  labelPt: 'Diesel (Requer Sangria Launch)',
                  labelEn: 'Diesel Fuel Priming Required',
                },
                {
                  key: 'scottishRustRisk' as const,
                  labelPt: 'Risco Ferrugem Sal Escocês',
                  labelEn: 'Scottish Salt Rust Surcharge Risk',
                },
              ].map((item) => {
                const active = Boolean(flags[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleFlag(item.key)}
                    className={`min-h-[42px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
                      active
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-900/70 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-3.5 h-3.5 ${active ? 'text-amber-400' : 'text-slate-500'}`}
                    />
                    {isPt ? item.labelPt : item.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Step 2: Encyclopedic Labour-Only Service Catalog (31+ Services with Search & Categories) */}
        <section className="bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                2.{' '}
                {isPt
                  ? `Tabela Completa de Mão de Obra (${db.serviceCatalog.length} Serviços)`
                  : `Complete Labour-Only Service Menu (${db.serviceCatalog.length} Services)`}
              </span>
              <h2 className="text-lg font-extrabold text-white">
                {isPt
                  ? 'Qualquer Trampo: Preço Só do Serviço, Complexidade & Tempo Real'
                  : 'All Workshop Jobs: Pure Labour Price, Complexity & Bay Time'}
              </h2>
            </div>
            <span className="text-xs font-mono bg-slate-900 px-3 py-1 rounded-full text-amber-400 border border-slate-700">
              {selectedServiceIds.length} {isPt ? 'selecionados' : 'selected'}
            </span>
          </div>

          {/* Search & Category Filter Pills */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={serviceSearchQuery}
                onChange={(e) => setServiceSearchQuery(e.target.value)}
                placeholder={
                  isPt
                    ? 'Pesquisar qualquer serviço (ex: mola, bandeja, bieleta, alternador, cubo, freio, termostática, DPF)...'
                    : 'Search any job (e.g. wishbone, coil spring, drop links, wheel bearing, alternator, caliper, DPF)...'
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedCategory === 'ALL'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
                }`}
              >
                {isPt ? 'Todos' : 'All'} ({db.serviceCatalog.length})
              </button>
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
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
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-100 leading-snug">
                        {isPt ? srv.namePt : srv.nameEn}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded font-mono text-sm font-black shrink-0 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-amber-400'
                        }`}
                      >
                        £{srv.basePriceGbp}
                      </span>
                    </div>

                    {srv.partsCustomerShouldBringPt && (
                      <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">
                        🛒{' '}
                        {isPt
                          ? srv.partsCustomerShouldBringPt
                          : srv.partsCustomerShouldBringEn}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] w-full">
                    <span
                      className={`px-2 py-0.5 rounded border font-extrabold text-[10px] ${badge.classes}`}
                    >
                      {isPt ? badge.labelPt : badge.labelEn}
                    </span>
                    <div className="font-mono text-slate-300">
                      <span>Box: {srv.estimatedMinutes}m</span>
                      <span className="mx-1 text-slate-600">|</span>
                      <span className="text-emerald-400 font-bold">
                        Cliente: ~{totalWithBuffer}m
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 3: Complexity Modifiers & Smart Combos */}
        <section className="bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            3. {t(uiLang, 'recommendedModifiers')}
          </span>
          <h2 className="text-lg font-extrabold text-white mb-4">
            {isPt
              ? 'Adicionais de Dificuldade / Ferrugem & Desconto de Pacote'
              : 'Complexity Surcharges & Multi-Job Combo Discount'}
          </h2>

          <div className="space-y-2.5 mb-5">
            {db.modifiersCatalog.map((mod) => {
              const active = selectedModifierIds.includes(mod.id);
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => toggleModifier(mod.id)}
                  className={`w-full min-h-[50px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-left transition ${
                    active
                      ? 'bg-red-950/40 border-red-500 text-red-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert
                      className={`w-4 h-4 shrink-0 ${active ? 'text-red-400' : 'text-slate-500'}`}
                    />
                    <span className="text-sm font-semibold">
                      {isPt ? mod.namePt : mod.nameEn}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <span className="text-xs text-slate-400">+{mod.extraMinutes}m</span>
                    <span
                      className={`text-sm font-extrabold ${
                        active ? 'text-red-400' : 'text-slate-400'
                      }`}
                    >
                      +£{mod.surchargeGbp.toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 1-Click Combo & Diagnostic Rule Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              disabled={!calculation.isComboEligible}
              onClick={() => setApplyComboDiscount((v) => !v)}
              className={`min-h-[52px] px-4 py-2.5 rounded-xl border font-bold text-xs sm:text-sm flex items-center justify-between transition ${
                !calculation.isComboEligible
                  ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                  : applyComboDiscount
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                {t(uiLang, 'comboAvailable')}
              </span>
              <span className="font-mono font-extrabold">-£5.00</span>
            </button>

            <button
              type="button"
              disabled={!calculation.isDiagnosticRepairEligible}
              onClick={() => setApplyDiagnosticDiscount((v) => !v)}
              className={`min-h-[52px] px-4 py-2.5 rounded-xl border font-bold text-xs sm:text-sm flex items-center justify-between transition ${
                !calculation.isDiagnosticRepairEligible
                  ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                  : applyDiagnosticDiscount
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {t(uiLang, 'diagRuleAvailable')}
              </span>
              <span className="font-mono font-extrabold">-£10.00</span>
            </button>
          </div>
        </section>
      </div>

      {/* Right 5 Cols: Drop-Off & Ready Time Scheduler + Parts Checklist for Customer + WhatsApp Quote */}
      <div className="lg:col-span-5 space-y-6">
        {/* Drop-Off Slot & Turnaround Time Promise Calculator ("Leva tal horário que faço em tanto tempo!") */}
        <section className="bg-gradient-to-br from-[#161F30] to-[#0F172A] border-2 border-emerald-500/70 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {isPt
                  ? 'CALCULADORA DE HORÁRIO & ENTREGA AO CLIENTE'
                  : 'DROP-OFF & COLLECTION PROMISE CALCULATOR'}
              </span>
              <h3 className="text-lg font-black text-white mt-0.5">
                {isPt
                  ? '"Traz tal horário que te entrego pronto às..."'
                  : '"Drop off at X, ready for collection at Y"'}
              </h3>
            </div>
            <span
              className={`px-2.5 py-1 rounded border text-xs font-black ${
                COMPLEXITY_BADGE_STYLES[calculation.overallComplexity].classes
              }`}
            >
              {isPt
                ? COMPLEXITY_BADGE_STYLES[calculation.overallComplexity].labelPt
                : COMPLEXITY_BADGE_STYLES[calculation.overallComplexity].labelEn}
            </span>
          </div>

          {/* Date & Drop-off Time Picker Pills */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs text-slate-300 font-bold">
                📅 {isPt ? 'Data do Agendamento:' : 'Booking Date:'}
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-slate-900 border border-emerald-500/60 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-bold block mb-2">
                ⏰{' '}
                {isPt
                  ? 'Que horas o cliente vai deixar o carro?'
                  : 'Select Customer Drop-Off Time:'}
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
                      className={`py-2 rounded-lg font-mono text-xs font-black border transition relative ${
                        dropOffSlot === slot
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                          : isSlotBusy
                          ? 'bg-amber-950/60 text-amber-300 border-amber-600/60'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {slot}
                      {isSlotBusy && (
                        <span
                          title={isPt ? 'Já possui carro agendado neste horário' : 'Slot has booking'}
                          className="block text-[8px] uppercase text-amber-400 leading-none mt-0.5"
                        >
                          Ocupado
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Real Mechanic Time vs Safe Customer Promise Time */}
          <div className="grid grid-cols-3 gap-2.5 bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 text-center">
            <div>
              <span className="text-[11px] text-slate-400 block">
                {isPt ? 'Seu Tempo de Box' : 'Your Bay Time'}
              </span>
              <span className="text-lg font-black font-mono text-amber-400">
                ~{calculation.totalEstimatedMinutes} min
              </span>
            </div>
            <div className="border-x border-slate-800 px-2">
              <span className="text-[11px] text-slate-400 block">
                {isPt ? 'Prazo c/ Margem' : 'Promised Window'}
              </span>
              <span className="text-lg font-black font-mono text-white">
                ~{calculation.customerPromisedMinutes} min
              </span>
            </div>
            <div>
              <span className="text-[11px] text-emerald-400 font-bold block">
                {isPt ? 'Pronto às' : 'Ready By'}
              </span>
              <span className="text-xl font-black font-mono text-emerald-400">
                {calculation.promisedReadyTime}
              </span>
            </div>
          </div>

          {/* Exact Shopping List of Parts the Customer Needs to Bring */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4" />
                {isPt
                  ? 'Peças que o Cliente Precisa Trazer:'
                  : 'Parts Customer Needs to Bring:'}
              </span>
              <div className="flex gap-1.5">
                <a
                  href={buildEuroCarPartsUrl(vrm)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-0.5"
                >
                  EuroCarParts <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-slate-600">|</span>
                <a
                  href={buildAutodocUkUrl(make, model, engine)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-orange-400 hover:underline flex items-center gap-0.5"
                >
                  Autodoc <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <ul className="space-y-1 text-xs text-slate-200">
              {selectedServices.map((s) => (
                <li key={s.id} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>
                    {isPt
                      ? s.partsCustomerShouldBringPt
                      : s.partsCustomerShouldBringEn}
                  </span>
                </li>
              ))}
              {oilSpec && (
                <li className="flex items-start gap-1.5 text-amber-300 font-mono text-[11px] pt-1 border-t border-slate-800/80">
                  <span>🛢️</span>
                  <span>Spec Motor: {oilSpec}</span>
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* Live Pure Labour Price & Hourly Yield Summary */}
        <section className="bg-[#161F30] border-2 border-amber-500/60 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                100% LABOUR-ONLY PROFIT HUD
              </span>
              <h3 className="text-xl font-black text-white">
                {isPt
                  ? 'Preço Só do Serviço & Seu Ganho/Hora'
                  : 'Pure Labour Price & Your Hourly Yield'}
              </h3>
            </div>
            <UkPlateBadge vrm={vrm} size="sm" />
          </div>

          <div className="space-y-2 text-sm border-t border-b border-slate-800 py-3 my-3">
            <div className="flex justify-between text-slate-300">
              <span>{isPt ? 'Soma dos Serviços Base' : 'Base Services Labour'}</span>
              <span className="font-mono">£{calculation.baseServicesGbp.toFixed(2)}</span>
            </div>
            {calculation.modifiersTotalGbp > 0 && (
              <div className="flex justify-between text-red-300">
                <span>
                  {isPt ? 'Adicionais de Complexidade / Acesso' : 'Complexity Modifiers'}
                </span>
                <span className="font-mono">+£{calculation.modifiersTotalGbp.toFixed(2)}</span>
              </div>
            )}
            {calculation.comboDiscountGbp > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>{isPt ? 'Desconto Combo (2+ Serviços)' : 'Combo Discount (2+ Jobs)'}</span>
                <span className="font-mono">-£{calculation.comboDiscountGbp.toFixed(2)}</span>
              </div>
            )}
            {calculation.diagnosticDiscountGbp > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>
                  {isPt ? 'Crédito Diagnóstico c/ Reparo' : 'Diagnostic + Repair Credit'}
                </span>
                <span className="font-mono">-£{calculation.diagnosticDiscountGbp.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex items-end justify-between mb-5">
            <div>
              <span className="text-xs uppercase font-bold text-slate-400 block">
                {t(uiLang, 'projectedHourlyRate')}
              </span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                £{calculation.projectedHourlyRateGbp.toFixed(2)}/h
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase font-bold text-amber-400 block">
                {isPt ? 'Mão de Obra Final (100% Lucro)' : 'Total Labour To Charge'}
              </span>
              <span className="text-3xl font-black font-mono text-white">
                £{calculation.labourTotalGbp.toFixed(2)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateWorkOrder}
            className="w-full min-h-[52px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 shadow-lg transition text-base"
          >
            <Wrench className="w-5 h-5" />
            {t(uiLang, 'createWorkOrder')} ({calculation.dropOffSlot} →{' '}
            {calculation.promisedReadyTime})
          </button>

          {orderCreatedBanner && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs font-bold flex items-center justify-between">
              <span>
                ✓ {isPt ? 'Ordem Criada:' : 'Work Order Created:'} #{orderCreatedBanner}
              </span>
              <button
                type="button"
                onClick={onNavigateToOrders}
                className="underline text-amber-300 hover:text-amber-200"
              >
                {isPt ? 'Abrir no Cronômetro →' : 'Open Bay Stopwatch →'}
              </button>
            </div>
          )}
        </section>

        {/* 1-Click WhatsApp Quote Generator */}
        <section className="bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              4. WhatsApp Quote (Preço + Horário + Lista de Peças)
            </span>

            {/* Independent Document Language Selector */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setDocLang('PT-BR')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                  docLang === 'PT-BR'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇧🇷 PT-BR (Brasileiros)
              </button>
              <button
                type="button"
                onClick={() => setDocLang('EN-GB')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                  docLang === 'EN-GB'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇬🇧 EN-GB (Scots/UK)
              </button>
            </div>
          </div>

          <pre className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto">
            {whatsappMessage}
          </pre>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="min-h-[48px] bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm border border-slate-700 transition"
            >
              {copiedToast ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  {isPt ? 'Copiado!' : 'Copied!'}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  {t(uiLang, 'copyWhatsApp')}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="min-h-[48px] bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 text-sm shadow transition"
            >
              <Send className="w-4 h-4" />
              {t(uiLang, 'openWhatsApp')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

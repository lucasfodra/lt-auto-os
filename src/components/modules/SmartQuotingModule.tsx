import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
  onOrderCreated?: () => void;
  onOpenSettings?: () => void;
}

const TIME_SLOTS = [
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

function addMinutesToTimeSlot(slot: string, minutesToAdd: number): string {
  const [hh, mm] = slot.split(':').map(Number);
  const totalMin = hh * 60 + mm + minutesToAdd;
  const finalH = Math.floor(totalMin / 60) % 24;
  const finalM = totalMin % 60;
  const roundedM = Math.ceil(finalM / 5) * 5;
  const adjH = roundedM === 60 ? (finalH + 1) % 24 : finalH;
  const adjM = roundedM === 60 ? 0 : roundedM;
  return `${String(adjH).padStart(2, '0')}:${String(adjM).padStart(2, '0')}`;
}

const COMPLEXITY_BADGE_MAP: Record<
  ComplexityTier,
  { labelPt: string; labelEn: string; classes: string }
> = {
  EASY: {
    labelPt: 'FÁCIL',
    labelEn: 'EASY',
    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  },
  MEDIUM: {
    labelPt: 'MÉDIO',
    labelEn: 'MEDIUM',
    classes: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  },
  HARD: {
    labelPt: 'DIFÍCIL',
    labelEn: 'HARD',
    classes: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  },
  EXTREME: {
    labelPt: 'PESADO',
    labelEn: 'EXTREME',
    classes: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
};

const QUICK_PLATES = ['SG09 ZNJ', 'SH64 WRF', 'DV66 UKB', 'SO18 XZP', 'RF15 KLM', 'GM17 VWA'];

export const SmartQuotingModule: React.FC<SmartQuotingModuleProps> = ({
  onOrderCreated,
  onOpenSettings,
}) => {
  const { db, uiLang, docLang, setDocLang, createWorkOrderFromQuote } = useApp();
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
  const [showWhatsappPreview, setShowWhatsappPreview] = useState(false);

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
    } else {
      // Plate is NOT in CRM -> Clear previous customer name & phone so Matheus Oliveira never sticks!
      setCustomerName('');
      setCustomerPhone('');

      const spec = dvsaData.matchedTechSpec || UK_VEHICLE_SPECS_DB[0];
      setActiveTechSpec(spec);
      setMake(dvsaData.make);
      setModel(dvsaData.model);
      setEngine(
        dvsaData.engineSize
          ? `${spec.engineLabel} (${dvsaData.engineSize}cc)`
          : spec.engineLabel
      );
      setFuelType(dvsaData.fuelType);
      setOilSpec(`${spec.oilViscosity} ${spec.oilOemSpec} (${spec.oilCapacityLitres}L)`);
      setFlags(spec.flags);

      const latestOdo = parseInt(dvsaData.motTests?.[0]?.odometerValue || '0', 10);
      if (latestOdo > 0) setMileage(latestOdo);

      if (dvsaData.firstUsedDate) {
        const parsedYear = parseInt(dvsaData.firstUsedDate.slice(0, 4), 10);
        if (!Number.isNaN(parsedYear)) setYear(parsedYear);
      } else {
        const decoded = decodeUkPlateYear(targetVrm);
        if (decoded.year) setYear(decoded.year);
      }

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

  const selectedServices = useMemo(
    () => db.serviceCatalog.filter((s) => selectedServiceIds.includes(s.id)),
    [db.serviceCatalog, selectedServiceIds]
  );

  const selectedModifiers = useMemo(
    () => db.complexityModifiers.filter((m) => selectedModifierIds.includes(m.id)),
    [db.complexityModifiers, selectedModifierIds]
  );

  const breakdown = useMemo(
    () =>
      calculateSmartQuote({
        selectedServices,
        selectedModifiers,
        applyComboDiscount,
        applyDiagnosticDiscount,
        partsMode: 'CUSTOMER_SUPPLIES',
        partsCostGbp: 0,
        partsMarkupPercent: 0,
      }),
    [selectedServices, selectedModifiers, applyComboDiscount, applyDiagnosticDiscount]
  );

  const promisedCustomerMinutes = useMemo(() => {
    const rawBuffer = selectedServices.reduce(
      (acc, s) => acc + (s.customerBufferMinutes || 15),
      0
    );
    const total = breakdown.estimatedTotalMinutes + Math.min(rawBuffer, 60);
    return Math.ceil(total / 15) * 15;
  }, [selectedServices, breakdown.estimatedTotalMinutes]);

  const promisedReadyTime = useMemo(
    () => addMinutesToTimeSlot(dropOffSlot, promisedCustomerMinutes),
    [dropOffSlot, promisedCustomerMinutes]
  );

  const whatsappMessage = useMemo(() => {
    const baseMsg = generateWhatsAppQuoteText({
      docLang,
      customerName: customerName || (docLang === 'PT-BR' ? 'Cliente' : 'Customer'),
      vrm,
      make,
      model,
      year,
      engine,
      oilSpec,
      selectedServices,
      selectedModifiers,
      breakdown,
      partsMode: 'CUSTOMER_SUPPLIES',
    });

    const partsChecklist = selectedServices
      .map((s) =>
        docLang === 'PT-BR' ? s.partsCustomerShouldBringPt : s.partsCustomerShouldBringEn
      )
      .filter(Boolean);

    const scheduleBlockPt = `\n📅 *Agendamento & Prazo de Entrega:*\n• Data: *${scheduledDate}* | Deixar às: *${dropOffSlot}*\n• Previsão de Carro Pronto: *~${promisedReadyTime}* (${promisedCustomerMinutes} min)\n${
      partsChecklist.length > 0
        ? `\n📦 *Peças para Você Trazer (Euro Car Parts / Autodoc):*\n${partsChecklist
            .map((p) => `  • ${p}`)
            .join('\n')}`
        : ''
    }`;

    const scheduleBlockEn = `\n📅 *Booking & Promised Collection Time:*\n• Date: *${scheduledDate}* | Drop-off: *${dropOffSlot}*\n• Estimated Ready Time: *~${promisedReadyTime}* (${promisedCustomerMinutes} mins)\n${
      partsChecklist.length > 0
        ? `\n📦 *Parts For Customer To Supply (Euro Car Parts / Autodoc):*\n${partsChecklist
            .map((p) => `  • ${p}`)
            .join('\n')}`
        : ''
    }`;

    return `${baseMsg}\n${docLang === 'PT-BR' ? scheduleBlockPt : scheduleBlockEn}`;
  }, [
    docLang,
    customerName,
    vrm,
    make,
    model,
    year,
    engine,
    oilSpec,
    selectedServices,
    selectedModifiers,
    breakdown,
    scheduledDate,
    dropOffSlot,
    promisedReadyTime,
    promisedCustomerMinutes,
  ]);

  const handleCopyWhatsApp = async () => {
    await navigator.clipboard.writeText(whatsappMessage);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  const handleOpenWhatsAppDirect = () => {
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(whatsappMessage);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  const handleCreateWorkOrder = () => {
    if (selectedServices.length === 0) return;
    const wo = createWorkOrderFromQuote({
      vrm,
      make,
      model,
      year,
      engine,
      fuelType,
      oilSpec,
      mileage,
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || '+447700000000',
      preferredLanguage: docLang,
      flags,
      serviceIds: selectedServiceIds,
      modifierIds: selectedModifierIds,
      applyComboDiscount,
      applyDiagnosticDiscount,
      partsMode: 'CUSTOMER_SUPPLIES',
      partsCostGbp: 0,
      partsMarkupPercent: 0,
      scheduledDate,
      scheduledTimeSlot: dropOffSlot,
      promisedReadyTime,
    });

    setOrderCreatedBanner(
      isPt
        ? `OS criada para ${wo.vrm} (${scheduledDate} • ${dropOffSlot} → ${promisedReadyTime})`
        : `Booked ${wo.vrm} (${scheduledDate} • ${dropOffSlot} → ${promisedReadyTime})`
    );
    setTimeout(() => {
      setOrderCreatedBanner(null);
      if (onOrderCreated) onOrderCreated();
    }, 1100);
  };

  const busySlotsOnSelectedDate = useMemo(
    () =>
      db.workOrders
        .filter((w) => w.scheduledDate === scheduledDate && w.status !== 'Paid')
        .map((w) => w.scheduledTimeSlot),
    [db.workOrders, scheduledDate]
  );

  return (
    <div className="space-y-4">
      {/* =====================================================================
          1. SLEEK TELEMETRY COMMAND BAR (PLATE + DVSA + CAR SPECS)
      ===================================================================== */}
      <section className="glass-panel rounded-2xl p-4 shadow-2xl space-y-3.5">
        {/* Top Row: UK Plate Input + Action Buttons + Quick Plates + Torque Telemetry */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <UkPlateBadge vrm={vrm} editable onChange={setVrm} size="md" />

            <button
              type="button"
              onClick={() => handleLookupVrm(vrm)}
              disabled={loadingDvsa}
              className="h-11 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              {loadingDvsa
                ? isPt
                  ? 'Consultando DVSA...'
                  : 'Querying DVSA...'
                : isPt
                ? 'Consultar Placa (DVSA)'
                : 'Lookup VRM (DVSA)'}
            </button>

            <button
              type="button"
              onClick={() => setShowUkDatabaseDrawer((prev) => !prev)}
              className={`h-11 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
                showUkDatabaseDrawer
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/[0.08] text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              {isPt ? 'Catálogo UK (23 Motores)' : 'UK Spec Catalog (23)'}
            </button>

            {/* Quick Plate Chips */}
            <div className="flex flex-wrap items-center gap-1 pl-1 border-l border-white/[0.08]">
              {QUICK_PLATES.map((sample) => {
                const isSelected =
                  vrm.replace(/\s+/g, '').toUpperCase() ===
                  sample.replace(/\s+/g, '').toUpperCase();
                return (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setVrm(sample);
                      handleLookupVrm(sample);
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition border cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-white/[0.06]'
                    }`}
                  >
                    {sample}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Live Torque & Spec Telemetry Strip */}
          {activeTechSpec && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 border border-white/[0.06] rounded-xl px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 pr-2.5 border-r border-white/[0.07]">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400 text-[11px]">Bujão:</span>
                <span className="font-mono font-black text-white">
                  {activeTechSpec.sumpPlugTorqueNm} Nm
                </span>
              </div>
              <div className="flex items-center gap-1.5 pr-2.5 border-r border-white/[0.07]">
                <span className="text-slate-400 text-[11px]">Roda:</span>
                <span className="font-mono font-black text-white">
                  {activeTechSpec.wheelNutTorqueNm} Nm
                </span>
              </div>
              <div className="flex items-center gap-1.5 pr-2.5 border-r border-white/[0.07]">
                <span className="text-slate-400 text-[11px]">Cárter:</span>
                <span className="font-mono font-black text-emerald-400">
                  {activeTechSpec.oilCapacityLitres}L ({activeTechSpec.oilViscosity})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Odômetro:</span>
                <span className="font-mono font-bold text-amber-300">
                  {mileage.toLocaleString()} mi
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible UK Vehicle Spec Drawer */}
        {showUkDatabaseDrawer && (
          <div className="bg-slate-950/95 border border-amber-500/30 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                {isPt
                  ? 'Selecione o Carro / Motorização da Escócia (Preenche Óleo OEM & Torques)'
                  : 'Select UK Vehicle & Engine Spec'}
              </span>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  value={ukDbSearchQuery}
                  onChange={(e) => setUkDbSearchQuery(e.target.value)}
                  placeholder={isPt ? 'Filtrar (ex: Megane, Focus, Corsa)...' : 'Filter car...'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
              {filteredUkDatabase.map((spec) => {
                const isSelected = activeTechSpec?.id === spec.id;
                return (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => handleSelectUkTechSpec(spec)}
                    className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 text-white'
                        : 'bg-slate-900/80 border-white/[0.06] hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-extrabold text-white truncate">
                        {spec.make} {spec.model}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                        {spec.oilViscosity}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-semibold truncate mt-0.5">
                      {spec.engineLabel}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {spec.oilCapacityLitres}L • {spec.sumpPlugTorqueNm}Nm / {spec.wheelNutTorqueNm}Nm
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 2: Compact Editable Vehicle & Customer Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-2.5 pt-1 border-t border-white/[0.06]">
          <div className="lg:col-span-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {isPt ? 'Veículo & Ano' : 'Vehicle & Year'}
            </label>
            <input
              value={`${make} ${model} (${year})`}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-9 bg-slate-950/90 border border-white/[0.08] focus:border-amber-500/60 rounded-lg px-2.5 text-xs text-white font-bold focus:outline-none"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {isPt ? 'Motorização & Cilindrada' : 'Engine & CC'}
            </label>
            <input
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="w-full h-9 bg-slate-950/90 border border-white/[0.08] focus:border-amber-500/60 rounded-lg px-2.5 text-xs text-emerald-300 font-bold focus:outline-none"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {isPt ? 'Norma do Óleo & Litros' : 'OEM Oil Spec & Litres'}
            </label>
            <input
              value={oilSpec}
              onChange={(e) => setOilSpec(e.target.value)}
              className="w-full h-9 bg-slate-950/90 border border-white/[0.08] focus:border-amber-500/60 rounded-lg px-2.5 text-xs text-amber-300 font-mono font-bold focus:outline-none"
            />
          </div>
          <div className="lg:col-span-3 flex gap-1.5 items-end">
            <a
              href={buildGovUkMotHistoryUrl(vrm)}
              target="_blank"
              rel="noreferrer"
              className="h-9 flex-1 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] rounded-lg px-2.5 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1.5 transition"
            >
              🇬🇧 GOV.UK MOT <ExternalLink className="w-3 h-3 text-amber-400" />
            </a>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="h-9 px-2.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] rounded-lg text-[11px] font-bold text-amber-400 flex items-center gap-1 transition cursor-pointer"
                title="Configurar Credenciais API DVSA"
              >
                <KeyRound className="w-3.5 h-3.5" />
                API
              </button>
            )}
          </div>
        </div>

        {/* Mechanic Note Callout (1-Line Sleek Strip) */}
        {activeTechSpec && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-[11px] text-amber-200/90">
            <span className="truncate">
              🔧 <strong>{isPt ? 'Dica de Box:' : 'Workshop Note:'}</strong>{' '}
              {isPt ? activeTechSpec.mechanicNotesPt : activeTechSpec.mechanicNotesEn}
            </span>
          </div>
        )}

        {/* Official DVSA MOT Advisories & Failures Telemetry Banner */}
        {dvsaReport && dvsaReport.motTests && dvsaReport.motTests[0] && (
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-slate-950/90 border border-emerald-500/30 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-extrabold">
                  {dvsaReport.source === 'DVSA_LIVE_API' ? '🟢 DVSA OFFICIAL RECORD' : '📘 UK VRM DECODER'}
                </span>
                <span className="text-xs font-black text-white">
                  {dvsaReport.registration} — {dvsaReport.make} {dvsaReport.model}{' '}
                  {dvsaReport.primaryColour ? `(${dvsaReport.primaryColour})` : ''}
                </span>
                <span className="text-xs font-mono text-slate-300">
                  • MOT Exp: <strong className="text-emerald-400">{dvsaReport.motTests[0].expiryDate}</strong>
                </span>
                <span className="text-xs font-mono text-amber-300">
                  • {Number(dvsaReport.motTests[0].odometerValue).toLocaleString()}{' '}
                  {dvsaReport.motTests[0].odometerUnit.toLowerCase()}
                </span>
              </div>

              {(dvsaReport.motTests[0].defects || []).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
                  {(dvsaReport.motTests[0].defects || []).map((def, i) => (
                    <div key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                      <span
                        className={`text-[9px] font-mono font-extrabold px-1 py-0.2 rounded shrink-0 mt-0.5 ${
                          def.type === 'MAJOR' || def.type === 'FAIL' || def.type === 'DANGEROUS'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {def.type}
                      </span>
                      <span className="leading-tight">{def.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {dvsaReport.recommendedServiceIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedServiceIds((prev) =>
                    Array.from(new Set([...prev, ...dvsaReport.recommendedServiceIds]))
                  );
                }}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isPt
                  ? `+ Orçar Reparos do MOT (${dvsaReport.recommendedServiceIds.length})`
                  : `+ Quote MOT Repairs (${dvsaReport.recommendedServiceIds.length})`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* =====================================================================
          2. MAIN 2-COLUMN COCKPIT (LEFT: SERVICE MATRIX | RIGHT: STICKY CHECKOUT)
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (7 COLS): SERVICE MATRIX & COMPLEXITY MODIFIERS */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Service Catalog Card */}
          <section className="glass-panel rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  {isPt
                    ? `1. Catálogo de Mão de Obra (${db.serviceCatalog.length} Serviços)`
                    : `1. Labour-Only Service Matrix (${db.serviceCatalog.length} Services)`}
                </h2>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  placeholder={
                    isPt ? 'Buscar óleo, pastilha, disco, mola...' : 'Search service...'
                  }
                  className="w-full h-8 bg-slate-950/90 border border-white/[0.08] focus:border-amber-500 rounded-lg pl-8 pr-3 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-white/[0.06]'
                }`}
              >
                {isPt ? `Todos (${db.serviceCatalog.length})` : `All (${db.serviceCatalog.length})`}
              </button>
              {categoriesList.map((cat) => {
                const count = db.serviceCatalog.filter((s) => s.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-white/[0.06]'
                    }`}
                  >
                    {cat} <span className="opacity-60 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* High-Density 2-Column Service Grid (No ugly inner scrollbar!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              {filteredServiceCatalog.map((srv) => {
                const active = selectedServiceIds.includes(srv.id);
                const tier = srv.complexityTier || 'EASY';
                const badge = COMPLEXITY_BADGE_MAP[tier];
                const custTime = srv.estimatedMinutes + (srv.customerBufferMinutes || 15);

                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => toggleService(srv.id)}
                    className={`group text-left p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-2 cursor-pointer ${
                      active
                        ? 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-slate-900/90 border-amber-400/80 shadow-md shadow-amber-500/5'
                        : 'bg-slate-950/60 border-white/[0.06] hover:border-white/[0.15] hover:bg-slate-900/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5 w-full">
                      <div className="flex items-start gap-2 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center shrink-0 border transition ${
                            active
                              ? 'bg-amber-500 border-amber-400 text-slate-950'
                              : 'border-slate-700 bg-slate-900 group-hover:border-slate-500'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span
                          className={`font-bold text-xs leading-snug ${
                            active ? 'text-white' : 'text-slate-200 group-hover:text-white'
                          }`}
                        >
                          {isPt ? srv.namePt : srv.nameEn}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-lg font-mono font-black text-xs shrink-0 ${
                          active
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-slate-900 text-amber-400 border border-white/[0.06]'
                        }`}
                      >
                        £{srv.basePriceGbp}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 w-full pl-6 text-[10px]">
                      <span
                        className={`px-1.5 py-0.5 rounded border font-extrabold ${badge.classes}`}
                      >
                        {isPt ? badge.labelPt : badge.labelEn}
                      </span>
                      <span className="text-slate-400 font-mono">
                        Box: <strong className="text-slate-200">{srv.estimatedMinutes}m</strong> •
                        Cliente: <strong className="text-emerald-400">~{custTime}m</strong>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Complexity Surcharges & Combo Discounts */}
          <section className="glass-panel rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              {isPt
                ? '2. Adicionais de Complexidade & Descontos Automáticos'
                : '2. Complexity Surcharges & Smart Discounts'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {db.complexityModifiers.map((mod) => {
                const active = selectedModifierIds.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModifier(mod.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                      active
                        ? 'bg-amber-500/15 border-amber-500/60 text-white'
                        : 'bg-slate-950/60 border-white/[0.06] text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {isPt ? mod.namePt : mod.nameEn}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        +{mod.addedMinutes} min box
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-xs shrink-0">
                      +£{mod.surchargeGbp}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setApplyComboDiscount((v) => !v)}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                  applyComboDiscount && selectedServices.length >= 2
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                    : 'bg-slate-950/60 border-white/[0.06] text-slate-400'
                }`}
              >
                <span className="text-xs font-bold">{t('comboDiscountLabel', uiLang)}</span>
                <span className="font-mono font-black text-xs text-emerald-400">-£5.00</span>
              </button>

              <button
                type="button"
                onClick={() => setApplyDiagnosticDiscount((v) => !v)}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                  applyDiagnosticDiscount && breakdown.diagnosticDiscountGbp > 0
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                    : 'bg-slate-950/60 border-white/[0.06] text-slate-400'
                }`}
              >
                <span className="text-xs font-bold">{t('diagDiscountLabel', uiLang)}</span>
                <span className="font-mono font-black text-xs text-emerald-400">-£10.00</span>
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (5 COLS — STICKY LIVE CHECKOUT & TIME PROMISE) */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-16 space-y-3.5">
          <section className="glass-panel rounded-2xl p-4 shadow-2xl border border-amber-500/25 space-y-3.5">
            {/* Header + Date Picker */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {isPt ? '3. Agendamento & Fechamento' : '3. Time Promise & Checkout'}
              </span>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-slate-950 border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Arrival Time Slots */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                {isPt ? 'Horário de Chegada do Cliente:' : 'Customer Drop-off Slot:'}
              </label>
              <div className="grid grid-cols-6 gap-1">
                {TIME_SLOTS.map((slot) => {
                  const isBusy = busySlotsOnSelectedDate.includes(slot);
                  const isSelected = dropOffSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setDropOffSlot(slot)}
                      className={`py-1.5 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                          : isBusy
                          ? 'bg-amber-950/40 text-amber-300 border-amber-500/30'
                          : 'bg-slate-950/80 text-slate-300 border-white/[0.06] hover:border-slate-600'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Digital Telemetry Readout: Bay Time vs Customer Ready Time */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/95 border border-white/[0.07] rounded-xl p-2.5 text-center">
              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                  {isPt ? 'Tempo Box' : 'Bay Time'}
                </span>
                <span className="text-sm font-mono font-black text-amber-400">
                  ~{breakdown.estimatedTotalMinutes}m
                </span>
              </div>
              <div className="border-x border-white/[0.07]">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                  {isPt ? 'Prazo Cliente' : 'Customer Est.'}
                </span>
                <span className="text-sm font-mono font-black text-white">
                  ~{promisedCustomerMinutes}m
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-400 block">
                  {isPt ? 'Pronto às' : 'Ready By'}
                </span>
                <span className="text-base font-mono font-black text-emerald-400">
                  {promisedReadyTime}
                </span>
              </div>
            </div>

            {/* Parts Customer Must Bring Checklist */}
            <div className="bg-slate-950/80 border border-white/[0.06] rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-amber-300 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5" />
                  {isPt ? 'Peças p/ Cliente Trazer:' : 'Parts Customer Supplies:'}
                </span>
                <div className="flex gap-2">
                  <a
                    href={buildEuroCarPartsUrl(vrm)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-sky-400 hover:underline flex items-center gap-0.5"
                  >
                    EuroCarParts <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <a
                    href={buildAutodocUkUrl(make, model)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    Autodoc <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
              <ul className="space-y-1 text-[11px] text-slate-300 max-h-28 overflow-y-auto pr-1">
                {selectedServices.map((s) => (
                  <li key={s.id} className="leading-snug flex items-start gap-1.5">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>
                      {isPt ? s.partsCustomerShouldBringPt : s.partsCustomerShouldBringEn}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Customer Name & Phone Inputs (Right where the mechanic sends the quote) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  {isPt ? 'Nome do Cliente' : 'Customer Name'}
                </label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={isPt ? 'Ex: João / Dave...' : 'Customer name...'}
                  className="w-full h-8 bg-slate-950 border border-white/[0.08] focus:border-amber-500 rounded-lg px-2.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  WhatsApp (+44)
                </label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+447700..."
                  className="w-full h-8 bg-slate-950 border border-white/[0.08] focus:border-amber-500 rounded-lg px-2.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Final Price + Hourly Yield Readout */}
            <div className="pt-2 border-t border-white/[0.08] flex items-end justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {isPt ? 'Rendimento / Hora' : 'Hourly Yield'}
                </span>
                <span
                  className={`text-lg font-mono font-black ${
                    breakdown.projectedHourlyRateGbp >= 50
                      ? 'text-emerald-400'
                      : breakdown.projectedHourlyRateGbp >= 35
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  £{breakdown.projectedHourlyRateGbp.toFixed(2)}/h
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  {isPt ? 'Total Mão de Obra' : 'Total Labour'}
                </span>
                <span className="text-3xl font-mono font-black text-white leading-none">
                  £{breakdown.netLabourProfitGbp.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Buttons: Book in Diary + WhatsApp */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleCreateWorkOrder}
                className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4" />
                {isPt
                  ? `Agendar na Oficina (${dropOffSlot} → ${promisedReadyTime})`
                  : `Book in Workshop (${dropOffSlot} → ${promisedReadyTime})`}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {copiedToast ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      {t('copiedToast', uiLang)}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      {isPt ? 'Copiar Texto Zap' : 'Copy Quote'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenWhatsAppDirect}
                  className="py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow shadow-emerald-500/20 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isPt ? 'Enviar WhatsApp' : 'Send WhatsApp'}
                </button>
              </div>
            </div>

            {orderCreatedBanner && (
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                {orderCreatedBanner}
              </div>
            )}

            {/* Collapsible WhatsApp Preview Drawer */}
            <div className="pt-1 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowWhatsappPreview((v) => !v)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-200 py-1 cursor-pointer"
              >
                <span>
                  {isPt
                    ? `Ver prévia da mensagem (${docLang})`
                    : `Preview WhatsApp message (${docLang})`}
                </span>
                {showWhatsappPreview ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              {showWhatsappPreview && (
                <pre className="mt-2 bg-slate-950 border border-white/[0.06] rounded-xl p-2.5 text-[10px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {whatsappMessage}
                </pre>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Calculator,
  Calendar,
  CheckCircle2,
  CreditCard,
  Globe,
  KeyRound,
  Radar,
  Settings,
  ShieldCheck,
  Timer,
  Wrench,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { SmartQuotingModule } from './components/modules/SmartQuotingModule';
import { WorkshopCalendarModule } from './components/modules/WorkshopCalendarModule';
import { WorkOrdersStopwatchModule } from './components/modules/WorkOrdersStopwatchModule';
import { CrmRevenueRadarModule } from './components/modules/CrmRevenueRadarModule';
import { PaymentsHubModule } from './components/modules/PaymentsHubModule';
import { FinancialAnalyticsModule } from './components/modules/FinancialAnalyticsModule';
import { SettingsCatalogModule } from './components/modules/SettingsCatalogModule';

type ActiveTab =
  | 'QUOTE'
  | 'CALENDAR'
  | 'ORDERS'
  | 'CRM'
  | 'PAYMENTS'
  | 'ANALYTICS'
  | 'SETTINGS';

const LTAutoOSWorkspace: React.FC = () => {
  const { db, uiLang, setUiLang, docLang, setDocLang, setActiveCheckoutOrderId } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>('QUOTE');
  const isPt = uiLang === 'PT-BR';

  const runningTimersCount = db.workOrders.filter((w) => w.timerRunning).length;
  const bookedCount = db.workOrders.filter(
    (w) => w.status === 'Booked' || w.status === 'InProgress'
  ).length;
  const hasDvsaConfigured = Boolean(
    db.settings.dvsaApiKey && db.settings.dvsaClientId && db.settings.dvsaTokenUrl
  );

  const navItems: {
    id: ActiveTab;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: 'QUOTE',
      label: isPt ? 'Cockpit de Orçamento' : 'Smart Quoting',
      subtitle: isPt ? 'Placa DVSA, Tempos & Zap' : 'VRM Lookup & Labour Quote',
      icon: <Calculator className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'CALENDAR',
      label: isPt ? 'Agenda de Box' : 'Workshop Diary',
      subtitle: isPt ? 'Horários & Entrega' : 'Drop-off & Ready Slots',
      icon: <Calendar className="w-4 h-4 shrink-0" />,
      badge: bookedCount,
    },
    {
      id: 'ORDERS',
      label: isPt ? 'Cronômetro & OS' : 'Live Bay Timer',
      subtitle: isPt ? 'Lucro/Hora em Tempo Real' : 'Real-Time Hourly Yield',
      icon: <Timer className="w-4 h-4 shrink-0" />,
      badge: runningTimersCount > 0 ? 'LIVE' : db.workOrders.length,
      badgeColor: runningTimersCount > 0 ? 'bg-emerald-500 text-slate-950 animate-pulse' : undefined,
    },
    {
      id: 'CRM',
      label: isPt ? 'Frota & Radar MOT' : 'Fleet & MOT Radar',
      subtitle: isPt ? 'Alertas de Revisão & MOT' : 'Proactive Service Alerts',
      icon: <Radar className="w-4 h-4 shrink-0" />,
      badge: db.vehicles.length,
    },
    {
      id: 'PAYMENTS',
      label: isPt ? 'Checkout UK (£)' : 'Payments Hub (£)',
      subtitle: isPt ? 'Faster Payments & Revolut' : 'Sort Code, QR & Cash',
      icon: <CreditCard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'ANALYTICS',
      label: isPt ? 'Telemetria & Lucro' : 'Financial BI',
      subtitle: isPt ? 'Rendimento £/h & Meta' : 'Hourly Yield & Target',
      icon: <BarChart3 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'SETTINGS',
      label: isPt ? 'Catálogo & APIs' : 'Catalog & APIs',
      subtitle: isPt ? 'Preços, DVSA & Nuvem' : 'Prices, DVSA & Sync',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  const activeNav = navItems.find((n) => n.id === activeTab) || navItems[0];

  const handleOpenCheckoutFromOrder = (workOrderId: string) => {
    setActiveCheckoutOrderId(workOrderId);
    setActiveTab('PAYMENTS');
  };

  return (
    <div className="min-h-screen flex bg-[#070A0F] text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* LEFT COMMAND RAIL (Desktop Sidebar) */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-white/[0.06] bg-[#0B0F17]/90 backdrop-blur-xl sticky top-0 h-screen z-40 justify-between">
        <div>
          {/* Brand Logo Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Wrench className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black tracking-tight text-white">
                    LT AUTO <span className="text-amber-400">OS</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Livingston, Scotland • UK
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Stack */}
          <div className="p-3 space-y-1">
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {isPt ? 'Módulos da Oficina' : 'Workshop Modules'}
            </div>
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full group relative flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent text-white border border-amber-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeRailIndicator"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-amber-400"
                    />
                  )}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 shadow shadow-amber-500/30'
                          : 'bg-slate-900 text-slate-400 group-hover:text-slate-200 border border-white/[0.05]'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <div
                        className={`text-xs font-bold truncate ${
                          isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                        }`}
                      >
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold shrink-0 ${
                        item.badgeColor
                          ? item.badgeColor
                          : isActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800/90 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Telemetry Status Card */}
        <div className="p-3 border-t border-white/[0.06] space-y-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('SETTINGS')}
            className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-white/[0.06] text-left transition flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  hasDvsaConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <div className="truncate">
                <div className="text-[11px] font-bold text-slate-200 truncate">
                  {hasDvsaConfigured ? 'DVSA API Configurada' : 'DVSA Smart Lookup Ativo'}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {db.serviceCatalog.length} serviços • { UK_SPECS_COUNT } carros UK
                </div>
              </div>
            </div>
            <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          </button>

          <div className="px-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>LAUNCH CRP919X READY</span>
            <span className="text-emerald-400 font-bold">£ GBP ONLY</span>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE COLUMN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP TELEMETRY BAR */}
        <header className="sticky top-0 z-30 h-14 bg-[#070A0F]/85 backdrop-blur-xl border-b border-white/[0.06] px-4 lg:px-6 flex items-center justify-between gap-3">
          {/* Left: Current View Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                  {activeNav.label}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Activity className="w-3 h-3" />
                  100% LABOUR-ONLY
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick DVSA Status + Dual Language Switchers */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('SETTINGS')}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                hasDvsaConfigured
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/60'
                  : 'bg-slate-900 border-white/[0.08] text-slate-300 hover:border-amber-500/40'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {hasDvsaConfigured ? 'API DVSA Ativa' : 'Config API DVSA'}
            </button>

            {/* UI Language Pill */}
            <div className="flex items-center bg-slate-900/90 border border-white/[0.07] rounded-lg p-0.5 text-[11px]">
              <Globe className="w-3 h-3 text-slate-400 ml-1.5 mr-1 hidden sm:inline" />
              <button
                type="button"
                onClick={() => setUiLang('PT-BR')}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  uiLang === 'PT-BR'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                PT
              </button>
              <button
                type="button"
                onClick={() => setUiLang('EN-GB')}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  uiLang === 'EN-GB'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            {/* Customer Document (WhatsApp/PDF) Language Pill */}
            <div className="flex items-center bg-slate-900/90 border border-emerald-500/25 rounded-lg p-0.5 text-[11px]">
              <span className="text-[10px] text-emerald-400 font-bold px-1.5 hidden sm:inline">
                Zap/PDF:
              </span>
              <button
                type="button"
                onClick={() => setDocLang('PT-BR')}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  docLang === 'PT-BR'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇧🇷
              </button>
              <button
                type="button"
                onClick={() => setDocLang('EN-GB')}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  docLang === 'EN-GB'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇬🇧
              </button>
            </div>
          </div>
        </header>

        {/* MOBILE & TABLET COMPACT NAVIGATION BAR (< lg) */}
        <div className="lg:hidden bg-[#0B0F17] border-b border-white/[0.06] px-3 py-2">
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-bold transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-900/80 text-slate-300 border border-white/[0.05]'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ACTIVE MODULE VIEWPORT WITH SMOOTH TRANSITION */}
        <main className="flex-1 w-full max-w-[1500px] mx-auto px-3 sm:px-6 py-4 sm:py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {activeTab === 'QUOTE' && (
                <SmartQuotingModule
                  onOrderCreated={() => setActiveTab('CALENDAR')}
                  onOpenSettings={() => setActiveTab('SETTINGS')}
                />
              )}
              {activeTab === 'CALENDAR' && (
                <WorkshopCalendarModule
                  onOpenStopwatch={() => setActiveTab('ORDERS')}
                  onOpenQuote={() => setActiveTab('QUOTE')}
                />
              )}
              {activeTab === 'ORDERS' && (
                <WorkOrdersStopwatchModule onOpenCheckout={handleOpenCheckoutFromOrder} />
              )}
              {activeTab === 'CRM' && <CrmRevenueRadarModule />}
              {activeTab === 'PAYMENTS' && <PaymentsHubModule />}
              {activeTab === 'ANALYTICS' && <FinancialAnalyticsModule />}
              {activeTab === 'SETTINGS' && <SettingsCatalogModule />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

const UK_SPECS_COUNT = 23;

export function App() {
  return (
    <AppProvider>
      <LTAutoOSWorkspace />
    </AppProvider>
  );
}

export default App;

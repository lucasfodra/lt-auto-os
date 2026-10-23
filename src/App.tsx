import React, { useState } from 'react';
import {
  BarChart3,
  Calculator,
  Calendar,
  CreditCard,
  Globe,
  Radar,
  Settings,
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
import { t } from './i18n/translations';

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

  const runningTimersCount = db.workOrders.filter((w) => w.timerRunning).length;
  const bookedCount = db.workOrders.filter(
    (w) => w.status === 'Booked' || w.status === 'InProgress'
  ).length;

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[] = [
    {
      id: 'QUOTE',
      label: t(uiLang, 'navQuote'),
      icon: <Calculator className="w-5 h-5" />,
    },
    {
      id: 'CALENDAR',
      label: t(uiLang, 'navCalendar'),
      icon: <Calendar className="w-5 h-5" />,
      badge: `${bookedCount} agendados`,
    },
    {
      id: 'ORDERS',
      label: t(uiLang, 'navWorkOrders'),
      icon: <Timer className="w-5 h-5" />,
      badge: runningTimersCount > 0 ? `LIVE (${runningTimersCount})` : db.workOrders.length,
    },
    {
      id: 'CRM',
      label: t(uiLang, 'navCrmRadar'),
      icon: <Radar className="w-5 h-5" />,
      badge: '£ Radar',
    },
    {
      id: 'PAYMENTS',
      label: t(uiLang, 'navPayments'),
      icon: <CreditCard className="w-5 h-5" />,
      badge: '£ GBP',
    },
    {
      id: 'ANALYTICS',
      label: t(uiLang, 'navAnalytics'),
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      id: 'SETTINGS',
      label: t(uiLang, 'navSettings'),
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const handleOpenCheckoutFromOrder = (workOrderId: string) => {
    setActiveCheckoutOrderId(workOrderId);
    setActiveTab('PAYMENTS');
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Sticky Industrial Automotive Header */}
      <header className="sticky top-0 z-40 bg-[#0B0F17]/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo + Livingston Badge */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-[0_0_15px_rgba(245,158,11,0.4)]">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  LT AUTO <span className="text-amber-400">OS</span>
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-extrabold uppercase bg-slate-800 text-amber-300 rounded border border-slate-700">
                  LIVINGSTON • SCOTLAND 🏴󠁧󠁢󠁳󠁣󠁴󠁿
                </span>
              </div>
              <p className="text-xs text-slate-400">{t(uiLang, 'appSubtitle')}</p>
            </div>
          </div>

          {/* Dual Language Controls: UI Language + Output Document Language */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* UI Language Toggle */}
            <div className="flex items-center bg-[#161F30] p-1 rounded-xl border border-slate-700">
              <Globe className="w-4 h-4 text-amber-400 ml-2 mr-1.5" />
              <span className="text-[11px] text-slate-400 font-bold mr-2 hidden md:inline">
                UI:
              </span>
              <button
                type="button"
                onClick={() => setUiLang('PT-BR')}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-extrabold transition ${
                  uiLang === 'PT-BR'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🇧🇷 PT-BR
              </button>
              <button
                type="button"
                onClick={() => setUiLang('EN-GB')}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-extrabold transition ${
                  uiLang === 'EN-GB'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🇬🇧 EN-GB
              </button>
            </div>

            {/* Output Document Language Indicator */}
            <div className="hidden sm:flex items-center bg-[#161F30] p-1 rounded-xl border border-slate-700">
              <span className="text-[11px] text-slate-400 font-bold px-2">
                Doc (WhatsApp/PDF):
              </span>
              <button
                type="button"
                onClick={() => setDocLang(docLang === 'PT-BR' ? 'EN-GB' : 'PT-BR')}
                className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-mono font-bold bg-slate-900 text-emerald-400 border border-slate-700 hover:border-emerald-500"
              >
                {docLang === 'PT-BR' ? '🇧🇷 Cliente BR' : '🇬🇧 UK Customer'}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Bar (Ergonomic 48px+ Touch Targets for Garage Tablet & Mobile) */}
        <nav className="max-w-7xl mx-auto mt-3 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[48px] px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 shrink-0 border transition ${
                  active
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                    : 'bg-[#161F30] text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                      active
                        ? 'bg-slate-950 text-amber-400'
                        : 'bg-slate-900 text-amber-400 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeTab === 'QUOTE' && (
          <SmartQuotingModule onNavigateToOrders={() => setActiveTab('CALENDAR')} />
        )}
        {activeTab === 'CALENDAR' && (
          <WorkshopCalendarModule
            onOpenOrderInBay={() => setActiveTab('ORDERS')}
            onJumpToNewQuote={() => setActiveTab('QUOTE')}
          />
        )}
        {activeTab === 'ORDERS' && (
          <WorkOrdersStopwatchModule onOpenPaymentCheckout={handleOpenCheckoutFromOrder} />
        )}
        {activeTab === 'CRM' && <CrmRevenueRadarModule />}
        {activeTab === 'PAYMENTS' && <PaymentsHubModule />}
        {activeTab === 'ANALYTICS' && <FinancialAnalyticsModule />}
        {activeTab === 'SETTINGS' && <SettingsCatalogModule />}
      </main>

      {/* Footer Status Bar */}
      <footer className="border-t border-slate-800/80 bg-[#0B0F17] py-4 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-slate-300">LT Auto OS v1.2</strong> — Livingston, West Lothian,
            Scotland, UK • 100% Labour-Only Engine, Calendar Diary &amp; Launch CRP919X Ready
          </div>
          <div className="font-mono text-[11px] text-emerald-400">
            ● Offline-First IndexedDB Active • Bilingual Engine (PT-BR / EN-GB)
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <LTAutoOSWorkspace />
    </AppProvider>
  );
}

export default App;

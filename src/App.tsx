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

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[] = [
    {
      id: 'QUOTE',
      label: isPt ? 'Orçamento' : 'Quoting',
      icon: <Calculator className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'CALENDAR',
      label: isPt ? 'Agenda' : 'Calendar',
      icon: <Calendar className="w-4 h-4 shrink-0" />,
      badge: bookedCount,
    },
    {
      id: 'ORDERS',
      label: isPt ? 'Box / Timer' : 'Bay Timer',
      icon: <Timer className="w-4 h-4 shrink-0" />,
      badge: runningTimersCount > 0 ? `LIVE` : db.workOrders.length,
    },
    {
      id: 'CRM',
      label: isPt ? 'Frota & MOT' : 'Fleet CRM',
      icon: <Radar className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'PAYMENTS',
      label: isPt ? 'Caixa (£)' : 'Payments',
      icon: <CreditCard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'ANALYTICS',
      label: isPt ? 'Lucro & BI' : 'Analytics',
      icon: <BarChart3 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'SETTINGS',
      label: isPt ? 'Config & APIs' : 'Settings',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  const handleOpenCheckoutFromOrder = (workOrderId: string) => {
    setActiveCheckoutOrderId(workOrderId);
    setActiveTab('PAYMENTS');
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Clean, Compact, Zero-Overflow Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#0B0F17]/95 backdrop-blur border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
          {/* Row 1: Brand + Language Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-none">
                    LT AUTO <span className="text-amber-400">OS</span>
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-800 text-amber-300 rounded border border-slate-700">
                    SCOTLAND 🏴󠁧󠁢󠁳󠁣󠁴󠁿
                  </span>
                </div>
              </div>
            </div>

            {/* Compact Language Toggles */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#161F30] p-0.5 rounded-lg border border-slate-700">
                <Globe className="w-3.5 h-3.5 text-amber-400 ml-2 mr-1 hidden sm:inline" />
                <button
                  type="button"
                  onClick={() => setUiLang('PT-BR')}
                  className={`px-2.5 py-1 rounded-md text-xs font-extrabold transition ${
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
                  className={`px-2.5 py-1 rounded-md text-xs font-extrabold transition ${
                    uiLang === 'EN-GB'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDocLang(docLang === 'PT-BR' ? 'EN-GB' : 'PT-BR')}
                title="Idioma do WhatsApp e PDF"
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#161F30] text-emerald-400 border border-slate-700 hover:border-emerald-500"
              >
                Zap/PDF: {docLang === 'PT-BR' ? '🇧🇷 PT' : '🇬🇧 EN'}
              </button>
            </div>
          </div>

          {/* Row 2: 7-Column Equal Grid on Desktop / Wrap on Mobile (NEVER clips off-screen!) */}
          <nav className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[42px] px-3 py-2 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 border transition ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                      : 'bg-[#161F30] text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
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
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        {activeTab === 'QUOTE' && (
          <SmartQuotingModule
            onNavigateToOrders={() => setActiveTab('CALENDAR')}
            onNavigateToSettings={() => setActiveTab('SETTINGS')}
          />
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

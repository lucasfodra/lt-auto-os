import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  CreditCard,
  FileDown,
  Flame,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Wrench,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UkPlateBadge } from '../common/UkPlateBadge';
import { analyzeLiveBayYield } from '../../services/pricingEngine';
import { generateWorkOrderPdf } from '../../services/pdfInvoiceGenerator';
import { TechnicalChecklist, WorkOrder, WorkOrderStatus } from '../../types/domain';
import { t } from '../../i18n/translations';

interface WorkOrdersStopwatchModuleProps {
  onOpenPaymentCheckout: (workOrderId: string) => void;
}

const STATUS_COLUMNS: { status: WorkOrderStatus; labelPt: string; labelEn: string }[] = [
  { status: 'Quoted', labelPt: 'Orçado', labelEn: 'Quoted' },
  { status: 'Booked', labelPt: 'Agendado', labelEn: 'Booked' },
  { status: 'InProgress', labelPt: 'No Elevador / Box', labelEn: 'In Progress (Bay)' },
  { status: 'Completed', labelPt: 'Concluído', labelEn: 'Completed' },
  { status: 'Paid', labelPt: 'Pago', labelEn: 'Paid' },
];

function formatDurationClock(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const WorkOrdersStopwatchModule: React.FC<WorkOrdersStopwatchModuleProps> = ({
  onOpenPaymentCheckout,
}) => {
  const {
    db,
    uiLang,
    docLang,
    setDocLang,
    updateWorkOrderStatus,
    toggleWorkOrderTimer,
    adjustWorkOrderSeconds,
    updateWorkOrderChecklist,
    updateWorkOrderDiagnostics,
  } = useApp();

  const isPt = uiLang === 'PT-BR';
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'ALL'>('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    db.workOrders.find((w) => w.status === 'InProgress')?.id || db.workOrders[0]?.id || ''
  );

  const [newDtcCode, setNewDtcCode] = useState('');

  const filteredOrders =
    statusFilter === 'ALL'
      ? db.workOrders
      : db.workOrders.filter((w) => w.status === statusFilter);

  const activeOrder: WorkOrder | undefined =
    db.workOrders.find((w) => w.id === selectedOrderId) || filteredOrders[0];

  const handleDownloadPdf = (order: WorkOrder) => {
    const matchedVeh = db.vehicles.find((v) => v.id === order.vehicleId);
    generateWorkOrderPdf({
      workOrder: order,
      vehicle: matchedVeh,
      services: db.serviceCatalog,
      modifiers: db.modifiersCatalog,
      settings: db.settings,
      documentLanguage: docLang,
    });
  };

  const handleAddDtc = (order: WorkOrder) => {
    if (!newDtcCode.trim()) return;
    updateWorkOrderDiagnostics(
      order.id,
      [...order.dtcFaults, newDtcCode.trim()],
      order.advisoryNotes,
      order.oilSpecUsed
    );
    setNewDtcCode('');
  };

  return (
    <div className="space-y-6">
      {/* Status Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161F30] border border-slate-800 p-3.5 rounded-xl">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`min-h-[42px] px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
              statusFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isPt ? 'Todas as OS' : 'All Orders'} ({db.workOrders.length})
          </button>
          {STATUS_COLUMNS.map((col) => {
            const count = db.workOrders.filter((w) => w.status === col.status).length;
            return (
              <button
                key={col.status}
                type="button"
                onClick={() => setStatusFilter(col.status)}
                className={`min-h-[42px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === col.status
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {isPt ? col.labelPt : col.labelEn} ({count})
              </button>
            );
          })}
        </div>

        {/* Document Language Selector for PDF Invoices */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold">{t(uiLang, 'docLangLabel')}</span>
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setDocLang('PT-BR')}
              className={`px-2.5 py-1 rounded font-bold ${
                docLang === 'PT-BR' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              🇧🇷 PT-BR
            </button>
            <button
              type="button"
              onClick={() => setDocLang('EN-GB')}
              className={`px-2.5 py-1 rounded font-bold ${
                docLang === 'EN-GB' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              🇬🇧 EN-GB
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Kanban / List of Work Orders */}
        <div className="lg:col-span-5 space-y-3">
          {filteredOrders.map((wo) => {
            const yieldMetrics = analyzeLiveBayYield(
              wo.netProfitGbp,
              wo.estimatedMinutes,
              wo.actualSecondsSpent || wo.estimatedMinutes * 60
            );
            const isSelected = activeOrder?.id === wo.id;

            const borderGlow =
              wo.actualSecondsSpent === 0
                ? 'border-slate-800'
                : yieldMetrics.efficiencyTier === 'EMERALD'
                ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : yieldMetrics.efficiencyTier === 'AMBER_RED'
                ? 'border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.18)]'
                : 'border-amber-500/60';

            return (
              <div
                key={wo.id}
                onClick={() => setSelectedOrderId(wo.id)}
                className={`cursor-pointer rounded-xl p-4 border-2 transition ${
                  isSelected ? 'bg-slate-800/90' : 'bg-[#161F30] hover:bg-slate-800/50'
                } ${borderGlow}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <UkPlateBadge vrm={wo.vrm} size="sm" />
                    <span className="text-xs font-mono text-slate-400">#{wo.orderNumber}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                      wo.status === 'InProgress'
                        ? 'bg-amber-500 text-slate-950 animate-pulse'
                        : wo.status === 'Paid'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : wo.status === 'Completed'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {wo.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white">{wo.vehicleLabel}</h3>
                <p className="text-xs text-slate-400 mb-3">
                  {wo.customerName} • {wo.customerPhone}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono">
                  <div>
                    <span className="text-slate-400">Est: {wo.estimatedMinutes}m</span>
                    <span className="mx-1.5 text-slate-600">|</span>
                    <span className="text-white font-bold">
                      Real: {Math.round(wo.actualSecondsSpent / 60)}m
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        yieldMetrics.efficiencyTier === 'EMERALD'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : yieldMetrics.efficiencyTier === 'AMBER_RED'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-slate-900 text-amber-300'
                      }`}
                    >
                      £{yieldMetrics.realHourlyRateGbp.toFixed(0)}/h
                    </span>
                    <span className="text-sm font-black text-white">
                      £{wo.grossTotalGbp.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 7 Cols: Active Bay Stopwatch, Real-Time Hourly Yield & Technical Checklist */}
        <div className="lg:col-span-7">
          {activeOrder ? (
            (() => {
              const liveYield = analyzeLiveBayYield(
                activeOrder.netProfitGbp,
                activeOrder.estimatedMinutes,
                activeOrder.actualSecondsSpent || activeOrder.estimatedMinutes * 60
              );

              const isEmerald =
                activeOrder.actualSecondsSpent > 0 && liveYield.efficiencyTier === 'EMERALD';
              const isOvertime =
                activeOrder.actualSecondsSpent > 0 && liveYield.efficiencyTier === 'AMBER_RED';

              return (
                <div
                  className={`rounded-2xl p-6 border-2 transition space-y-6 ${
                    isEmerald
                      ? 'bg-[#112220] border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
                      : isOvertime
                      ? 'bg-[#261419] border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.25)]'
                      : 'bg-[#161F30] border-slate-700'
                  }`}
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <UkPlateBadge vrm={activeOrder.vrm} size="md" />
                        <div>
                          <span className="text-xs font-mono text-amber-400 block">
                            WORK ORDER #{activeOrder.orderNumber}
                          </span>
                          <h2 className="text-xl font-black text-white">
                            {activeOrder.vehicleLabel}
                          </h2>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300">
                        {activeOrder.customerName} ({activeOrder.customerPhone}) •{' '}
                        {activeOrder.recordedMileage.toLocaleString()} miles
                      </p>
                    </div>

                    {/* Status Switcher */}
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_COLUMNS.map((st) => (
                        <button
                          key={st.status}
                          type="button"
                          onClick={() => updateWorkOrderStatus(activeOrder.id, st.status)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            activeOrder.status === st.status
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {isPt ? st.labelPt : st.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* LIVE BAY STOPWATCH HUD */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <Timer className="w-4 h-4" />
                          {isPt
                            ? 'Cronômetro de Box ao Vivo vs. Tempo Orçado'
                            : 'Live Bay Stopwatch vs. Quoted Time'}
                        </span>
                        <div className="text-4xl sm:text-5xl font-black font-mono text-white tracking-wider mt-1">
                          {formatDurationClock(activeOrder.actualSecondsSpent)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-mono">
                          {isPt ? 'Tempo Orçado:' : 'Estimated Target:'}{' '}
                          <strong className="text-amber-300">{activeOrder.estimatedMinutes} min</strong>{' '}
                          | {isPt ? 'Lucro Líquido:' : 'Net Profit:'}{' '}
                          <strong className="text-emerald-400">
                            £{activeOrder.netProfitGbp.toFixed(2)}
                          </strong>
                        </p>
                      </div>

                      {/* Real-Time Hourly Rate Badge */}
                      <div
                        className={`p-4 rounded-xl border text-center min-w-[190px] ${
                          isEmerald
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : isOvertime
                            ? 'bg-red-500/20 border-red-400 text-red-200'
                            : 'bg-slate-900 border-slate-700 text-amber-300'
                        }`}
                      >
                        <span className="text-[11px] font-bold uppercase block opacity-90">
                          {t(uiLang, 'realYield')}
                        </span>
                        <span className="text-3xl font-black font-mono block my-0.5">
                          £{liveYield.realHourlyRateGbp.toFixed(2)}/h
                        </span>
                        <span className="text-[11px] font-semibold block">
                          {isEmerald ? (
                            <span className="flex items-center justify-center gap-1 text-emerald-300">
                              <Flame className="w-3.5 h-3.5" /> {t(uiLang, 'highEfficiency')}
                            </span>
                          ) : isOvertime ? (
                            <span className="flex items-center justify-center gap-1 text-red-300">
                              <AlertOctagon className="w-3.5 h-3.5" /> {t(uiLang, 'overtimeAlert')}
                            </span>
                          ) : (
                            `${isPt ? 'Meta Projetada:' : 'Projected:'} £${liveYield.projectedHourlyRateGbp.toFixed(
                              2
                            )}/h`
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Stopwatch Action Buttons & Quick Time Simulation Buttons */}
                    <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => toggleWorkOrderTimer(activeOrder.id)}
                        className={`min-h-[50px] px-6 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition ${
                          activeOrder.timerRunning
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        }`}
                      >
                        {activeOrder.timerRunning ? (
                          <>
                            <Pause className="w-5 h-5" /> {t(uiLang, 'pauseStopwatch')}
                          </>
                        ) : (
                          <>
                            <Play className="w-5 h-5" /> {t(uiLang, 'startStopwatch')}
                          </>
                        )}
                      </button>

                      {/* Quick Demo Time Presets to test Emerald vs Overtime Glow immediately */}
                      <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                        <span className="text-[11px] text-slate-400 mr-1">
                          {isPt ? 'Simular Tempo:' : 'Simulate Clock:'}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustWorkOrderSeconds(activeOrder.id, 30 * 60)}
                          className="px-2.5 py-1.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 text-xs font-mono font-bold hover:bg-emerald-900"
                        >
                          30m (Emerald £/h)
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustWorkOrderSeconds(activeOrder.id, 90 * 60)}
                          className="px-2.5 py-1.5 rounded bg-red-950 border border-red-600 text-red-300 text-xs font-mono font-bold hover:bg-red-900"
                        >
                          90m (Overtime Alert)
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustWorkOrderSeconds(activeOrder.id, 0)}
                          title="Reset Timer"
                          className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Technical Quality Checklist */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      {t(uiLang, 'techChecklist')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(
                        [
                          { key: 'torqueWheelNuts', label: t(uiLang, 'checkTorque') },
                          { key: 'pumpBrakePedal', label: t(uiLang, 'checkBrakePedal') },
                          { key: 'resetServiceLight', label: t(uiLang, 'checkServiceLight') },
                          { key: 'checkFluidLevels', label: t(uiLang, 'checkFluids') },
                          { key: 'attachHealthReport', label: t(uiLang, 'checkHealthReport') },
                        ] as { key: keyof TechnicalChecklist; label: string }[]
                      ).map((item) => {
                        const checked = activeOrder.checklist[item.key];
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              updateWorkOrderChecklist(activeOrder.id, item.key, !checked)
                            }
                            className={`min-h-[48px] p-3 rounded-lg border text-left text-xs font-bold flex items-center gap-2.5 transition ${
                              checked
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                checked ? 'text-emerald-400' : 'text-slate-600'
                              }`}
                            />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Launch CRP919X Diagnostic Fault Codes & Advisories */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                      Launch CRP919X ECU DTC Log & MOT Advisories
                    </h3>
                    <div className="flex gap-2">
                      <input
                        placeholder={
                          isPt
                            ? 'Adicionar código DTC (ex: P0420 Catalyst Efficiency)...'
                            : 'Add DTC Fault Code (e.g. P0420 - Cleared via Launch)...'
                        }
                        value={newDtcCode}
                        onChange={(e) => setNewDtcCode(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddDtc(activeOrder)}
                        className="px-3 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> DTC
                      </button>
                    </div>
                    {activeOrder.dtcFaults.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {activeOrder.dtcFaults.map((code, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-slate-400 font-semibold block mb-1">
                        {isPt
                          ? 'Recomendações / Advisories ( Impressas no PDF )'
                          : 'Technician Advisory Notes (Printed on Customer PDF)'}
                      </label>
                      <textarea
                        rows={2}
                        value={activeOrder.advisoryNotes}
                        onChange={(e) =>
                          updateWorkOrderDiagnostics(
                            activeOrder.id,
                            activeOrder.dtcFaults,
                            e.target.value,
                            activeOrder.oilSpecUsed
                          )
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Bottom Actions: Download PDF Invoice & Checkout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(activeOrder)}
                      className="min-h-[50px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition"
                    >
                      <FileDown className="w-5 h-5 text-amber-400" />
                      {t(uiLang, 'generatePdf')} ({docLang})
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenPaymentCheckout(activeOrder.id)}
                      className="min-h-[50px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg transition"
                    >
                      <CreditCard className="w-5 h-5" />
                      {isPt
                        ? `Checkout UK (£${activeOrder.grossTotalGbp.toFixed(2)} GBP)`
                        : `UK Checkout (£${activeOrder.grossTotalGbp.toFixed(2)} GBP)`}
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="bg-[#161F30] border border-slate-800 rounded-xl p-8 text-center text-slate-400">
              {isPt ? 'Selecione uma Ordem de Serviço ao lado.' : 'Select a Work Order from the list.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

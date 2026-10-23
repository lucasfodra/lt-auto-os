import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Plus,
  Send,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UkPlateBadge } from '../common/UkPlateBadge';
import { calculatePromisedReadyTime } from '../../services/pricingEngine';
import { WorkOrder } from '../../types/domain';

interface WorkshopCalendarModuleProps {
  onOpenOrderInBay: (workOrderId: string) => void;
  onJumpToNewQuote: () => void;
}

const DAILY_SLOTS = [
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

function getWeekDays(baseDateStr: string): { dateStr: string; dayNamePt: string; dayNameEn: string; dayNum: string }[] {
  const base = new Date(`${baseDateStr}T12:00:00Z`);
  // Find Monday of this week
  const dayOfWeek = base.getUTCDay(); // 0=Sun, 1=Mon
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() + diffToMon);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      dateStr: iso,
      dayNamePt: d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).toUpperCase(),
      dayNameEn: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }).toUpperCase(),
      dayNum: d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
    });
  }
  return days;
}

export const WorkshopCalendarModule: React.FC<WorkshopCalendarModuleProps> = ({
  onOpenOrderInBay,
  onJumpToNewQuote,
}) => {
  const { db, uiLang, addWorkOrder, updateWorkOrderSchedule, toggleWorkOrderTimer } = useApp();
  const isPt = uiLang === 'PT-BR';

  const [selectedDate, setSelectedDate] = useState('2026-10-23');
  const [showQuickBookModal, setShowQuickBookModal] = useState<string | null>(null); // holds dropOffSlot e.g. "10:00"

  // Quick Booking Form State
  const [quickVrm, setQuickVrm] = useState('');
  const [quickVehicleLabel, setQuickVehicleLabel] = useState('');
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('+447700900');
  const [quickServiceId, setQuickServiceId] = useState('srv-oil-basic');

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const dayOrders = useMemo(
    () =>
      db.workOrders
        .filter((wo) => (wo.scheduledDate || '2026-10-23') === selectedDate)
        .sort((a, b) => (a.dropOffSlot || '09:00').localeCompare(b.dropOffSlot || '09:00')),
    [db.workOrders, selectedDate]
  );

  // Daily Capacity & Profit Metrics (Assuming 8h = 480 mins daily capacity)
  const dayStats = useMemo(() => {
    const totalEstMins = dayOrders.reduce((sum, w) => sum + w.estimatedMinutes, 0);
    const totalLabourGbp = dayOrders.reduce((sum, w) => sum + w.labourTotalGbp, 0);
    const capacityPercent = Math.min(100, Math.round((totalEstMins / 420) * 100)); // 7h productive bay capacity
    return {
      jobsCount: dayOrders.length,
      totalEstMins,
      totalLabourGbp,
      capacityPercent,
    };
  }, [dayOrders]);

  const shiftDateByDays = (deltaDays: number) => {
    const d = new Date(`${selectedDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleQuickCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showQuickBookModal || !quickVrm.trim()) return;

    const srv =
      db.serviceCatalog.find((s) => s.id === quickServiceId) || db.serviceCatalog[0];
    const promisedMins = srv.estimatedMinutes + (srv.customerBufferMinutes ?? 15);
    const readyTime = calculatePromisedReadyTime(showQuickBookModal, promisedMins);

    addWorkOrder({
      status: 'Booked',
      vehicleId: 'veh-quick',
      customerId: 'cust-quick',
      vrm: quickVrm.toUpperCase().trim(),
      vehicleLabel: quickVehicleLabel.trim() || 'UK Vehicle',
      customerName: quickCustomerName.trim() || 'Cliente Agenda',
      customerPhone: quickCustomerPhone.trim(),
      customerLanguage: 'PT-BR',
      selectedServiceIds: [srv.id],
      selectedModifierIds: [],
      comboDiscountApplied: false,
      comboDiscountGbp: 0,
      diagnosticDiscountApplied: false,
      partsSourcingMode: 'CUSTOMER_SUPPLIES',
      parts: [],
      labourTotalGbp: srv.basePriceGbp,
      partsCostTotalGbp: 0,
      partsClientTotalGbp: 0,
      grossTotalGbp: srv.basePriceGbp,
      netProfitGbp: srv.basePriceGbp,
      estimatedMinutes: srv.estimatedMinutes,
      actualSecondsSpent: 0,
      timerRunning: false,
      scheduledDate: selectedDate,
      dropOffSlot: showQuickBookModal,
      promisedReadyTime: readyTime,
      customerPromisedMinutes: promisedMins,
      checklist: {
        torqueWheelNuts: false,
        pumpBrakePedal: false,
        resetServiceLight: false,
        checkFluidLevels: false,
        attachHealthReport: false,
      },
      dtcFaults: [],
      advisoryNotes: '',
      recordedMileage: 65000,
    });

    setShowQuickBookModal(null);
    setQuickVrm('');
    setQuickVehicleLabel('');
    setQuickCustomerName('');
  };

  const handleSendBookingConfirmationWhatsApp = (wo: WorkOrder) => {
    const srvNames = db.serviceCatalog
      .filter((s) => wo.selectedServiceIds.includes(s.id))
      .map((s) => (wo.customerLanguage === 'PT-BR' ? s.namePt : s.nameEn))
      .join(' + ');

    const partsToBring = db.serviceCatalog
      .filter((s) => wo.selectedServiceIds.includes(s.id))
      .map((s) =>
        wo.customerLanguage === 'PT-BR'
          ? s.partsCustomerShouldBringPt
          : s.partsCustomerShouldBringEn
      )
      .filter(Boolean)
      .join(' | ');

    const text =
      wo.customerLanguage === 'PT-BR'
        ? `📅 *CONFIRMAÇÃO DE AGENDAMENTO — LT AUTO (LIVINGSTON)* 🏴󠁧󠁢󠁳󠁣󠁴󠁿
Olá *${wo.customerName.split(' ')[0]}*! Seu horário está confirmado na nossa agenda:

🚘 *Veículo:* ${wo.vehicleLabel} (*${wo.vrm}*)
📆 *Data:* ${wo.scheduledDate}
⏰ *Horário de Chegada (Drop-off):* *${wo.dropOffSlot || '09:30'}*
🏁 *Previsão de Retirada (Pronto):* *~${wo.promisedReadyTime || '11:00'}*
🔧 *Serviço:* ${srvNames}
💷 *Mão de Obra Combinada:* *£${wo.labourTotalGbp.toFixed(2)}*
${partsToBring ? `\n🛒 *Lembrete — Trazer no porta-malas:* ${partsToBring}` : ''}

Qualquer imprevisto com o horário é só avisar! Até lá! 👊🔧`
        : `📅 *BOOKING CONFIRMATION — LT AUTO (LIVINGSTON)* 🇬🇧
Hi *${wo.customerName.split(' ')[0]}*, your workshop slot is locked in:

🚘 *Vehicle:* ${wo.vehicleLabel} (*${wo.vrm}*)
📆 *Date:* ${wo.scheduledDate}
⏰ *Drop-Off Time:* *${wo.dropOffSlot || '09:30'}*
🏁 *Est. Collection Time:* *~${wo.promisedReadyTime || '11:00'}*
🔧 *Service:* ${srvNames}
💷 *Agreed Labour:* *£${wo.labourTotalGbp.toFixed(2)}*
${partsToBring ? `\n🛒 *Reminder — Parts to bring:* ${partsToBring}` : ''}

See you then! 👍🔧`;

    const cleanPhone = wo.customerPhone.replace(/[^0-9]/g, '');
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Weekly Strip & Daily Capacity HUD */}
      <section className="bg-[#161F30] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                LT AUTO — AGENDA DE BOX &amp; CONTROLE DE HORÁRIOS
              </span>
              <h2 className="text-xl font-black text-white">
                {isPt
                  ? 'Calendário de Agendamentos & Ocupação do Dia'
                  : 'Workshop Booking Diary & Daily Bay Capacity'}
              </h2>
            </div>
          </div>

          {/* Week Navigation + Jump to Calculator */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => shiftDateByDays(-7)}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-900 border border-amber-500/60 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-white"
            />
            <button
              type="button"
              onClick={() => shiftDateByDays(7)}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onJumpToNewQuote}
              className="min-h-[42px] px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              {isPt ? 'Novo Orçamento na Agenda' : 'New Quoted Booking'}
            </button>
          </div>
        </div>

        {/* 7-Day Interactive Week Selector Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const ordersForDay = db.workOrders.filter(
              (w) => (w.scheduledDate || '2026-10-23') === day.dateStr
            );
            const dayProfit = ordersForDay.reduce((s, w) => s + w.labourTotalGbp, 0);
            const dayMins = ordersForDay.reduce((s, w) => s + w.estimatedMinutes, 0);
            const isSelected = day.dateStr === selectedDate;

            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => setSelectedDate(day.dateStr)}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                    : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-black uppercase">
                    {isPt ? day.dayNamePt : day.dayNameEn}
                  </span>
                  <span className="text-xs font-mono font-bold opacity-85">{day.dayNum}</span>
                </div>

                <div className="mt-2 pt-2 border-t border-current/15 flex items-center justify-between w-full text-xs font-mono">
                  <span className="font-bold">
                    {ordersForDay.length} {ordersForDay.length === 1 ? 'carro' : 'carros'}
                  </span>
                  <span
                    className={`font-black ${
                      isSelected ? 'text-slate-950' : 'text-emerald-400'
                    }`}
                  >
                    £{dayProfit}
                  </span>
                </div>
                <div className="text-[10px] font-mono opacity-75 mt-0.5">
                  ⏱ {Math.round((dayMins / 60) * 10) / 10}h box
                </div>
              </button>
            );
          })}
        </div>

        {/* Daily Capacity Meter Bar */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                {isPt
                  ? `Lotação do Box em ${selectedDate}: ${dayStats.jobsCount} serviços (${dayStats.totalEstMins} min de chave na mão)`
                  : `Bay Load on ${selectedDate}: ${dayStats.jobsCount} jobs (${dayStats.totalEstMins} mins bay time)`}
              </span>
              <span className="font-mono font-black text-amber-400">
                {dayStats.capacityPercent}% {isPt ? 'Ocupado' : 'Booked'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  dayStats.capacityPercent >= 85
                    ? 'bg-red-500'
                    : dayStats.capacityPercent >= 50
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${dayStats.capacityPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block">
                {isPt ? 'Mão de Obra Agendada no Dia' : 'Scheduled Day Labour'}
              </span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                £{dayStats.totalLabourGbp.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Booking Modal when clicking an empty time slot */}
      {showQuickBookModal && (
        <section className="bg-slate-950 border-2 border-emerald-500 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              {isPt
                ? `Encaixe Rápido na Agenda: ${selectedDate} às ${showQuickBookModal}`
                : `Quick Slot Booking: ${selectedDate} at ${showQuickBookModal}`}
            </h3>
            <button
              type="button"
              onClick={() => setShowQuickBookModal(null)}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              {isPt ? 'Cancelar' : 'Cancel'}
            </button>
          </div>

          <form
            onSubmit={handleQuickCreateBooking}
            className="grid grid-cols-1 sm:grid-cols-6 gap-3"
          >
            <input
              required
              placeholder="Placa UK (ex: SH64 WRF)"
              value={quickVrm}
              onChange={(e) => setQuickVrm(e.target.value.toUpperCase())}
              className="bg-[#FFCC00] text-slate-950 placeholder:text-slate-700 font-black font-mono px-3 py-2.5 rounded-lg text-xs uppercase"
            />
            <input
              placeholder={isPt ? 'Carro (ex: Focus 1.0)' : 'Car (e.g. Focus 1.0)'}
              value={quickVehicleLabel}
              onChange={(e) => setQuickVehicleLabel(e.target.value)}
              className="bg-slate-900 border border-slate-700 px-3 py-2.5 rounded-lg text-xs text-white"
            />
            <input
              placeholder={isPt ? 'Nome do Cliente' : 'Customer Name'}
              value={quickCustomerName}
              onChange={(e) => setQuickCustomerName(e.target.value)}
              className="bg-slate-900 border border-slate-700 px-3 py-2.5 rounded-lg text-xs text-white"
            />
            <input
              placeholder="WhatsApp (+44...)"
              value={quickCustomerPhone}
              onChange={(e) => setQuickCustomerPhone(e.target.value)}
              className="bg-slate-900 border border-slate-700 px-3 py-2.5 rounded-lg text-xs text-white font-mono"
            />
            <select
              value={quickServiceId}
              onChange={(e) => setQuickServiceId(e.target.value)}
              className="bg-slate-900 border border-slate-700 px-3 py-2.5 rounded-lg text-xs text-amber-300 font-bold"
            >
              {db.serviceCatalog.map((s) => (
                <option key={s.id} value={s.id}>
                  {isPt ? s.namePt : s.nameEn} (£{s.basePriceGbp} • {s.estimatedMinutes}m)
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg px-4 py-2.5 text-xs"
            >
              {isPt ? 'Marcar Horário' : 'Save Slot'}
            </button>
          </form>
        </section>
      )}

      {/* Hourly Timeline Grid (08:30 to 18:00) */}
      <section className="bg-[#161F30] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {isPt
              ? `Grade de Horários do Dia (${selectedDate})`
              : `Daily Time-Slot Schedule (${selectedDate})`}
          </h3>
          <span className="text-xs text-slate-400">
            {isPt
              ? 'Clique em "+ Agendar Horário Livre" para marcar um encaixe rápido'
              : 'Click any free slot to book a car immediately'}
          </span>
        </div>

        <div className="space-y-2.5">
          {DAILY_SLOTS.map((slot) => {
            const slotOrders = dayOrders.filter((w) => (w.dropOffSlot || '09:00') === slot);

            return (
              <div
                key={slot}
                className={`rounded-xl border p-3.5 transition grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${
                  slotOrders.length > 0
                    ? 'bg-slate-900/95 border-amber-500/60 shadow'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Left Time Column */}
                <div className="lg:col-span-2 flex items-center gap-2.5">
                  <span
                    className={`px-3 py-1.5 rounded-lg font-mono text-sm font-black ${
                      slotOrders.length > 0
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {slot}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {slotOrders.length > 0
                      ? isPt
                        ? 'OCUPADO'
                        : 'BOOKED'
                      : isPt
                      ? 'Horário Livre'
                      : 'Free Slot'}
                  </span>
                </div>

                {/* Right Content Column */}
                <div className="lg:col-span-10">
                  {slotOrders.length > 0 ? (
                    <div className="space-y-2.5">
                      {slotOrders.map((wo) => {
                        const srvLabels = db.serviceCatalog
                          .filter((s) => wo.selectedServiceIds.includes(s.id))
                          .map((s) => (isPt ? s.namePt : s.nameEn))
                          .join(' + ');

                        const partsReminder = db.serviceCatalog
                          .filter((s) => wo.selectedServiceIds.includes(s.id))
                          .map((s) =>
                            isPt
                              ? s.partsCustomerShouldBringPt
                              : s.partsCustomerShouldBringEn
                          )
                          .filter(Boolean)
                          .join(' • ');

                        return (
                          <div
                            key={wo.id}
                            className="bg-[#161F30] border border-slate-700 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <UkPlateBadge vrm={wo.vrm} size="sm" />
                                <span className="text-sm font-black text-white">
                                  {wo.vehicleLabel}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
                                  Chega {wo.dropOffSlot} → Pronto ~{wo.promisedReadyTime || '11:00'}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-amber-400 font-bold">
                                  £{wo.labourTotalGbp.toFixed(2)} ({wo.estimatedMinutes}m box)
                                </span>
                              </div>

                              <div className="text-xs text-slate-200 font-semibold flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                {srvLabels} — <span className="text-slate-400">{wo.customerName}</span>
                              </div>

                              {partsReminder && (
                                <div className="text-[11px] text-amber-300/90 font-mono">
                                  🛒 {isPt ? 'Cliente traz:' : 'Customer brings:'} {partsReminder}
                                </div>
                              )}
                            </div>

                            {/* Quick Actions on Scheduled Card */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {/* Quick Reschedule Time Slot Dropdown */}
                              <select
                                aria-label="Reschedule Slot"
                                value={wo.dropOffSlot || slot}
                                onChange={(e) => {
                                  const nextSlot = e.target.value;
                                  const nextReady = calculatePromisedReadyTime(
                                    nextSlot,
                                    wo.customerPromisedMinutes || wo.estimatedMinutes + 20
                                  );
                                  updateWorkOrderSchedule(
                                    wo.id,
                                    wo.scheduledDate || selectedDate,
                                    nextSlot,
                                    nextReady
                                  );
                                }}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-300"
                              >
                                {DAILY_SLOTS.map((s) => (
                                  <option key={s} value={s}>
                                    Mudar p/ {s}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => handleSendBookingConfirmationWhatsApp(wo)}
                                className="px-3 py-2 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-xs flex items-center gap-1"
                              >
                                <Send className="w-3.5 h-3.5" />
                                {isPt ? 'Confirmar Zap' : 'WhatsApp'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (!wo.timerRunning && wo.status === 'Booked') {
                                    toggleWorkOrderTimer(wo.id);
                                  }
                                  onOpenOrderInBay(wo.id);
                                }}
                                className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1"
                              >
                                <Play className="w-3.5 h-3.5" />
                                {isPt ? 'Iniciar no Box' : 'Start in Bay'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 italic">
                        {isPt
                          ? 'Nenhum carro marcado neste horário — box livre.'
                          : 'No vehicle booked in this slot — bay available.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowQuickBookModal(slot)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs flex items-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isPt ? `Agendar às ${slot}` : `Book ${slot}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

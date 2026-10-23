import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Award,
  CarFront,
  Clock,
  DollarSign,
  Plus,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UkPlateBadge } from '../common/UkPlateBadge';

export const FinancialAnalyticsModule: React.FC = () => {
  const { db, uiLang, addFlipCar } = useApp();
  const isPt = uiLang === 'PT-BR';

  // Interactive Growth Simulator Sliders State
  const [simPrivateClients, setSimPrivateClients] = useState(45);
  const [simDeliveryClients, setSimDeliveryClients] = useState(15);
  const [simComboTicketGbp, setSimComboTicketGbp] = useState(55);

  // New Flip Car Form State
  const [showAddFlip, setShowAddFlip] = useState(false);
  const [flipVrm, setFlipVrm] = useState('');
  const [flipModel, setFlipModel] = useState('');
  const [flipBuy, setFlipBuy] = useState(1100);
  const [flipParts, setFlipParts] = useState(250);
  const [flipSale, setFlipSale] = useState(2350);

  // Executive KPIs from Work Orders
  const kpis = useMemo(() => {
    const activeOrDone = db.workOrders.filter(
      (w) => w.status === 'Paid' || w.status === 'Completed' || w.status === 'InProgress'
    );

    const netLabourProfitGbp = activeOrDone.reduce((sum, w) => sum + w.netProfitGbp, 0);
    const totalGrossGbp = activeOrDone.reduce((sum, w) => sum + w.grossTotalGbp, 0);
    const totalSeconds = activeOrDone.reduce(
      (sum, w) => sum + (w.actualSecondsSpent || w.estimatedMinutes * 60),
      0
    );
    const totalHours = Math.max(0.5, totalSeconds / 3600);
    const avgRealHourlyRate = Number((netLabourProfitGbp / totalHours).toFixed(2));
    const avgTicketGbp =
      activeOrDone.length > 0 ? Number((totalGrossGbp / activeOrDone.length).toFixed(2)) : 0;

    // Flipping / Auction Cars ROI (Separate Capital Pool)
    const totalFlipProfitGbp = db.flipCars.reduce((sum, f) => {
      if (!f.salePriceGbp) return sum;
      return sum + (f.salePriceGbp - f.purchasePriceGbp - f.partsSpentGbp - f.recoveryAndFeesGbp);
    }, 0);

    return {
      netLabourProfitGbp,
      avgRealHourlyRate,
      vehiclesServiced: activeOrDone.length,
      avgTicketGbp,
      totalFlipProfitGbp,
    };
  }, [db.workOrders, db.flipCars]);

  // Chart 1: Hourly Profit Yield by Service Category (£/h)
  const categoryHourlyData = useMemo(
    () => [
      {
        category: isPt ? 'Diagnóstico Launch' : 'Launch Diagnostics',
        hourlyRate: 78,
        avgTicket: 32,
        color: '#10B981',
      },
      {
        category: isPt ? 'Óleo & Revisão' : 'Oil & Servicing',
        hourlyRate: 64,
        avgTicket: 42,
        color: '#F59E0B',
      },
      {
        category: isPt ? 'Freios + EPB' : 'Brakes & EPB',
        hourlyRate: 58,
        avgTicket: 48,
        color: '#3B82F6',
      },
      {
        category: isPt ? 'Ignição & Laser' : 'Plugs & Alignment',
        hourlyRate: 60,
        avgTicket: 30,
        color: '#8B5CF6',
      },
      {
        category: isPt ? 'Mecânica Pesada' : 'Heavy Repairs',
        hourlyRate: 31,
        avgTicket: 95,
        color: '#EF4444',
      },
    ],
    [isPt]
  );

  // Chart 2: Estimated vs Actual Time Variance per Work Order
  const timeVarianceData = useMemo(
    () =>
      db.workOrders.map((wo) => ({
        name: wo.vrm,
        estimatedMin: wo.estimatedMinutes,
        actualMin:
          wo.actualSecondsSpent > 0
            ? Math.round(wo.actualSecondsSpent / 60)
            : wo.estimatedMinutes,
      })),
    [db.workOrders]
  );

  // Interactive Portfolio Growth Projection Math
  // Private clients visit ~1.8x/year (0.15 visits/month). High-mileage Delivery/Uber visit ~4.5x/year (0.375 visits/month).
  const simulatorProjection = useMemo(() => {
    const monthlyPrivateJobs = simPrivateClients * 0.15;
    const monthlyDeliveryJobs = simDeliveryClients * 0.38;
    const totalMonthlyJobs = Math.round(monthlyPrivateJobs + monthlyDeliveryJobs);
    const projectedMonthlyNetProfitGbp = Math.round(totalMonthlyJobs * simComboTicketGbp);
    const avgJobHours = 0.85; // ~51 mins per combo job
    const requiredWeeklyGarageHours = Number(
      ((totalMonthlyJobs * avgJobHours) / 4.33).toFixed(1)
    );
    const effectiveHourlyYield = Number(
      (projectedMonthlyNetProfitGbp / Math.max(1, totalMonthlyJobs * avgJobHours)).toFixed(2)
    );

    return {
      totalMonthlyJobs,
      projectedMonthlyNetProfitGbp,
      requiredWeeklyGarageHours,
      effectiveHourlyYield,
    };
  }, [simPrivateClients, simDeliveryClients, simComboTicketGbp]);

  const handleCreateFlip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flipVrm.trim() || !flipModel.trim()) return;
    addFlipCar({
      vrm: flipVrm.toUpperCase().trim(),
      makeModel: flipModel.trim(),
      source: 'Copart UK',
      purchasePriceGbp: flipBuy,
      partsSpentGbp: flipParts,
      recoveryAndFeesGbp: 180,
      hoursInvested: 7,
      status: 'Listed',
      salePriceGbp: flipSale,
      notes: 'Prepared at LT Auto Livingston workshop.',
    });
    setFlipVrm('');
    setFlipModel('');
    setShowAddFlip(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#161F30] border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
            <span>{isPt ? 'Lucro Mão de Obra (Atual)' : 'Net Labour Profit'}</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400 mt-1">
            £{kpis.netLabourProfitGbp.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {isPt ? 'Meta Mensal:' : 'Monthly Target:'} £{db.settings.monthlyProfitTargetGbp}
          </div>
        </div>

        <div className="bg-[#161F30] border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
            <span>{isPt ? 'Ganho Real por Hora' : 'Avg Real Hourly Rate'}</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black font-mono text-amber-400 mt-1">
            £{kpis.avgRealHourlyRate.toFixed(2)}/h
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold">
            ✓ {isPt ? 'Baseado no cronômetro real de box' : 'Based on clocked bay stopwatch'}
          </div>
        </div>

        <div className="bg-[#161F30] border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
            <span>{isPt ? 'Carros Atendidos & Ticket' : 'Serviced & Avg Ticket'}</span>
            <Award className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black font-mono text-white mt-1">
            {kpis.vehiclesServiced} OS • £{kpis.avgTicketGbp.toFixed(0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {isPt ? 'Ticket Médio por Passagem' : 'Average Revenue per Visit'}
          </div>
        </div>

        <div className="bg-[#161F30] border border-amber-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-amber-400">
            <span>{isPt ? 'ROI Carros Leilão (Copart Flip)' : 'Copart / Car Flipping ROI'}</span>
            <CarFront className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400 mt-1">
            +£{kpis.totalFlipProfitGbp.toFixed(0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {isPt
              ? 'Caixa separado do giro da oficina'
              : 'Ring-fenced from workshop service cashflow'}
          </div>
        </div>
      </div>

      {/* 2. Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profit by Service Category (£/h) */}
        <div className="lg:col-span-6 bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            {isPt ? 'Rentabilidade por Hora de Box (£/h)' : 'Profitability Yield by Category (£/h)'}
          </span>
          <h3 className="text-lg font-extrabold text-white mb-4">
            {isPt
              ? 'Onde a LT Auto Mais Lucra por Hora'
              : 'What Makes the Most Money per Hour'}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryHourlyData} layout="vertical" margin={{ left: 15, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis type="number" stroke="#94A3B8" unit="£" />
                <YAxis dataKey="category" type="category" width={125} stroke="#E2E8F0" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0F17',
                    borderColor: '#F59E0B',
                    color: '#F8FAFC',
                  }}
                />
                <Bar dataKey="hourlyRate" name="£ / Hora" radius={[0, 6, 6, 0]}>
                  {categoryHourlyData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Estimated vs Actual Time Variance */}
        <div className="lg:col-span-6 bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            {isPt ? 'Variância de Tempo por Veículo' : 'Estimated vs. Actual Bay Time (mins)'}
          </span>
          <h3 className="text-lg font-extrabold text-white mb-4">
            {isPt
              ? 'Tempo Orçado vs. Cronômetro Real (Minutos)'
              : 'Quoted Time vs. Actual Clocked Minutes'}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeVarianceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="name" stroke="#E2E8F0" fontSize={12} />
                <YAxis stroke="#94A3B8" unit="m" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0F17',
                    borderColor: '#334155',
                    color: '#F8FAFC',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="estimatedMin"
                  name={isPt ? 'Orçado (min)' : 'Estimated (min)'}
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="actualMin"
                  name={isPt ? 'Cronometrado (min)' : 'Actual Clocked (min)'}
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE GROWTH SIMULATOR ("PROJEÇÃO DE CARTEIRA LT AUTO") */}
      <section className="bg-gradient-to-r from-[#161F30] to-[#111827] border-2 border-emerald-500/60 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sliders className="w-4 h-4" />
              INTERACTIVE PORTFOLIO GROWTH SIMULATOR
            </span>
            <h2 className="text-2xl font-black text-white">
              {isPt
                ? 'Simulador de Projeção de Carteira & Renda Recorrente'
                : 'Fleet Portfolio & Monthly Recurring Profit Simulator'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-950 border border-emerald-500/60 px-5 py-3 rounded-xl text-right">
              <span className="text-xs uppercase font-bold text-slate-400 block">
                {isPt ? 'Lucro Líquido Mensal Projetado' : 'Projected Monthly Net Profit'}
              </span>
              <span className="text-3xl font-black font-mono text-emerald-400">
                £{simulatorProjection.projectedMonthlyNetProfitGbp.toLocaleString()}/mês
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Sliders */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <div className="flex justify-between text-sm font-bold mb-1.5">
                <span className="text-slate-200">
                  🚗 {isPt ? 'Clientes Particulares Regulares:' : 'Regular Private Commuter Clients:'}
                </span>
                <span className="font-mono text-amber-400">{simPrivateClients} veículos</span>
              </div>
              <input
                type="range"
                min={10}
                max={150}
                value={simPrivateClients}
                onChange={(e) => setSimPrivateClients(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-2.5 bg-slate-800 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-bold mb-1.5">
                <span className="text-slate-200">
                  🔥{' '}
                  {isPt
                    ? 'Clientes Delivery / Uber / Taxi (Giro a cada 3 meses):'
                    : 'High-Mileage Delivery / Uber / Courier Clients (3m cycle):'}
                </span>
                <span className="font-mono text-emerald-400">{simDeliveryClients} veículos</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={simDeliveryClients}
                onChange={(e) => setSimDeliveryClients(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-2.5 bg-slate-800 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-bold mb-1.5">
                <span className="text-slate-200">
                  💷 {isPt ? 'Ticket Médio de Mão de Obra (Combo):' : 'Average Combo Labour Ticket (£):'}
                </span>
                <span className="font-mono text-white">£{simComboTicketGbp}.00</span>
              </div>
              <input
                type="range"
                min={30}
                max={95}
                step={5}
                value={simComboTicketGbp}
                onChange={(e) => setSimComboTicketGbp(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-2.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          {/* Output Metrics */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 block">
                {isPt ? 'OS Recorrentes / Mês' : 'Monthly Repeat Jobs'}
              </span>
              <span className="text-2xl font-black font-mono text-white">
                {simulatorProjection.totalMonthlyJobs} jobs
              </span>
            </div>

            <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 block">
                {isPt ? 'Horas de Box / Semana' : 'Required Weekly Hours'}
              </span>
              <span className="text-2xl font-black font-mono text-amber-400">
                {simulatorProjection.requiredWeeklyGarageHours}h / sem
              </span>
            </div>

            <div className="col-span-2 bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-300 font-bold block">
                  {isPt ? 'Taxa Horária Efetiva Projetada' : 'Projected Hourly Yield'}
                </span>
                <span className="text-xs text-slate-400">
                  {simPrivateClients + simDeliveryClients} {isPt ? 'carros na carteira' : 'total fleet cars'}
                </span>
              </div>
              <span className="text-2xl font-black font-mono text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-5 h-5" />£{simulatorProjection.effectiveHourlyYield}/h
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COPART / AUCTION CAR FLIPPING TRACKER (RING-FENCED CAPITAL) */}
      <section className="bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              COPART UK & TRADE-IN FLIP TRACKER
            </span>
            <h3 className="text-lg font-extrabold text-white">
              {isPt
                ? 'Controle de Carros de Giro / Leilão (Separado do Caixa de Serviços)'
                : 'Auction / Flipping Cars ROI (Ring-Fenced Capital)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddFlip((v) => !v)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {isPt ? 'Adicionar Carro de Leilão' : 'Add Flip Project'}
          </button>
        </div>

        {showAddFlip && (
          <form
            onSubmit={handleCreateFlip}
            className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800"
          >
            <input
              required
              placeholder="VRM (e.g. SY15 ABC)"
              value={flipVrm}
              onChange={(e) => setFlipVrm(e.target.value.toUpperCase())}
              className="bg-[#FFCC00] text-slate-950 font-black font-mono px-3 py-2 rounded text-xs"
            />
            <input
              required
              placeholder="Make & Model"
              value={flipModel}
              onChange={(e) => setFlipModel(e.target.value)}
              className="sm:col-span-2 bg-slate-900 border border-slate-700 px-3 py-2 rounded text-xs text-white"
            />
            <input
              type="number"
              placeholder="Buy £"
              value={flipBuy}
              onChange={(e) => setFlipBuy(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 px-3 py-2 rounded text-xs text-white font-mono"
            />
            <input
              type="number"
              placeholder="Parts £"
              value={flipParts}
              onChange={(e) => setFlipParts(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 px-3 py-2 rounded text-xs text-white font-mono"
            />
            <button
              type="submit"
              className="bg-emerald-500 text-slate-950 font-black rounded px-3 py-2 text-xs"
            >
              Save Flip
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {db.flipCars.map((flip) => {
            const totalInvested =
              flip.purchasePriceGbp + flip.partsSpentGbp + flip.recoveryAndFeesGbp;
            const netFlipProfit = (flip.salePriceGbp || 0) - totalInvested;
            const roiPercent =
              totalInvested > 0 ? Math.round((netFlipProfit / totalInvested) * 100) : 0;

            return (
              <div
                key={flip.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <UkPlateBadge vrm={flip.vrm} size="sm" />
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                        flip.status === 'Sold'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {flip.source} • {flip.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{flip.makeModel}</h4>
                  <p className="text-xs text-slate-400 mt-1">{flip.notes}</p>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">Buy+Fees</span>
                    <span className="text-slate-200 font-bold">
                      £{flip.purchasePriceGbp + flip.recoveryAndFeesGbp}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Parts</span>
                    <span className="text-amber-300 font-bold">£{flip.partsSpentGbp}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Sale Price</span>
                    <span className="text-white font-bold">£{flip.salePriceGbp || 0}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Net ROI</span>
                    <span className="text-emerald-400 font-black">
                      +£{netFlipProfit} ({roiPercent}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

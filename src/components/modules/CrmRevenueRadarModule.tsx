import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CalendarClock,
  Car,
  Check,
  Copy,
  FileText,
  Flame,
  Plus,
  Send,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UkPlateBadge } from '../common/UkPlateBadge';
import { generateProactiveRadarReminder } from '../../services/whatsappGenerator';
import { Customer, DriverProfile, FuelType, Language, Vehicle } from '../../types/domain';
import { t } from '../../i18n/translations';

const REFERENCE_TODAY = new Date('2026-10-22T12:00:00Z');

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const diffMs = target.getTime() - REFERENCE_TODAY.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export const CrmRevenueRadarModule: React.FC = () => {
  const { db, uiLang, docLang, upsertCustomerAndVehicle } = useApp();
  const isPt = uiLang === 'PT-BR';

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(db.vehicles[0]?.id || '');
  const [copiedAlertId, setCopiedAlertId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Client + Vehicle Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('+447700900');
  const [newClientLang, setNewClientLang] = useState<Language>('PT-BR');
  const [newDriverProfile, setNewDriverProfile] = useState<DriverProfile>('high_mileage');
  const [newVrm, setNewVrm] = useState('');
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newEngine, setNewEngine] = useState('');
  const [newOilSpec, setNewOilSpec] = useState('5W-30 C3');
  const [newMotDate, setNewMotDate] = useState('2026-11-12');

  // Proactive 30-Day Revenue Radar Items
  const radarOpportunities = useMemo(() => {
    const alerts: {
      id: string;
      vehicle: Vehicle;
      customer: Customer;
      type: 'MOT' | 'SERVICE';
      daysRemaining: number;
      estimatedValueGbp: number;
    }[] = [];

    for (const veh of db.vehicles) {
      const cust = db.customers.find((c) => c.id === veh.customerId);
      if (!cust) continue;

      const motDays = getDaysUntil(veh.motExpiryDate);
      if (motDays <= 35) {
        alerts.push({
          id: `mot-${veh.id}`,
          vehicle: veh,
          customer: cust,
          type: 'MOT',
          daysRemaining: motDays,
          estimatedValueGbp: 35,
        });
      }

      const srvDays = getDaysUntil(veh.nextServiceDueDate);
      if (srvDays <= 35) {
        alerts.push({
          id: `srv-${veh.id}`,
          vehicle: veh,
          customer: cust,
          type: 'SERVICE',
          daysRemaining: srvDays,
          estimatedValueGbp: 30,
        });
      }
    }

    return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [db.vehicles, db.customers]);

  const totalRadarPotentialGbp = radarOpportunities.reduce(
    (sum, item) => sum + item.estimatedValueGbp,
    0
  );

  const selectedVehicle =
    db.vehicles.find((v) => v.id === selectedVehicleId) || db.vehicles[0];
  const selectedCustomer = db.customers.find((c) => c.id === selectedVehicle?.customerId);

  const handleSendWhatsAppAlert = (
    customer: Customer,
    vehicle: Vehicle,
    type: 'MOT' | 'SERVICE',
    days: number
  ) => {
    const msg = generateProactiveRadarReminder(customer, vehicle, type, days);
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleCopyAlert = async (
    alertId: string,
    customer: Customer,
    vehicle: Vehicle,
    type: 'MOT' | 'SERVICE',
    days: number
  ) => {
    const msg = generateProactiveRadarReminder(customer, vehicle, type, days, docLang);
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedAlertId(alertId);
      setTimeout(() => setCopiedAlertId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveNewCustomerVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newVrm.trim()) return;

    const custId = `cust-${Date.now()}`;
    const vehId = `veh-${Date.now()}`;

    // High-mileage drivers trigger next oil service in 3 months (90 days), private in 12 months
    const nextServiceDate = new Date(REFERENCE_TODAY);
    nextServiceDate.setDate(
      nextServiceDate.getDate() + (newDriverProfile === 'high_mileage' ? 25 : 180)
    );

    const newCustomer: Customer = {
      id: custId,
      name: newClientName.trim(),
      phone: newClientPhone.trim(),
      preferredLanguage: newClientLang,
      driverProfile: newDriverProfile,
      notes:
        newDriverProfile === 'high_mileage'
          ? 'Ciclo de troca de óleo intensivo a cada 3 meses (Delivery/Uber).'
          : 'Cliente uso particular.',
    };

    const newVehicle: Vehicle = {
      id: vehId,
      vrm: newVrm.toUpperCase().trim(),
      make: newMake || 'Ford',
      model: newModel || 'Transit Connect',
      year: 2017,
      engine: newEngine || '1.5 TDCi',
      fuelType: 'Diesel' as FuelType,
      mileage: 72000,
      oilSpec: newOilSpec,
      flags: {
        hasEPB: false,
        hasComplexUndertray: true,
        difficultOilFilter: false,
      },
      motExpiryDate: newMotDate,
      nextServiceDueDate: nextServiceDate.toISOString().slice(0, 10),
      customerId: custId,
      history: [],
    };

    upsertCustomerAndVehicle(newCustomer, newVehicle);
    setSelectedVehicleId(vehId);
    setShowAddModal(false);
    setNewClientName('');
    setNewVrm('');
  };

  return (
    <div className="space-y-6">
      {/* PROACTIVE REVENUE RADAR WIDGET ("DINHEIRO NA MESA - 30 DIAS") */}
      <section className="bg-gradient-to-br from-[#161F30] to-[#0F172A] border-2 border-amber-500/70 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                PROACTIVE REVENUE RADAR • LIVINGSTON FLEET
              </span>
              <h2 className="text-xl font-black text-white">{t(uiLang, 'moneyOnTable')}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-emerald-950/70 border border-emerald-500/60 px-4 py-2 rounded-xl text-right">
              <span className="text-[11px] uppercase font-bold text-emerald-300 block">
                {isPt ? 'Receita Imediata Mapeada' : 'Immediate Pipeline Value'}
              </span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                £{totalRadarPotentialGbp.toFixed(2)}+
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal((v) => !v)}
              className="min-h-[48px] px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              {isPt ? 'Novo Cliente / Veículo' : 'Add Client & Vehicle'}
            </button>
          </div>
        </div>

        {/* Add Customer / Vehicle Drawer */}
        {showAddModal && (
          <form
            onSubmit={handleSaveNewCustomerVehicle}
            className="mb-5 bg-slate-950/90 border border-slate-700 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
          >
            <input
              required
              placeholder={isPt ? 'Nome do Cliente' : 'Customer Name'}
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            />
            <input
              placeholder="WhatsApp (+44...)"
              value={newClientPhone}
              onChange={(e) => setNewClientPhone(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
            <select
              value={newDriverProfile}
              onChange={(e) => setNewDriverProfile(e.target.value as DriverProfile)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-bold"
            >
              <option value="high_mileage">
                🔥 Delivery / Uber / Taxi (Alerta Óleo 3 Meses)
              </option>
              <option value="private">🚗 Uso Particular (Alerta Óleo 12 Meses)</option>
            </select>
            <select
              value={newClientLang}
              onChange={(e) => setNewClientLang(e.target.value as Language)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="PT-BR">🇧🇷 Idioma Cliente: PT-BR</option>
              <option value="EN-GB">🇬🇧 Idioma Cliente: EN-GB</option>
            </select>

            <input
              required
              placeholder="UK VRM (e.g. SY19 LTA)"
              value={newVrm}
              onChange={(e) => setNewVrm(e.target.value.toUpperCase())}
              className="bg-[#FFCC00] text-slate-950 placeholder:text-slate-700 font-black font-mono rounded-lg px-3 py-2 text-xs uppercase"
            />
            <input
              placeholder="Make (e.g. Ford)"
              value={newMake}
              onChange={(e) => setNewMake(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            />
            <input
              placeholder="Model (e.g. Focus)"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={newMotDate}
                onChange={(e) => setNewMotDate(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-black rounded-lg text-xs"
              >
                {isPt ? 'Salvar' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* Radar Opportunity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {radarOpportunities.map((item) => (
            <div
              key={item.id}
              className="bg-slate-950/85 border border-slate-800 hover:border-amber-500/60 rounded-xl p-4 flex flex-col justify-between transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <UkPlateBadge vrm={item.vehicle.vrm} size="sm" />
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                      item.type === 'MOT'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {item.type === 'MOT'
                      ? `MOT: ${item.daysRemaining}d`
                      : `${isPt ? 'Óleo/Revisão' : 'Service'}: ${item.daysRemaining}d`}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white">
                  {item.vehicle.make} {item.vehicle.model} ({item.vehicle.engine})
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                  <span>{item.customer.name}</span>
                  <span>•</span>
                  <span className="font-mono text-amber-400">
                    {item.customer.preferredLanguage}
                  </span>
                  {item.customer.driverProfile === 'high_mileage' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> Delivery 3m
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/90 flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-extrabold text-emerald-400">
                  {item.type === 'MOT' ? 'Oferta Pré-MOT £35' : 'Oferta Óleo £30'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyAlert(
                        item.id,
                        item.customer,
                        item.vehicle,
                        item.type,
                        item.daysRemaining
                      )
                    }
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                    title="Copy Reminder Message"
                  >
                    {copiedAlertId === item.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendWhatsAppAlert(
                        item.customer,
                        item.vehicle,
                        item.type,
                        item.daysRemaining
                      )
                    }
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-xs flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    WhatsApp ({item.customer.preferredLanguage})
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FLEET LIST & VEHICLE TECHNICAL DOSSIER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Fleet Vehicles List */}
        <div className="lg:col-span-5 bg-[#161F30] border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Car className="w-4 h-4" />
            {isPt ? 'Frota sob Gestão LT Auto' : 'Managed Customer Fleet'} ({db.vehicles.length})
          </h3>

          <div className="space-y-2.5">
            {db.vehicles.map((veh) => {
              const owner = db.customers.find((c) => c.id === veh.customerId);
              const isSelected = selectedVehicle?.id === veh.id;
              return (
                <button
                  key={veh.id}
                  type="button"
                  onClick={() => setSelectedVehicleId(veh.id)}
                  className={`w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-800 border-amber-500 shadow'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <UkPlateBadge vrm={veh.vrm} size="sm" />
                      {owner?.driverProfile === 'high_mileage' && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                          Uber / Delivery (3m Oil Cycle)
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-white">
                      {veh.year} {veh.make} {veh.model}
                    </div>
                    <div className="text-xs text-slate-400">
                      {owner?.name} • {veh.oilSpec}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-400">
                    <div>{veh.mileage.toLocaleString()} mi</div>
                    <div className="text-amber-400">MOT: {veh.motExpiryDate}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 7 Cols: Vehicle History Dossier */}
        <div className="lg:col-span-7 bg-[#161F30] border border-slate-800 rounded-xl p-5">
          {selectedVehicle && selectedCustomer ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <UkPlateBadge vrm={selectedVehicle.vrm} size="md" />
                    <div>
                      <h2 className="text-xl font-black text-white">
                        {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                      </h2>
                      <p className="text-xs text-amber-400 font-mono">
                        Engine: {selectedVehicle.engine} • Spec: {selectedVehicle.oilSpec}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    {selectedCustomer.name} ({selectedCustomer.preferredLanguage})
                  </div>
                  <div className="text-slate-400 font-mono mt-0.5">{selectedCustomer.phone}</div>
                  <div className="text-amber-300 font-semibold mt-1">
                    {selectedCustomer.driverProfile === 'high_mileage'
                      ? '⚡ Perfil Alto Giro (Delivery/Uber - Alerta 3 Meses)'
                      : '🚗 Perfil Particular (Alerta 12 Meses)'}
                  </div>
                </div>
              </div>

              {/* Technical Specs & Dates */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Mileage</span>
                  <span className="text-sm font-bold font-mono text-white">
                    {selectedVehicle.mileage.toLocaleString()} miles
                  </span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">MOT Expiry</span>
                  <span className="text-sm font-bold font-mono text-amber-400">
                    {selectedVehicle.motExpiryDate}
                  </span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Next Oil Service</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {selectedVehicle.nextServiceDueDate}
                  </span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">VIN</span>
                  <span className="text-xs font-bold font-mono text-slate-300 truncate block">
                    {selectedVehicle.vin || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Service & Launch Scanner History Log */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  {isPt
                    ? 'Dossiê de Manutenções, Logs Launch CRP919X & Advisories'
                    : 'Vehicle Service History, Launch DTC Logs & Advisories'}
                </h3>

                {selectedVehicle.history.length > 0 ? (
                  <div className="space-y-3">
                    {selectedVehicle.history.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-amber-400 flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5" />
                            {entry.date} • {entry.mileage.toLocaleString()} miles
                          </span>
                          <span className="font-mono font-bold text-emerald-400">
                            Labour: £{entry.labourChargedGbp.toFixed(2)} ({entry.actualMinutes}m)
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">{entry.servicesSummary}</div>
                        {entry.oilSpecUsed && (
                          <div className="text-xs text-slate-300 font-mono">
                            🛢️ Oil Used: {entry.oilSpecUsed}
                          </div>
                        )}
                        {entry.dtcCodes.length > 0 && (
                          <div className="text-xs text-amber-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                            🔍 Launch CRP919X Scan: {entry.dtcCodes.join(' | ')}
                          </div>
                        )}
                        {entry.advisories && (
                          <div className="text-xs text-slate-400 italic">
                            ⚠️ Advisory: {entry.advisories}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    {isPt
                      ? 'Nenhum histórico anterior registrado neste veículo.'
                      : 'No prior service history entries recorded yet.'}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

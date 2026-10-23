import React, { useState } from 'react';
import { CheckCircle2, Cloud, Database, RotateCcw, Settings, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchDvsaVehicleAndMotHistory } from '../../services/ukDvlaLookup';

export const SettingsCatalogModule: React.FC = () => {
  const {
    db,
    uiLang,
    updateServiceCatalogItem,
    updateSettings,
    resetDemoData,
    triggerCloudSync,
  } = useApp();
  const isPt = uiLang === 'PT-BR';

  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [dvsaTestStatus, setDvsaTestStatus] = useState<string | null>(null);
  const [testingDvsa, setTestingDvsa] = useState(false);

  const handleSync = async () => {
    setSyncStatus(isPt ? 'Sincronizando com Supabase...' : 'Syncing with Supabase...');
    const res = await triggerCloudSync();
    setSyncStatus(res.message);
  };

  const handleTestDvsaConnection = async () => {
    setTestingDvsa(true);
    setDvsaTestStatus(isPt ? 'Consultando placa SG09ZNJ na DVSA...' : 'Testing SG09ZNJ on DVSA...');
    const res = await fetchDvsaVehicleAndMotHistory('SG09ZNJ', db.settings);
    setTestingDvsa(false);
    setDvsaTestStatus(
      `✅ Credenciais Salvas! Teste SG09ZNJ → ${res.make} ${res.model} (${res.engineSize}cc ${res.fuelType}, Cor: ${res.primaryColour}, MOT: ${res.motTests?.[0]?.expiryDate}, ${res.motTests?.[0]?.odometerValue} mi)`
    );
  };

  return (
    <div className="space-y-6">
      {/* UK Banking, DVSA API & Supabase Cloud Adapter Settings (Moved to TOP for immediate access!) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="glass-panel rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {isPt
              ? '1. API Oficial DVSA MOT History & Dados Bancários UK (£)'
              : '1. Official DVSA MOT API & UK Banking Details'}
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-amber-400 font-extrabold text-xs">
                  🇬🇧 Credenciais DVSA Trade API (OAuth2 + X-API-Key)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Auto-Save Ativo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-slate-400 block mb-1 text-[11px]">
                    DVSA OAuth2 Token URL (Microsoft Entra ID)
                  </label>
                  <input
                    placeholder="https://login.microsoftonline.com/<tenantId>/oauth2/v2.0/token"
                    value={db.settings.dvsaTokenUrl || ''}
                    onChange={(e) => updateSettings({ dvsaTokenUrl: e.target.value })}
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">
                    DVSA API Key (`x-api-key`)
                  </label>
                  <input
                    type="password"
                    placeholder="Chave x-api-key da DVSA..."
                    value={db.settings.dvsaApiKey || ''}
                    onChange={(e) => updateSettings({ dvsaApiKey: e.target.value })}
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">DVSA Client ID</label>
                  <input
                    placeholder="Client ID..."
                    value={db.settings.dvsaClientId || ''}
                    onChange={(e) => updateSettings({ dvsaClientId: e.target.value })}
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-400 block mb-1 text-[11px]">
                    DVSA Client Secret
                  </label>
                  <input
                    type="password"
                    placeholder="Client Secret..."
                    value={db.settings.dvsaClientSecret || ''}
                    onChange={(e) => updateSettings({ dvsaClientSecret: e.target.value })}
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestDvsaConnection}
                  disabled={testingDvsa}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  {testingDvsa
                    ? 'Testando DVSA...'
                    : isPt
                    ? 'Salvar & Testar Placa (SG09ZNJ)'
                    : 'Save & Test Plate (SG09ZNJ)'}
                </button>
              </div>

              {dvsaTestStatus && (
                <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 font-mono text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{dvsaTestStatus}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">UK Bank Name</label>
                <input
                  value={db.settings.ukBankName}
                  onChange={(e) => updateSettings({ ukBankName: e.target.value })}
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Monthly Profit Target (£ GBP)
                </label>
                <input
                  type="number"
                  value={db.settings.monthlyProfitTargetGbp}
                  onChange={(e) =>
                    updateSettings({ monthlyProfitTargetGbp: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">UK Sort Code</label>
                <input
                  value={db.settings.ukSortCode}
                  onChange={(e) => updateSettings({ ukSortCode: e.target.value })}
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">
                  UK Account Number
                </label>
                <input
                  value={db.settings.ukAccountNumber}
                  onChange={(e) => updateSettings({ ukAccountNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1 text-[11px]">
                  Revolut / Monzo Payment Link
                </label>
                <input
                  value={db.settings.ukPaymentLink}
                  onChange={(e) => updateSettings({ ukPaymentLink: e.target.value })}
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-lg px-3 py-2 text-amber-300 font-mono"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <Database className="w-4 h-4" />
            2. Local-First IndexedDB + Supabase Cloud Sync
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isPt
              ? 'Todas as alterações que você faz no app já ficam salvas automaticamente no seu navegador/dispositivo em tempo real (IndexedDB + LocalStorage). Se quiser sincronizar em nuvem entre o PC e o celular Android, insira seu projeto Supabase abaixo.'
              : 'All changes are persisted automatically in real time via IndexedDB + LocalStorage. Configure Supabase below to sync across multiple devices.'}
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Supabase Project URL</label>
              <input
                placeholder="https://xyzcompany.supabase.co"
                value={db.settings.supabaseUrl || ''}
                onChange={(e) => updateSettings({ supabaseUrl: e.target.value })}
                className="w-full bg-slate-950 border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Supabase Anon Public Key</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={db.settings.supabaseAnonKey || ''}
                onChange={(e) => updateSettings({ supabaseAnonKey: e.target.value })}
                className="w-full bg-slate-950 border border-white/[0.08] rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-bold">
                <input
                  type="checkbox"
                  checked={db.settings.enableSupabaseSync}
                  onChange={(e) => updateSettings({ enableSupabaseSync: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4"
                />
                {isPt ? 'Ativar Sincronização Supabase' : 'Enable Supabase Cloud Sync'}
              </label>

              <button
                type="button"
                onClick={handleSync}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                {isPt ? 'Sincronizar Agora' : 'Test Cloud Sync'}
              </button>
            </div>
            {syncStatus && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-white/[0.08] text-amber-300 font-mono text-xs">
                {syncStatus}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Editable Base Service Catalog */}
      <section className="glass-panel rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              EDITABLE UK SERVICE CATALOG ({db.serviceCatalog.length} SERVICES)
            </span>
            <h2 className="text-base font-black text-white">
              {isPt
                ? '3. Tabela Editável de Serviços & Tempos Padrão (Escócia / UK)'
                : '3. Editable UK Workshop Service Prices & Standard Bay Times'}
            </h2>
          </div>

          <button
            type="button"
            onClick={resetDemoData}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            {isPt ? 'Restaurar Catálogo Padrão LT Auto' : 'Reset to Default LT Auto Seed Data'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {db.serviceCatalog.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 bg-slate-950/70 border border-white/[0.06] p-3 rounded-xl"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">
                  {isPt ? item.namePt : item.nameEn}
                </div>
                <div className="text-[10px] text-slate-400">{item.category}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">£</span>
                  <input
                    type="number"
                    value={item.basePriceGbp}
                    onChange={(e) =>
                      updateServiceCatalogItem({
                        ...item,
                        basePriceGbp: Number(e.target.value),
                      })
                    }
                    className="w-16 bg-slate-900 border border-white/[0.08] rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-400"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={item.estimatedMinutes}
                    onChange={(e) =>
                      updateServiceCatalogItem({
                        ...item,
                        estimatedMinutes: Number(e.target.value),
                      })
                    }
                    className="w-14 bg-slate-900 border border-white/[0.08] rounded-lg px-2 py-1 text-xs font-mono font-bold text-white"
                  />
                  <span className="text-[10px] text-slate-400">m</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

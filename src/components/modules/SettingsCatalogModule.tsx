import React, { useState } from 'react';
import { Cloud, Database, RotateCcw, Settings } from 'lucide-react';
import { useApp } from '../../context/AppContext';

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

  const handleSync = async () => {
    setSyncStatus(isPt ? 'Sincronizando com Supabase...' : 'Syncing with Supabase...');
    const res = await triggerCloudSync();
    setSyncStatus(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Editable Base Service Catalog */}
      <section className="bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              EDITABLE UK SERVICE CATALOG ({db.serviceCatalog.length} SERVICES)
            </span>
            <h2 className="text-xl font-black text-white">
              {isPt
                ? 'Tabela Editável de Serviços & Tempos Padrão (Escócia / UK)'
                : 'Editable UK Workshop Service Prices & Standard Bay Times'}
            </h2>
          </div>

          <button
            type="button"
            onClick={resetDemoData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-slate-200 flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            {isPt ? 'Restaurar Catálogo Padrão LT Auto' : 'Reset to Default LT Auto Seed Data'}
          </button>
        </div>

        <div className="space-y-2.5">
          {db.serviceCatalog.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-950/70 border border-slate-800 p-3 rounded-xl"
            >
              <div className="sm:col-span-6">
                <div className="text-sm font-bold text-white">
                  {isPt ? item.namePt : item.nameEn}
                </div>
                <div className="text-xs text-slate-400">{item.category}</div>
              </div>

              <div className="sm:col-span-3 flex items-center gap-2">
                <label className="text-xs text-slate-400">Preço (£):</label>
                <input
                  type="number"
                  value={item.basePriceGbp}
                  onChange={(e) =>
                    updateServiceCatalogItem({
                      ...item,
                      basePriceGbp: Number(e.target.value),
                    })
                  }
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-amber-400"
                />
              </div>

              <div className="sm:col-span-3 flex items-center gap-2">
                <label className="text-xs text-slate-400">Est. (min):</label>
                <input
                  type="number"
                  value={item.estimatedMinutes}
                  onChange={(e) =>
                    updateServiceCatalogItem({
                      ...item,
                      estimatedMinutes: Number(e.target.value),
                    })
                  }
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-white"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* UK Banking, DVLA API & Supabase Cloud Adapter Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {isPt
              ? 'Dados Bancários UK (Faster Payments / Revolut) & DVLA API'
              : 'UK Bank Details (Faster Payments) & DVLA VRM API'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">UK Bank Name</label>
              <input
                value={db.settings.ukBankName}
                onChange={(e) => updateSettings({ ukBankName: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Monthly Profit Target (£ GBP)</label>
              <input
                type="number"
                value={db.settings.monthlyProfitTargetGbp}
                onChange={(e) =>
                  updateSettings({ monthlyProfitTargetGbp: Number(e.target.value) })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">UK Sort Code</label>
              <input
                value={db.settings.ukSortCode}
                onChange={(e) => updateSettings({ ukSortCode: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">UK Account Number</label>
              <input
                value={db.settings.ukAccountNumber}
                onChange={(e) => updateSettings({ ukAccountNumber: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-slate-400 block mb-1">Revolut / Monzo Payment Link</label>
              <input
                value={db.settings.ukPaymentLink}
                onChange={(e) => updateSettings({ ukPaymentLink: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-amber-300 font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-slate-400 block mb-1">
                GOV.UK DVLA Vehicle Enquiry API Key (Opcional — Gratuita no portal DVLA UK)
              </label>
              <input
                type="password"
                placeholder="Insira sua chave da API DVLA UK caso queira consulta governamental online..."
                value={db.settings.dvlaApiKey || ''}
                onChange={(e) => updateSettings({ dvlaApiKey: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
              />
            </div>
          </div>
        </section>

        <section className="bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-base font-extrabold text-emerald-400 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Local-First IndexedDB + Supabase Cloud Sync Adapter
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isPt
              ? 'O LT Auto OS roda 100% offline/local-first no seu celular Android, tablet Launch CRP919X ou PC via IndexedDB + LocalStorage. Para sincronizar em nuvem entre dispositivos, insira sua URL e Anon Key do Supabase abaixo.'
              : 'LT Auto OS operates 100% offline/local-first via IndexedDB + LocalStorage. To enable real-time PostgreSQL cloud sync across mobile, tablet, and desktop, configure your Supabase project credentials below.'}
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Supabase Project URL</label>
              <input
                placeholder="https://xyzcompany.supabase.co"
                value={db.settings.supabaseUrl || ''}
                onChange={(e) => updateSettings({ supabaseUrl: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Supabase Anon Public Key</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={db.settings.supabaseAnonKey || ''}
                onChange={(e) => updateSettings({ supabaseAnonKey: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
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
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg flex items-center gap-1.5"
              >
                <Cloud className="w-4 h-4" />
                {isPt ? 'Sincronizar Agora' : 'Test Cloud Sync'}
              </button>
            </div>
            {syncStatus && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-mono text-xs">
                {syncStatus}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

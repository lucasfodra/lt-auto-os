import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Banknote,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileDown,
  Landmark,
  QrCode,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UkPlateBadge } from '../common/UkPlateBadge';
import { generateWorkOrderPdf } from '../../services/pdfInvoiceGenerator';
import { PaymentMethod } from '../../types/domain';

export const PaymentsHubModule: React.FC = () => {
  const {
    db,
    uiLang,
    docLang,
    activeCheckoutOrderId,
    setActiveCheckoutOrderId,
    markOrderPaid,
  } = useApp();
  const isPt = uiLang === 'PT-BR';

  const selectedOrder = useMemo(
    () =>
      db.workOrders.find((w) => w.id === activeCheckoutOrderId) ||
      db.workOrders.find((w) => w.status === 'Completed' || w.status === 'InProgress') ||
      db.workOrders[0],
    [db.workOrders, activeCheckoutOrderId]
  );

  const [customGbpAmount, setCustomGbpAmount] = useState<number>(
    selectedOrder?.grossTotalGbp ?? 45
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UK_BANK');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedBankDetails, setCopiedBankDetails] = useState(false);

  useEffect(() => {
    if (selectedOrder) {
      setCustomGbpAmount(selectedOrder.grossTotalGbp);
    }
  }, [selectedOrder]);

  // Dynamic Revolut / Monzo UK Payment Link with amount & reference
  const dynamicUkPaymentUrl = useMemo(() => {
    const base = db.settings.ukPaymentLink.replace(/\/$/, '');
    return `${base}/${customGbpAmount.toFixed(2)}gbp`;
  }, [db.settings.ukPaymentLink, customGbpAmount]);

  useEffect(() => {
    QRCode.toDataURL(dynamicUkPaymentUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: '#0B0F17',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [dynamicUkPaymentUrl]);

  const bankDetailsFormatted = `LT AUTO SCOTLAND\nBank: ${db.settings.ukBankName}\nSort Code: ${db.settings.ukSortCode}\nAccount Number: ${db.settings.ukAccountNumber}\nReference: ${selectedOrder?.vrm || 'LTAUTO'}\nAmount: £${customGbpAmount.toFixed(2)}`;

  const handleCopyUkBankDetails = async () => {
    try {
      await navigator.clipboard.writeText(bankDetailsFormatted);
      setCopiedBankDetails(true);
      setTimeout(() => setCopiedBankDetails(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleConfirmPayment = () => {
    if (!selectedOrder) return;
    markOrderPaid(selectedOrder.id, paymentMethod);
  };

  const handleDownloadReceipt = () => {
    if (!selectedOrder) return;
    const veh = db.vehicles.find((v) => v.id === selectedOrder.vehicleId);
    generateWorkOrderPdf({
      workOrder: selectedOrder,
      vehicle: veh,
      services: db.serviceCatalog,
      modifiers: db.modifiersCatalog,
      settings: db.settings,
      documentLanguage: docLang,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 5 Cols: Order Selection & UK Payment Method Selector */}
      <div className="lg:col-span-5 space-y-6">
        <section className="bg-[#161F30] border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            1. {isPt ? 'Selecionar Ordem de Serviço no Checkout' : 'Select Work Order to Settle'}
          </span>

          <select
            aria-label="Select Work Order to Settle"
            value={selectedOrder?.id || ''}
            onChange={(e) => setActiveCheckoutOrderId(e.target.value)}
            className="w-full min-h-[48px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-sm font-bold text-white"
          >
            {db.workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                #{wo.orderNumber} • {wo.vrm} ({wo.customerName}) — £{wo.grossTotalGbp.toFixed(2)} [
                {wo.status}]
              </option>
            ))}
          </select>

          {selectedOrder && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <UkPlateBadge vrm={selectedOrder.vrm} size="sm" />
                <div className="text-sm font-bold text-white mt-1.5">
                  {selectedOrder.vehicleLabel}
                </div>
                <div className="text-xs text-slate-400">{selectedOrder.customerName}</div>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-bold text-slate-400 block">Total GBP</span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  £{selectedOrder.grossTotalGbp.toFixed(2)}
                </span>
                <span className="block text-[11px] font-bold text-emerald-400 uppercase mt-0.5">
                  Status: {selectedOrder.status}
                </span>
              </div>
            </div>
          )}

          {/* Custom Amount Control */}
          <div className="pt-2">
            <label className="text-xs text-slate-400 font-semibold block mb-1">
              {isPt ? 'Valor a Cobrar (£ GBP)' : 'Charge Amount (£ GBP)'}
            </label>
            <input
              type="number"
              step="0.5"
              value={customGbpAmount}
              onChange={(e) => setCustomGbpAmount(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-base font-black font-mono text-white"
            />
          </div>

          {/* 3 UK Payment Method Tabs */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
              2. {isPt ? 'Método de Recebimento UK (Escócia)' : 'Select UK Checkout Method'}
            </span>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('UK_BANK')}
                className={`min-h-[54px] px-4 py-3 rounded-xl border font-bold text-left flex items-center justify-between transition ${
                  paymentMethod === 'UK_BANK'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm">
                  <Landmark className="w-5 h-5 text-amber-400" />
                  🇬🇧 UK Faster Payments (Sort Code &amp; Account)
                </span>
                <span className="font-mono font-black text-amber-400">
                  £{customGbpAmount.toFixed(2)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('REVOLUT_QR')}
                className={`min-h-[54px] px-4 py-3 rounded-xl border font-bold text-left flex items-center justify-between transition ${
                  paymentMethod === 'REVOLUT_QR'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm">
                  <QrCode className="w-5 h-5 text-emerald-400" />
                  📱 Revolut / Monzo Pay Link + Apple/Google Pay QR
                </span>
                <span className="font-mono font-black text-emerald-400">
                  £{customGbpAmount.toFixed(2)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`min-h-[54px] px-4 py-3 rounded-xl border font-bold text-left flex items-center justify-between transition ${
                  paymentMethod === 'CASH'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm">
                  <Banknote className="w-5 h-5 text-blue-400" />
                  💷 Cash in Hand (Scottish / Bank of England £ Notes)
                </span>
                <span className="font-mono font-black text-blue-300">
                  £{customGbpAmount.toFixed(2)}
                </span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Right 7 Cols: Live UK Checkout Terminal + 1-Click Mark as Paid */}
      <div className="lg:col-span-7">
        <section className="bg-[#161F30] border-2 border-amber-500/70 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                LT AUTO SCOTLAND — KEY-HANDOVER CHECKOUT TERMINAL
              </span>
              <h2 className="text-2xl font-black text-white">
                {paymentMethod === 'UK_BANK'
                  ? `UK Faster Payments: £${customGbpAmount.toFixed(2)}`
                  : paymentMethod === 'REVOLUT_QR'
                  ? `Revolut / Apple Pay Instant QR: £${customGbpAmount.toFixed(2)}`
                  : `Cash in Hand (£ GBP): £${customGbpAmount.toFixed(2)}`}
              </h2>
            </div>
            {selectedOrder && <UkPlateBadge vrm={selectedOrder.vrm} size="md" />}
          </div>

          {(paymentMethod === 'UK_BANK' || paymentMethod === 'REVOLUT_QR') && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
              <div className="sm:col-span-5 flex flex-col items-center bg-white p-4 rounded-2xl shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="UK Payment QR Code"
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-900 font-bold">
                    Generating QR...
                  </div>
                )}
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider mt-2">
                  Scan for Revolut / Apple Pay (£{customGbpAmount.toFixed(2)})
                </span>
              </div>

              <div className="sm:col-span-7 space-y-3">
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account Name:</span>
                    <span className="font-bold text-white">LT AUTO SCOTLAND</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">UK Bank:</span>
                    <span className="font-semibold text-amber-300">{db.settings.ukBankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sort Code:</span>
                    <span className="font-mono font-black text-lg text-emerald-400">
                      {db.settings.ukSortCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account Number:</span>
                    <span className="font-mono font-black text-lg text-white">
                      {db.settings.ukAccountNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Reference:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {selectedOrder?.vrm || 'LTAUTO'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Direct Link:</span>
                    <a
                      href={dynamicUkPaymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-amber-400 underline flex items-center gap-1"
                    >
                      {dynamicUkPaymentUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUkBankDetails}
                  className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs"
                >
                  {copiedBankDetails ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      {isPt ? 'Dados Bancários UK Copiados!' : 'UK Bank Details Copied!'}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {isPt
                        ? 'Copiar Sort Code & Account Number para WhatsApp'
                        : 'Copy UK Bank Details & Reference'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {paymentMethod === 'CASH' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 text-center space-y-2">
              <Banknote className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="text-xl font-black text-white">
                £{customGbpAmount.toFixed(2)} Cash in Hand (Royal Bank of Scotland / Clydesdale /
                BoE Notes)
              </div>
              <p className="text-xs text-slate-400">
                {isPt
                  ? 'Clique abaixo para dar baixa imediata em Libras (£) no caixa da oficina e emitir o recibo PDF.'
                  : 'Click below to mark the Work Order as Paid in full and issue the customer receipt.'}
              </p>
            </div>
          )}

          {/* Bottom Confirmation & PDF Receipt Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleConfirmPayment}
              className="min-h-[54px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 text-base shadow-lg transition"
            >
              <CheckCircle2 className="w-5 h-5" />
              {selectedOrder?.status === 'Paid'
                ? isPt
                  ? '✓ Pago Confirmado (£ GBP)!'
                  : '✓ Marked as Paid (£ GBP)!'
                : isPt
                ? 'Confirmar Recebimento (£ GBP)'
                : 'Mark Work Order as Paid (£ GBP)'}
            </button>

            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="min-h-[54px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition"
            >
              <FileDown className="w-5 h-5 text-amber-400" />
              {isPt ? 'Emitir Recibo & Dossiê PDF' : 'Download Paid PDF Receipt'} ({docLang})
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

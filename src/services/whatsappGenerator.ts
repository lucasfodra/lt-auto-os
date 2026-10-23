import {
  ComplexityModifier,
  Customer,
  Language,
  PartItem,
  PartsSourcingMode,
  ServiceCatalogItem,
  Vehicle,
} from '../types/domain';
import { QuoteCalculationResult } from './pricingEngine';

export interface WhatsAppQuotePayload {
  outputLanguage: Language;
  customerName: string;
  vrm: string;
  vehicleLabel: string;
  selectedServices: ServiceCatalogItem[];
  selectedModifiers: ComplexityModifier[];
  calculation: QuoteCalculationResult;
  scheduledDate?: string;
  partsSourcingMode?: PartsSourcingMode;
  parts?: PartItem[];
  oilSpec?: string;
}

function formatFriendlyDuration(minutes: number, lang: Language): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return lang === 'PT-BR' ? `${hrs}h` : `${hrs} hr${hrs > 1 ? 's' : ''}`;
  return `${hrs}h${mins.toString().padStart(2, '0')}m`;
}

export function generateWhatsAppQuoteText(payload: WhatsAppQuotePayload): string {
  const {
    outputLanguage,
    customerName,
    vrm,
    vehicleLabel,
    selectedServices,
    selectedModifiers,
    calculation,
    scheduledDate,
    oilSpec,
  } = payload;

  const formattedDate = scheduledDate
    ? new Date(`${scheduledDate}T12:00:00Z`).toLocaleDateString(
        outputLanguage === 'PT-BR' ? 'pt-BR' : 'en-GB',
        { weekday: 'short', day: '2-digit', month: '2-digit' }
      )
    : outputLanguage === 'PT-BR'
    ? 'Data a combinar'
    : 'Date TBC';

  const firstName = customerName
    ? customerName.split(' ')[0]
    : outputLanguage === 'PT-BR'
    ? 'Cliente'
    : 'Mate';

  const friendlyTurnaround = formatFriendlyDuration(
    calculation.customerPromisedMinutes,
    outputLanguage
  );

  if (outputLanguage === 'PT-BR') {
    const servicesList = selectedServices
      .map((s) => `• ${s.namePt}: *£${s.basePriceGbp.toFixed(2)}*`)
      .join('\n');

    const modifiersList =
      selectedModifiers.length > 0
        ? '\n*Adicionais de Complexidade / Acesso:*\n' +
          selectedModifiers.map((m) => `• ${m.namePt}: *+£${m.surchargeGbp.toFixed(2)}*`).join('\n')
        : '';

    const discountsLines: string[] = [];
    if (calculation.comboDiscountGbp > 0) {
      discountsLines.push(
        `• Desconto Combo (2+ Serviços no mesmo Box): *-£${calculation.comboDiscountGbp.toFixed(2)}*`
      );
    }
    if (calculation.diagnosticDiscountGbp > 0) {
      discountsLines.push(
        `• Abatimento Diagnóstico + Reparo: *-£${calculation.diagnosticDiscountGbp.toFixed(2)}*`
      );
    }

    const discountsSection =
      discountsLines.length > 0 ? '\n*Descontos Aplicados:*\n' + discountsLines.join('\n') : '';

    const customerShoppingList = selectedServices
      .map((s) => s.partsCustomerShouldBringPt)
      .filter(Boolean)
      .map((item) => `  ✓ ${item}`)
      .join('\n');

    const partsChecklistBlock = customerShoppingList
      ? `\n🛒 *O QUE VOCÊ PRECISA TRAZER (Peças por conta do cliente):*\n${customerShoppingList}${
          oilSpec ? `\n  🛢️ *Especificação Exata do Motor:* ${oilSpec}` : ''
        }\n*(Se precisar, te mando o link direto da Euro Car Parts ou Autodoc UK pela placa ${vrm}!)*`
      : '';

    return `🔧 *LT AUTO — LIVINGSTON, SCOTLAND* 🏴󠁧󠁢󠁳󠁣󠁴󠁿
Olá *${firstName}*! Segue o orçamento de *Mão de Obra* e previsão de tempo para o seu carro:

🚘 *Veículo:* ${vehicleLabel}
🟨 *Placa (VRM):* [ *${vrm.toUpperCase()}* ]

*Serviços (Mão de Obra Especializada):*
${servicesList}${modifiersList}${discountsSection}
${partsChecklistBlock}

⏰ *AGENDA & PREVISÃO DE ENTREGA:*
• Data: *${formattedDate}*
• Horário de Chegada: *${calculation.dropOffSlot}* (Tempo estimado: ~*${friendlyTurnaround}* → Pronto para retirar por volta das *${calculation.promisedReadyTime}*!)

🎁 *Cortesia Inclusa LT Auto:*
• Scan Eletrônico Completo via *Launch CRP919X* + Reset da Luz de Revisão

💷 *VALOR TOTAL (Mão de Obra):* *£${calculation.labourTotalGbp.toFixed(2)}*
*(Pagamento na retirada via UK Bank Transfer, Revolut ou Cash)*

Quer confirmar esse horário das *${calculation.dropOffSlot}*? 👊🔧`;
  }

  // EN-GB British English Version (UK Terminology: VRM, Labour-Only, Drop-off, Ready for Collection)
  const servicesListEn = selectedServices
    .map((s) => `• ${s.nameEn}: *£${s.basePriceGbp.toFixed(2)}*`)
    .join('\n');

  const modifiersListEn =
    selectedModifiers.length > 0
      ? '\n*Vehicle Complexity Adjustments:*\n' +
        selectedModifiers.map((m) => `• ${m.nameEn}: *+£${m.surchargeGbp.toFixed(2)}*`).join('\n')
      : '';

  const discountsEn: string[] = [];
  if (calculation.comboDiscountGbp > 0) {
    discountsEn.push(
      `• Multi-Service Combo Discount: *-£${calculation.comboDiscountGbp.toFixed(2)}*`
    );
  }
  if (calculation.diagnosticDiscountGbp > 0) {
    discountsEn.push(
      `• Diagnostic + Repair Booking Credit: *-£${calculation.diagnosticDiscountGbp.toFixed(2)}*`
    );
  }

  const discountsSectionEn =
    discountsEn.length > 0 ? '\n*Discounts Applied:*\n' + discountsEn.join('\n') : '';

  const customerShoppingListEn = selectedServices
    .map((s) => s.partsCustomerShouldBringEn)
    .filter(Boolean)
    .map((item) => `  ✓ ${item}`)
    .join('\n');

  const partsChecklistBlockEn = customerShoppingListEn
    ? `\n🛒 *PARTS FOR YOU TO BRING (Labour-Only Service):*\n${customerShoppingListEn}${
        oilSpec ? `\n  🛢️ *Required OEM Engine Spec:* ${oilSpec}` : ''
      }\n*(Happy to send over the exact Euro Car Parts / Autodoc UK part links for VRM ${vrm} if needed!)*`
    : '';

  return `🔧 *LT AUTO — DIAGNOSTIC & MECHANICAL (LIVINGSTON, UK)* 🇬🇧
Hi *${firstName}*, here is your *Labour-Only Quotation* & turnaround time for:

🚘 *Vehicle:* ${vehicleLabel}
🟨 *VRM (Reg):* [ *${vrm.toUpperCase()}* ]

*Itemised Labour:*
${servicesListEn}${modifiersListEn}${discountsSectionEn}
${partsChecklistBlockEn}

⏰ *BOOKING DATE & COLLECTION SCHEDULE:*
• Date: *${formattedDate}*
• Drop-off Time: *${calculation.dropOffSlot}* (Takes approx. *${friendlyTurnaround}* → Ready for collection around *${calculation.promisedReadyTime}*!)

🎁 *Complimentary with Service:*
• Full All-System ECU Health Scan via *Launch CRP919X* & Service Interval Reset

💷 *TOTAL LABOUR TO PAY:* *£${calculation.labourTotalGbp.toFixed(2)}*
*(UK Faster Payments / Revolut / Cash on collection)*

Would you like me to lock in the *${calculation.dropOffSlot}* slot for you? 👍`;
}

export function generateProactiveRadarReminder(
  customer: Customer,
  vehicle: Vehicle,
  alertType: 'MOT' | 'SERVICE',
  daysRemaining: number,
  overrideLang?: Language
): string {
  const lang = overrideLang ?? customer.preferredLanguage;
  const firstName = customer.name.split(' ')[0];

  if (lang === 'PT-BR') {
    if (alertType === 'MOT') {
      return `Olá *${firstName}*, tudo bem? Aqui é da *LT Auto (Livingston)*! 🏴󠁧󠁢󠁳󠁣󠁴󠁿🔧
Nosso sistema avisou que o *MOT* do seu *${vehicle.make} ${vehicle.model}* (Placa *${vehicle.vrm}*) vence em *${daysRemaining} dias* (${vehicle.motExpiryDate}).

Quer agendar a nossa *Inspeção Pré-MOT + Scan Eletrônico Launch (£35.00)* essa semana (leva só 45 min) para levantar o carro, checar suspensão/freios e te passar a lista exata caso precise comprar alguma peça antes do teste? Me avisa qual horário fica bom! 👊`;
    }
    return `Olá *${firstName}*, tudo bem? Aqui é da *LT Auto (Livingston)*! 🏴󠁧󠁢󠁳󠁣󠁴󠁿🔧
Passando para lembrar que a revisão/troca de óleo do seu *${vehicle.make} ${vehicle.model}* (Placa *${vehicle.vrm}*, óleo *${vehicle.oilSpec}*) está prevista para *${vehicle.nextServiceDueDate}* (${daysRemaining} dias)${
      customer.driverProfile === 'high_mileage' ? ' — ciclo intensivo Delivery/Uber de 3 meses' : ''
    }.

É só trazer o óleo e o filtro que a nossa *Mão de Obra de Troca de Óleo + Filtro + Scan Launch* sai por apenas *£30.00* e faço em *45 minutinhos* na hora! Bora agendar seu horário? 🚗💨`;
  }

  // EN-GB
  if (alertType === 'MOT') {
    return `Hi *${firstName}*, hope you're well! Quick heads-up from *LT Auto in Livingston* 🇬🇧🔧
Our system shows the *MOT* on your *${vehicle.make} ${vehicle.model}* (*${vehicle.vrm}*) is due in *${daysRemaining} days* (${vehicle.motExpiryDate}).

Would you like to book our *£35.00 Pre-MOT Inspection & Full Launch ECU Scan* (takes ~45 mins) so we can check suspension, brakes & emissions and give you an exact parts list if anything needs sorting before test day? 👍`;
  }

  return `Hi *${firstName}*, hope you're well! Quick reminder from *LT Auto in Livingston* 🇬🇧🔧
Your *${vehicle.make} ${vehicle.model}* (*${vehicle.vrm}*) is due its periodic *Oil & Filter Service* around *${vehicle.nextServiceDueDate}* (${daysRemaining} days)${
    customer.driverProfile === 'high_mileage' ? ' (3-month High-Mileage Courier/Taxi interval)' : ''
  }.

Just bring along your oil & filter (${vehicle.oilSpec}) — our *Oil & Filter Change Labour + Complimentary Launch ECU Scan & Service Reset* is just *£30.00* and takes ~45 mins while you wait! Reply here to grab a slot! 🚗`;
}

export function buildEuroCarPartsUrl(vrm: string): string {
  const cleanVrm = vrm.replace(/\s+/g, '').toUpperCase();
  return `https://www.eurocarparts.com/?vrm=${encodeURIComponent(cleanVrm)}`;
}

export function buildAutodocUkUrl(make: string, model: string, engine: string): string {
  const query = `${make} ${model} ${engine}`.trim();
  return `https://www.autodoc.co.uk/spares-search?keyword=${encodeURIComponent(query)}`;
}

export function buildGovUkMotHistoryUrl(vrm: string): string {
  const cleanVrm = vrm.replace(/\s+/g, '').toUpperCase();
  return `https://www.check-mot.service.gov.uk/results?registration=${encodeURIComponent(cleanVrm)}`;
}

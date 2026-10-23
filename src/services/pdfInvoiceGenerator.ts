import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ComplexityModifier, Language, ServiceCatalogItem, Vehicle, WorkOrder, WorkshopSettings } from '../types/domain';

export interface InvoiceGenerationOptions {
  workOrder: WorkOrder;
  vehicle?: Vehicle;
  services: ServiceCatalogItem[];
  modifiers: ComplexityModifier[];
  settings: WorkshopSettings;
  documentLanguage: Language;
}

export function generateWorkOrderPdf(options: InvoiceGenerationOptions): void {
  const { workOrder, vehicle, services, modifiers, settings, documentLanguage } = options;
  const isPt = documentLanguage === 'PT-BR';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Dark Automotive Header (#0B0F17)
  doc.setFillColor(11, 15, 23);
  doc.rect(0, 0, 210, 42, 'F');

  // Amber Accent Bar (#F59E0B)
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 42, 210, 2.5, 'F');

  // Brand Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('LT AUTO — DIAGNOSTIC & MECHANICAL SERVICES', 14, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${settings.location}  |  WhatsApp: ${settings.phone}`, 14, 24);
  doc.text(
    isPt
      ? 'Certificado de Serviço, Diagnóstico Eletrônico Launch X-431 Pro & Dossiê Técnico'
      : 'Service Invoice, Launch X-431 Pro ECU Health Dossier & Technical Receipt',
    14,
    30
  );

  // Yellow UK VRM Plate Badge in Header Right
  doc.setFillColor(255, 204, 0);
  doc.roundedRect(150, 11, 46, 14, 2, 2, 'F');
  doc.setFillColor(0, 51, 153);
  doc.rect(150, 11, 7, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('UK', 151.5, 19.5);

  doc.setTextColor(11, 15, 23);
  doc.setFontSize(13);
  doc.text(workOrder.vrm.toUpperCase(), 176, 20, { align: 'center' });

  // Order metadata below badge
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(9);
  doc.text(`#${workOrder.orderNumber}`, 196, 33, { align: 'right' });

  // Vehicle & Customer Info Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 50, 182, 30, 2, 2, 'F');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(isPt ? 'DADOS DO CLIENTE & VEÍCULO' : 'CUSTOMER & VEHICLE DETAILS', 18, 57);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const dateStr = new Date(workOrder.completedAt || workOrder.createdAt).toLocaleDateString(
    isPt ? 'pt-BR' : 'en-GB'
  );
  doc.text(`${isPt ? 'Cliente' : 'Customer'}: ${workOrder.customerName} (${workOrder.customerPhone})`, 18, 63);
  doc.text(`${isPt ? 'Veículo' : 'Vehicle'}: ${workOrder.vehicleLabel}`, 18, 69);
  doc.text(
    `VIN: ${vehicle?.vin || 'N/A'}   |   ${isPt ? 'Óleo Spec' : 'Oil Spec'}: ${
      workOrder.oilSpecUsed || vehicle?.oilSpec || 'OEM Spec'
    }`,
    18,
    75
  );

  doc.text(`${isPt ? 'Data' : 'Date'}: ${dateStr}`, 130, 63);
  doc.text(
    `${isPt ? 'Quilometragem' : 'Recorded Mileage'}: ${workOrder.recordedMileage.toLocaleString()} miles`,
    130,
    69
  );
  doc.text(
    `${isPt ? 'Status' : 'Invoice Status'}: ${workOrder.status.toUpperCase()}${
      workOrder.paymentMethod ? ` (${workOrder.paymentMethod})` : ''
    }`,
    130,
    75
  );

  // Itemised Table
  const selectedServices = services.filter((s) => workOrder.selectedServiceIds.includes(s.id));
  const selectedModifiers = modifiers.filter((m) => workOrder.selectedModifierIds.includes(m.id));

  const tableRows: (string | number)[][] = [];

  for (const srv of selectedServices) {
    tableRows.push([
      isPt ? 'Mão de Obra (Serviço)' : 'Labour (Service)',
      isPt ? srv.namePt : srv.nameEn,
      `£${srv.basePriceGbp.toFixed(2)}`,
    ]);
  }

  for (const mod of selectedModifiers) {
    tableRows.push([
      isPt ? 'Adicional Técnico' : 'Technical Surcharge',
      isPt ? mod.namePt : mod.nameEn,
      `+£${mod.surchargeGbp.toFixed(2)}`,
    ]);
  }

  if (workOrder.comboDiscountApplied && workOrder.comboDiscountGbp > 0) {
    tableRows.push([
      isPt ? 'Desconto Combo' : 'Multi-Service Combo Discount',
      isPt ? 'Desconto Pacote 2+ Serviços no mesmo Box' : 'Combined Bay Setup Discount (2+ Services)',
      `-£${workOrder.comboDiscountGbp.toFixed(2)}`,
    ]);
  }

  if (workOrder.diagnosticDiscountApplied) {
    tableRows.push([
      isPt ? 'Crédito Diagnóstico' : 'Diagnostic Booking Credit',
      isPt ? 'Abatimento Diagnóstico + Reparo Fechado' : 'Diagnostic Fee Discounted with Repair Booking',
      '-£10.00',
    ]);
  }

  if (workOrder.partsSourcingMode === 'LT_AUTO_SUPPLIES') {
    for (const part of workOrder.parts) {
      tableRows.push([
        isPt ? 'Peça / Insumo' : 'Parts Supplied',
        part.name,
        `£${part.clientPriceGbp.toFixed(2)}`,
      ]);
    }
  } else {
    tableRows.push([
      isPt ? 'Peças' : 'Parts Sourcing',
      isPt
        ? 'Peças fornecidas pelo cliente (Zero custo repassado)'
        : 'Customer supplied parts (Labour-only invoice)',
      '£0.00',
    ]);
  }

  autoTable(doc, {
    startY: 85,
    head: [
      [
        isPt ? 'Categoria' : 'Category',
        isPt ? 'Descrição do Serviço / Item' : 'Itemised Description',
        isPt ? 'Valor (GBP)' : 'Amount (GBP)',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [22, 31, 48],
      textColor: [245, 158, 11],
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 108 },
      2: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 150;

  // Totals Block
  doc.setFillColor(11, 15, 23);
  doc.roundedRect(120, finalY + 6, 76, 26, 2, 2, 'F');
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${isPt ? 'Mão de Obra Líquida' : 'Total Labour'}: £${workOrder.labourTotalGbp.toFixed(2)}`,
    191,
    finalY + 13,
    { align: 'right' }
  );
  doc.text(
    `${isPt ? 'Subtotal Peças' : 'Total Parts'}: £${workOrder.partsClientTotalGbp.toFixed(2)}`,
    191,
    finalY + 19,
    { align: 'right' }
  );

  doc.setTextColor(16, 185, 129);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `${isPt ? 'TOTAL' : 'TOTAL DUE'}: £${workOrder.grossTotalGbp.toFixed(2)}`,
    191,
    finalY + 27,
    { align: 'right' }
  );

  // Diagnostic & Health Report Section
  const diagY = finalY + 38;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, diagY, 182, 48, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isPt
      ? 'RELATÓRIO DE SAÚDE ELETRÔNICA (LAUNCH CRP919X) & ADVISORIES'
      : 'LAUNCH CRP919X ELECTRONIC HEALTH REPORT & ADVISORIES',
    18,
    diagY + 8
  );

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(
    isPt
      ? '✓ Status Eletrônico: Todas as ECUs Escaneadas via Launch X-431 / CRP919X — Reset de Serviço Concluído'
      : '✓ Diagnostic Status: All ECUs Scanned via Launch X-431 / CRP919X — Service Interval Reset Completed',
    18,
    diagY + 15
  );

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  const dtcText =
    workOrder.dtcFaults.length > 0
      ? workOrder.dtcFaults.join(' | ')
      : isPt
      ? 'Nenhuma falha ativa presente na memória de injeção/ABS/Airbag.'
      : 'No active DTC fault codes stored in Engine/ABS/SRS modules.';
  doc.text(`DTC Log: ${dtcText}`, 18, diagY + 22, { maxWidth: 174 });

  doc.setFont('helvetica', 'bold');
  doc.text(
    isPt ? 'Recomendações Técnicas / Advisories:' : 'Technician Advisories & Warranty Notes:',
    18,
    diagY + 31
  );
  doc.setFont('helvetica', 'normal');
  doc.text(
    workOrder.advisoryNotes ||
      (isPt
        ? 'Rodas torqueadas conforme especificação OEM. Pedal de freio pressurizado e níveis conferidos.'
        : 'Wheel nuts torqued to OEM specification. Brake pedal primed and underbonnet fluid levels checked.'),
    18,
    diagY + 37,
    { maxWidth: 174 }
  );

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `LT Auto OS — Livingston, Scotland, UK  |  UK Faster Payments (${settings.ukSortCode} / ${settings.ukAccountNumber})  |  ${settings.ukPaymentLink}`,
    105,
    287,
    { align: 'center' }
  );

  doc.save(`LT-Auto-Invoice-${workOrder.vrm.replace(/\s+/g, '')}-${workOrder.orderNumber}.pdf`);
}

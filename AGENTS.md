# AI Handover & Architecture Guide (`AGENTS.md`)

This repository is structured so that **any AI agent (Antigravity, Claude Code, Cursor, Copilot, Windsurf, OpenAI Codex)** or human developer can immediately understand, modify, test, and deploy **LT Auto OS** from anywhere.

## 1. Core Design Principles
- **Separation of Concerns:** UI components (`src/components/modules/*`) never hardcode pricing math or WhatsApp templates. All domain logic lives in `src/services/*` and `src/data/*`.
- **Scottish / UK Technical Vehicle & Service Database (`src/data/ukVehicleDatabase.ts`):**
  - Pre-loaded with technical specifications for the most common cars in Scotland/UK (Ford EcoBoost/TDCi/EcoBlue, Vauxhall Corsa/Astra/Mokka, VW/Audi/SEAT/Skoda TDI/TSI, Renault/Dacia/Nissan TCe/dCi, Peugeot/Citroën PureTech/BlueHDi, Toyota Prius/Auris/Yaris Uber & Delivery hybrids, Honda, Hyundai/Kia, BMW/MINI).
  - Includes exact OEM oil viscosity & specification, sump capacity (Litres), sump plug torque (Nm), wheel nut torque (Nm), complexity flags, and mechanic workshop notes.
- **Dual-Language Independence (`uiLang` vs `docLang`):**
  - `uiLang` controls the mechanic's interface language (`PT-BR` or `EN-GB`).
  - `docLang` controls the customer-facing output language for **WhatsApp Quotes**, **Proactive Radar Reminders**, and **PDF Invoices/Dossiers**. Even when the mechanic uses the app in Portuguese (`PT-BR`), they can generate an invoice or quote in British English (`EN-GB`) using authentic UK automotive terminology (*VRM, Labour, Sump Plug, Brake Pads, Discs, MOT, Advisories*).
- **100% UK Payments (`PaymentsHubModule.tsx`):**
  - Focused exclusively on UK Faster Payments (Sort Code & Account Number), Revolut / Monzo dynamic GBP QR links, and Cash in Hand (£ GBP).
- **Local-First + Cloud-Ready Persistence:** `src/services/repository.ts` implements `LTAutoRepository`, persisting every state mutation synchronously to `localStorage` and asynchronously to `IndexedDB` (`LTAutoOS_IndexedDB`), with a built-in `@supabase/supabase-js` adapter.

## 2. How to Add or Modify Features Safely
1. **Adding New UK Vehicles or Services:**
   - Add vehicle specs to `UK_VEHICLE_SPECS_DB` or services to `UK_EXTENDED_SERVICE_CATALOG` in `src/data/ukVehicleDatabase.ts`, or edit prices/times directly in the UI under the **Settings** tab.
2. **Modifying Pricing or Hourly Yield Rules:**
   - Edit `calculateSmartQuote()` or `analyzeLiveBayYield()` in `src/services/pricingEngine.ts`.
   - Always run `npm run test` afterwards to verify zero regressions.
3. **Modifying PDF Invoice Branding or Layout:**
   - Edit `generateWorkOrderPdf()` in `src/services/pdfInvoiceGenerator.ts`.
4. **Running Encapsulated Tests & Updating Reports:**
   - Execute `npm run test:report` to run Vitest and regenerate `test-reports/vitest-report.json`.
   - Execute `npm run build` to verify strict TypeScript compilation (`tsc -b`) and Vite production bundling.

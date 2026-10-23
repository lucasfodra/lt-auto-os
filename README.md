# LT Auto OS — Workshop, Smart Quoting, Bay Stopwatch, Payments & BI Suite

**LT Auto OS** is a production-ready, offline-first, cross-platform Progressive Web Application (PWA) built for **LT Auto (Livingston, West Lothian, Scotland, UK)**. It is engineered to work seamlessly on:
- **Android Mobile** (on the street / quick WhatsApp quoting)
- **Android 7" Garage Tablet / Launch CRP919X** (landscape high-contrast bay stopwatch & checklist)
- **Desktop PC Web Browser** (financial BI, PDF invoice generation & fleet CRM)

---

## Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Start development server (accessible on LAN / mobile via --host)
npm run dev

# 3. Run encapsulated unit & integration tests
npm run test

# 4. Generate JSON & Markdown test reports
npm run test:report

# 5. Build production bundle (PWA ready)
npm run build
```

---

## Architecture & Directory Map (AI & Developer Handover Ready)

Every business rule is decoupled into pure, deterministic TypeScript services inside `src/services/` so any engineer or AI coding assistant can inspect, test, or extend the system without side effects:

```text
├── public/
│   ├── manifest.webmanifest          # Installable PWA manifest for Android & Desktop
│   ├── sw.js                         # Offline-first Service Worker cache
│   └── icon.svg                      # LT Auto UK Plate vector icon
├── src/
│   ├── types/
│   │   └── domain.ts                 # Complete TypeScript interfaces for all 6 modules
│   ├── data/
│   │   └── seedData.ts               # Pre-populated Livingston UK seed fleet, OS & Copart flips
│   ├── i18n/
│   │   └── translations.ts           # Bilingual dictionary (PT-BR & EN-GB UK terminology)
│   ├── services/
│   │   ├── pricingEngine.ts          # Module 1 & 2: Smart Quoting + Live Bay Stopwatch £/h yield math
│   │   ├── pixGenerator.ts           # Module 4: Valid EMVCo BR Code (PIX) + CRC16-CCITT & GBP->BRL FX
│   │   ├── whatsappGenerator.ts      # Module 1 & 3: PT-BR / EN-GB WhatsApp Quotes & 30-day Radar alerts
│   │   ├── pdfInvoiceGenerator.ts    # Module 5: Client-side A4 PDF Invoice & Launch ECU Dossier
│   │   └── repository.ts             # Repository Pattern: LocalStorage + IndexedDB + Supabase Sync Adapter
│   ├── context/
│   │   └── AppContext.tsx            # Global reactive state + 1-second live bay stopwatch ticker
│   ├── components/
│   │   ├── common/
│   │   │   └── UkPlateBadge.tsx      # Authentic UK Yellow Rear Registration Plate (VRM) component
│   │   └── modules/
│   │       ├── SmartQuotingModule.tsx        # Module 1 ("Calculadora Anti-Trouxa")
│   │       ├── WorkOrdersStopwatchModule.tsx # Module 2 ("Cronômetro de Box vs. Cobrado")
│   │       ├── CrmRevenueRadarModule.tsx     # Module 3 ("Carteira & Radar de Demanda 30d")
│   │       ├── PaymentsHubModule.tsx         # Module 4 ("UK Faster Payments + PIX Dinâmico")
│   │       ├── FinancialAnalyticsModule.tsx  # Module 6 ("BI Financeiro, Simulador & Copart Flips")
│   │       └── SettingsCatalogModule.tsx     # Editable Service Catalog + Supabase Cloud Config
│   └── test/
│       ├── setup.ts                  # Vitest + Testing Library setup
│       └── ltAutoSuite.test.ts       # Encapsulated automated test suite covering all core engines
└── test-reports/
    ├── vitest-report.json            # Machine-readable test execution report
    └── TEST_REPORT.md                # Human & AI readable test verification summary
```

---

## Optional Supabase PostgreSQL Cloud Sync Setup

By default, **LT Auto OS** works 100% out-of-the-box using **LocalStorage + IndexedDB** pre-loaded with realistic LT Auto Livingston seed data.

To enable multi-device cloud synchronization via **Supabase**:
1. Create a table `lt_auto_snapshots` in your Supabase PostgreSQL database:
   ```sql
   create table public.lt_auto_snapshots (
     id text primary key,
     updated_at timestamptz not null default now(),
     payload jsonb not null
   );
   ```
2. Open the **Catálogo & Config (Settings)** tab in the app, paste your `Supabase Project URL` and `Anon Public Key`, check **Enable Supabase Cloud Sync**, and click **Test Cloud Sync**.

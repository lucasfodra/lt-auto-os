# LT Auto OS — Automated Test & Quality Assurance Report (UK Edition)

- **Project:** LT Auto OS (Workshop, UK Vehicle Spec DB, Pricing, Time-Tracking & Analytics Suite)
- **Location Context:** Livingston, West Lothian, Scotland, UK
- **Test Runner:** Vitest v2.1.9 (`jsdom` environment)
- **JSON Output Artifact:** [`test-reports/vitest-report.json`](./vitest-report.json)
- **Status:** **PASS (10 / 10 Test Suites & Assertions Passing — 100%)**

---

## Encapsulated Test Coverage Matrix

| Module | Test Case | Verified Rules & Assertions | Status |
| :--- | :--- | :--- | :---: |
| **Module 1: Smart Quoting** | Base Services + Combo Discount (`-£5.00`) | Sums base services (£30 Oil + £25 Front Pads = £55), detects `2+ services`, applies `-£5.00` combo discount -> `£50.00` final, and calculates projected hourly rate (`£50.00/h`). | ✅ PASS |
| **Module 1: Smart Quoting** | Launch CRP919X Diagnostic Credit (`-£10.00`) | Detects when `LAUNCH_DIAGNOSTIC` (£30) is paired with any repair service and automatically applies the `-£10.00` credit rule alongside combo discounts. | ✅ PASS |
| **Module 1: Smart Quoting** | Parts Sourcing Margin Separation | Verifies that when `LT_AUTO_SUPPLIES` is active, part cost (£30), markup (20%), and convenience fee (£5) are separated into `Gross Revenue (£81)` vs `Net Profit (£51)`. | ✅ PASS |
| **Module 1: Smart Quoting** | Complexity Modifier Auto-Recommendation | Auto-triggers `EPB_SCANNER (+£10)`, `HEAVY_UNDERTRAY (+£5)`, and `SCOTTISH_RUST (+£15)` based on vehicle flags (`hasEPB`, `hasComplexUndertray`, `scottishRustRisk`). | ✅ PASS |
| **UK Vehicle Database** | Scottish/UK Common Cars Technical Specs | Verifies `UK_VEHICLE_SPECS_DB` (21+ core UK engine families) with OEM oil viscosity, sump litres, sump plug torque (Nm), wheel nut torque (Nm), and wet-belt warnings. | ✅ PASS |
| **UK VRM Plate Decoder** | DVLA Age Identifier & Scottish Prefix | Decodes UK registration plates (`SH64 WRF` -> 2014 Scottish `S*`, `SO18 XZP` -> 2018 Scottish `S*`, `DV66 UKB` -> 2016) automatically. | ✅ PASS |
| **Module 2: Bay Stopwatch** | High-Efficiency Emerald Tier (`£90.00/h`) | Verifies that finishing a £45 / 45-min job in 30 minutes yields `£90.00/h` and triggers the `EMERALD` visual glow state. | ✅ PASS |
| **Module 2: Bay Stopwatch** | Overtime Amber/Red Alert Tier (`£30.00/h`) | Verifies that taking 90 minutes on a £45 / 45-min job drops real yield to `£30.00/h` and triggers the `AMBER_RED` price-review alert. | ✅ PASS |
| **Module 1 & 5: i18n Output** | Independent Document Language (`PT-BR` vs `EN-GB`) | Verifies that WhatsApp quotes & PDF invoices render in either `PT-BR` or `EN-GB` (with 100% UK payment methods: *UK Faster Payments / Revolut / Cash*). | ✅ PASS |
| **Data Access Layer** | Repository Pattern & Extended UK Service Menu | Verifies LocalStorage/IndexedDB initialization with 16 standard UK workshop services and realistic Livingston fleet seed data. | ✅ PASS |

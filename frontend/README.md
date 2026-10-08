# FloodShield AI — Frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS application for coastal flood intelligence, simulation, and emergency response.

## 📁 Structure

- `src/app/` — Application pages:
  - `page.tsx`: Overview & status dashboard
  - `simulation/page.tsx`: Real-time interactive simulation controls & map canvas
  - `alerts/page.tsx`: Risk zone prioritization & emergency alerts
  - `analytics/page.tsx`: Decision model pipeline & conversational AI assistant
- `src/components/ui/` — Reusable components: `Button`, `Card`, `Badge`
- `src/components/layout/` — `Navbar`, `Footer`
- `src/lib/` — Helper utilities (`cn`)
- `src/types/` — Type definitions

## 🛠️ Scripts

- `npm run dev` — Start Next.js development server
- `npm run build` — Build production bundle
- `npm run start` — Run production server
- `npm run lint` — Run ESLint check

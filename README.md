# FloodShield AI — Frontend Boilerplate

AI-Powered Coastal Flood Intelligence, Simulation, and Early Warning System for India.

## 🚀 Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **UI Components:** Reusable accessible component library (`Button`, `Card`, `Badge`) with `cva`, `clsx`, and `tailwind-merge`

---

## 📁 Project Structure

```text
src/
├── app/
│   ├── layout.tsx         # Root layout with top navigation bar and footer
│   ├── page.tsx           # Main Overview dashboard
│   ├── globals.css        # Tailwind styling and custom themes
│   ├── simulation/
│   │   └── page.tsx       # Real-time simulation engine controls & map canvas
│   ├── alerts/
│   │   └── page.tsx       # Risk zone prioritization table & emergency alerts
│   └── analytics/
│       └── page.tsx       # AI Decision Models (Juve & Laya) & Conversational Assistant
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx     # Responsive sticky navigation bar
│   │   └── Footer.tsx     # Standardized footer
│   └── ui/
│       ├── button.tsx     # Reusable button with variants
│       ├── card.tsx       # Reusable card suite
│       └── badge.tsx      # Risk-level and status badges
├── lib/
│   └── utils.ts           # ClassName merger utility (cn)
└── types/
    └── index.ts           # Domain TypeScript definitions (FloodZone, SimulationParams, etc.)
```

---

## 🛠️ Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Build for production:**
   ```bash
   npm run build
   npm run start
   ```

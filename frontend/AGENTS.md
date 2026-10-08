# Frontend Engineering & UI/UX Standards

## Core Design Rules

1. **NO EMOJIS ANYWHERE**:
   - Never use unicode emojis (such as 🚀, 🛰️, 🌊, 🏥, ⚡, ⚠️, etc.) in any part of the codebase.
   - All visual indications must use crisp SVG iconography from `lucide-react` or clean typography pills/badges.

2. **Design Philosophy — Mission-Critical Intelligence Dashboard**:
   - Clean, professional, high-density command center aesthetic.
   - Inspired by high-end geospatial intelligence systems (Palantir Foundry, Linear, modern defense telemetry).
   - High precision: crisp hairline borders (`border-zinc-800/80`), subtle slate gradients, matte backdrop blurs (`backdrop-blur-md`).
   - Clean typography hierarchy: Geist Sans for UI headings and body, Geist Mono for coordinates, sensor values, tidal measurements, and timestamps.

3. **Color System & Contrast**:
   - Dark mode primary with deep zinc/slate tones (`#090d16`, `#0b1120`, `#0f172a`).
   - High-contrast text (`text-zinc-100`, `text-zinc-400`).
   - Semantic status indicators:
     - Normal / Safe: Emerald (`text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/30`)
     - Moderate / Watch: Sky / Cyan (`text-sky-400`, `bg-sky-500/10`, `border-sky-500/30`)
     - High Alert: Amber (`text-amber-400`, `bg-amber-500/10`, `border-amber-500/30`)
     - Critical Hazard: Rose / Red (`text-rose-400`, `bg-rose-500/10`, `border-rose-500/30`)

4. **Component Architecture**:
   - Reusable UI atoms in `src/components/ui/` with `class-variance-authority` and `cn()`.
   - Accessible button states, focus rings, hover transitions, and clean disabled states.
   - Next.js dynamic client components for MapLibre GL with graceful loading skeletons.

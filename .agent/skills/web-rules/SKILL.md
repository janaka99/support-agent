---
name: web-rules
description: >
  Frontend coding conventions and design system for the support-agent Next.js dashboard.
  Use when writing or reviewing any file inside the web/ directory — pages, components,
  hooks, contexts, or lib utilities.
---

# Web Rules Skill

Read `web/AGENTS.md` for the full, authoritative reference. The summary below is a quick-reference checklist.

## Quick Checklist Before Writing Any Frontend Code

1. **Where does this file go?**
   - Page route → `web/app/(dashboard)/<route>/page.tsx` (authenticated) or `web/app/(auth)/<route>/page.tsx` (public auth)
   - Shared layout → `web/app/(dashboard)/layout.tsx`
   - Reusable UI component → `web/components/ui/<name>.tsx`
   - Feature component → `web/components/<feature>/<name>.tsx`
   - API calls → `web/lib/api/` (never inline fetch in a component)
   - Auth logic → `web/contexts/auth.tsx`
   - Shared utilities → `web/lib/utils.ts`

2. **Auth — always use the context**
   - Read token/user from `useAuth()` hook from `web/contexts/auth.tsx`
   - Never read from `localStorage` directly in a component
   - Protected pages must check `if (!user) redirect('/login')`

3. **API calls — always go through `web/lib/api/`**
   - Never write a raw `fetch()` call in a component or page
   - The API client handles the `Authorization: Bearer <token>` header automatically
   - Use `@tanstack/react-query` (`useQuery` / `useMutation`) for all data fetching

4. **Design tokens — never hardcode colors or spacing**
   - Use only CSS variables or Tailwind classes defined in `globals.css`
   - See "Design System" section below for the full token reference

5. **Forms — always use react-hook-form + zod**
   - Define a `zod` schema for every form
   - Use `zodResolver` with `useForm`
   - Never manage form state with raw `useState`

6. **Class names — always use `cn()` utility**
   - Import `cn` from `@/lib/utils`
   - Never concatenate class strings manually

---

## Design System

### Palette (slate-based dark, not black)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#0f172a` | Page background (slate-900) |
| `--bg-surface` | `#1e293b` | Cards, panels (slate-800) |
| `--bg-overlay` | `#334155` | Hover states, subtle fills (slate-700) |
| `--border` | `#334155` | All borders (slate-700) |
| `--border-subtle` | `#1e293b` | Inner dividers |
| `--accent` | `#14b8a6` | Primary actions, focus rings, highlights (teal-500) |
| `--accent-dim` | `#0d9488` | Hover state for accent (teal-600) |
| `--text-primary` | `#f1f5f9` | Body text (slate-100) |
| `--text-muted` | `#94a3b8` | Secondary text, labels (slate-400) |
| `--text-dim` | `#64748b` | Disabled, placeholders (slate-500) |
| `--error` | `#f87171` | Error states (red-400) |
| `--success` | `#34d399` | Success states (emerald-400) |
| `--warning` | `#fbbf24` | Warning states (amber-400) |

### Typography

| Role | Font | Usage |
|------|------|-------|
| Display | `Inter` | Headings, page titles |
| Body | `Inter` | All body text, labels, buttons |
| Mono | `JetBrains Mono` | Agent IDs, UUIDs, code snippets, API keys |

### Component Rules

**Buttons**
- Primary: `bg-accent text-white hover:bg-accent-dim` (teal)
- Secondary: `bg-bg-overlay text-text-primary border border-border`
- Destructive: `bg-error/10 text-error border border-error/30`

**Cards / Panels**
- Base: `bg-bg-surface border border-border rounded-xl`
- Inner sections: separate with `border-t border-border-subtle`

**Inputs**
- Base: `bg-bg-base border border-border rounded-md text-text-primary placeholder:text-text-dim focus:ring-1 focus:ring-accent focus:border-accent`

**The Signature Element**
- The sidebar uses a frosted glass treatment: `bg-bg-surface/60 backdrop-blur-sm border-r border-border`
- This is the one distinctive visual. Everything else should be clean and restrained.

---

## Key File Locations

| File | Purpose |
|------|---------|
| `web/AGENTS.md` | Full frontend conventions reference |
| `web/lib/api/index.ts` | All API calls. The single source of truth for HTTP requests. |
| `web/lib/utils.ts` | `cn()` utility and other shared helpers |
| `web/contexts/auth.tsx` | Auth context — user, token, org, login(), logout() |
| `web/app/globals.css` | All design tokens as CSS variables + Tailwind extensions |
| `web/middleware.ts` | Route protection — redirects unauthenticated users to /login |
| `web/components/ui/` | Primitive UI components (button, input, card, badge, etc.) |

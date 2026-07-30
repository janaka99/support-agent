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

4. **Forms — always use react-hook-form + zod + ui/form**
   - Define a `zod` schema for every form
   - Use `zodResolver` with `useForm`
   - Never manage form state with raw `useState`
   - Use `<Form>`, `<FormField>`, `<FormItem>`, `<FormControl>`, etc. from `@/components/ui/form`

5. **Class names — always use `cn()` utility**
   - Import `cn` from `@/lib/utils`
   - Never concatenate class strings manually

6. **Docker & Dependencies**
   - If you add or update any packages in `package.json`, you MUST rebuild the Docker container.
   - Run `docker-compose -f infra/docker-compose.yml up -d --force-recreate --build -V web` from the project root. (The `-V` or `--renew-anon-volumes` flag is critical to prevent Docker from reusing the old `node_modules` anonymous volume!)

---

name: support-agent-design-system
description: House style for the Support Agent Next.js app. Load this before styling, redesigning, or building any page or component (login, dashboard, sidebar, settings, modals, tables). Encodes the actual tokens and primitive classes already defined in globals.css — the goal is that no two pages look like they came from different defaults, and that nobody re-invents a card, badge, or button style that already exists.

---

# Support Agent — Design System

Dark, zinc-based, indigo accent. This is a tool support agents live in for
a full shift — calm and fast, not decorative. `globals.css` is the single
source of truth for every token and primitive class below; don't hardcode
hex values or invent new component classes when one already exists here.

## The subject, restated

The most honest visual material in this product is the ticket queue:
IDs, statuses, timestamps, wait times. When a page needs a signature
moment (empty states, login, onboarding), reach for real ticket shapes —
`.mono` IDs, `.badge` statuses — before reaching for illustration or a
decorative gradient.

## Color tokens

All defined in `:root` in `globals.css`. Reference them as Tailwind
utilities (`bg-bg-base`, `text-text-secondary`, `border-border`, etc. —
they're registered under `@theme inline`), not as raw hex or arbitrary
`bg-[#...]` values.

| Token                                                  | Value                                        | Use for                                             |
| ------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------- |
| `--bg-base`                                            | zinc-950 `#09090b`                           | Page background                                     |
| `--bg-surface`                                         | zinc-900 `#18181b`                           | Cards, panels, sidebar                              |
| `--bg-elevated`                                        | zinc-800 `#27272a`                           | Hover fills, dropdowns                              |
| `--bg-overlay`                                         | zinc-700 `#3f3f46`                           | Input backgrounds                                   |
| `--border` / `--border-strong`                         | zinc-800 / zinc-700                          | Default dividers / emphasized borders               |
| `--accent` / `--accent-hover`                          | indigo-500 `#6366f1` / indigo-600            | CTAs, focus rings, live states, links               |
| `--accent-muted`                                       | indigo @ 10% opacity                         | Tinted backgrounds — active nav item, ambient glows |
| `--text-primary` / `--text-secondary` / `--text-muted` | zinc-50 / zinc-400 / zinc-500                | Body text / secondary text / labels & placeholders  |
| `--error` / `--success` / `--warning` / `--info`       | red-500 / emerald-500 / amber-500 / blue-500 | Semantic states — alerts, badges                    |

**Rule: `--accent` means "live/primary."** Focus rings, the primary
button, an online indicator, active nav state, links. It is not used as
a large decorative fill. A fifth color for a new use case is almost
always one of the four semantic colors, not a new brand hue — don't add
one without updating this table.

Semantic colors map to urgency in the ticket domain specifically:
`error` = needs an agent now, `warning` = waiting/pending, `success` =
resolved, `info` = neutral/informational. Keep that mapping consistent
across badges, alerts, and any status indicator.

## Type

- **Sans** (`--font-sans` → Inter): everything — headings, body, labels,
  buttons. There's no separate display face; personality comes from
  weight and size (semibold/tight-tracking for headings), not a second
  family.
- **Mono** (`--font-mono` → JetBrains Mono, via the `.mono` class or
  `font-mono` utility): anything that's _data_ — ticket IDs, timestamps,
  counts, keyboard shortcuts. If the system generated the value rather
  than a human writing it, it's mono.

## Component primitives — use these before writing new CSS

`globals.css` already defines these as plain classes. Check here before
adding a new one:

- **Surfaces:** `.card` (surface + border + radius-lg)
- **Form fields:** `.input`, `.textarea`, `.select`, `.label`
- **Buttons:** `.btn` + one of `.btn-primary` / `.btn-secondary` /
  `.btn-ghost` / `.btn-danger`, sized with `.btn-sm` / `.btn-lg` /
  `.btn-icon`. (shadcn `<Button>` is also fine — it's wired to the same
  `--primary`/`--secondary` vars, so the two systems stay visually
  identical. Prefer shadcn components for anything using react-hook-form;
  use the raw `.btn`/`.input` classes for non-form UI or plain HTML.)
- **Status:** `.badge` + `.badge-accent` / `.badge-success` /
  `.badge-error` / `.badge-warning` / `.badge-info` / `.badge-muted`
- **Feedback:** `.alert` + `.alert-error` / `.alert-success` /
  `.alert-warning`; `.spinner` (+ `.spinner-sm`/`.spinner-lg`);
  `.skeleton` for loading placeholders
- **Structure:** `.separator-h` / `.separator-v`, `.tooltip-wrapper`
  (CSS-only tooltip via `data-tooltip`)
- **Identifiers:** `.mono` for any ID/timestamp/count inline in prose

## Layout rules

- **The sidebar's glass treatment is the signature — reuse it, don't
  reinvent it.** Any full-height chrome panel (the sidebar, the login
  screen's brand panel, a command palette) uses the same translucent
  blur look, now factored out as `.glass-panel` (see
  `globals-additions.css`). One visual signature across the app, not a
  new one per screen.
- **Full-screen flows (login, onboarding) are split, not a centered
  floating card.** A `bg-bg-surface` brand panel with a real signature
  moment (queue preview, a stat) on one side, the form on `bg-bg-base` on
  the other. See `page.tsx`.
- **Sidebar pattern:** `.glass-panel` (or `bg-sidebar`) background,
  `border-border` between groups, nav text `text-text-secondary` at
  rest → `text-text-primary` on hover, active item gets `bg-accent-muted`
  with `text-accent` — never a solid accent fill on a nav row.
- **Radius:** `--radius` (0.5rem) for inputs/buttons, `--radius-lg`
  (0.75rem) for cards/panels, `--radius-xl` (1rem) for large surfaces
  like modals. Badges and the online dot are fully round (`rounded-full`).
- **Borders over shadows.** Use `--border`/`--border-strong` hairlines to
  separate regions; reserve elevation/shadow for true overlays (modals,
  dropdowns, tooltips).

## Motion

Keep it to what's already defined: `.transition-base` for hover/focus
color changes, `.spinner` for loading, `.skeleton` for placeholder
loading, the tooltip's 150ms fade. No page-load choreography, no new
ambient animation. `prefers-reduced-motion` is already handled globally —
don't bypass it in new components.

## Writing voice

- Buttons are active-voice verbs: "Sign in", "Save changes", "Assign
  ticket" — not "Submit" or "OK".
- Errors state what happened and what to do, no apology: "That email and
  password don't match our records," not "Oops, something went wrong!"
- Empty states are an invitation to act: say what's missing and what the
  person can do about it, not just an icon and gray text.
- Labels name what the person controls ("Email", "Password"), never
  internal/system terms.

## Before shipping a redesigned page, check

1. Every color traced back to a token in the table above — no raw hex.
2. Anything you were about to write custom CSS for — is there already a
   `.card`/`.badge`/`.alert`/`.btn` class that does it?
3. Is `--accent` used only for live/primary/active states, not decoration?
4. IDs/timestamps/counts in `.mono`, everything else in the default sans.
5. Does this page share the same glass signature as the sidebar and
   login screen, or does it feel like a fourth design language?

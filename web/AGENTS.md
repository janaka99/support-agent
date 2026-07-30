# Frontend Rules — Support Agent Dashboard

This file is the canonical reference for how the Next.js frontend is structured and how all new frontend code must be written. Read this before touching any file in `web/`.

---

## Project Structure

```
web/
├── app/
│   ├── (auth)/                  # Public auth routes — no layout wrapper
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/             # Protected routes — wrapped by dashboard layout
│   │   ├── layout.tsx           # Sidebar + topbar shell for all dashboard pages
│   │   ├── dashboard/page.tsx
│   │   ├── agents/
│   │   │   ├── page.tsx         # Agent list
│   │   │   ├── new/page.tsx     # Create agent
│   │   │   └── [id]/page.tsx    # Edit agent
│   │   ├── team/page.tsx
│   │   └── settings/page.tsx
│   ├── (public)/
│   │   └── chat/page.tsx        # End-customer-facing chat widget
│   ├── layout.tsx               # Root layout — wraps all routes in <AuthProvider>
│   ├── globals.css              # Design tokens + base styles
│   └── page.tsx                 # Redirects to /dashboard or /login
├── components/
│   ├── ui/                      # Primitive components (button, input, card, badge...)
│   └── <feature>/               # Feature-specific components
├── contexts/
│   └── auth.tsx                 # AuthContext + useAuth hook
├── lib/
│   ├── api/                     # Typed API client. All fetch() calls live here.
│   └── utils.ts                 # cn() utility and shared helpers
└── middleware.ts                # Route protection
```

---

## Non-Negotiable Rules

### 1. API calls go in `lib/api/` only
No raw `fetch()` inside components or pages. Import from `lib/api`.

### 2. Auth state comes from `useAuth()`
Never read from `localStorage` directly in a component. The context handles it.

### 3. Forms use react-hook-form + zod + ui/form
Every form has a Zod schema. No raw `useState` for form inputs. Use the consolidated `<Form>`, `<FormField>`, `<FormItem>`, `<FormControl>`, etc. components from `@/components/ui/form`.

### 4. Class names use `cn()`
Import from `@/lib/utils`. Never concatenate class strings manually.

### 5. Design tokens only — no hardcoded colors
Use CSS variables or the Tailwind classes derived from `globals.css`.

### 6. Protected routes check auth
Pages under `(dashboard)/` are protected by `middleware.ts`. Pages should also defensively guard.

### 7. Server vs Client Components
- Default to Server Components. Add `"use client"` only at the leaf that needs it.
- Never put `"use client"` on a layout file.

---

## Design System

**Palette — Zinc / Indigo**
- Background base: `#09090b` (zinc-950)
- Surfaces: `#18181b` (zinc-900)
- Accent: `#6366f1` (indigo-500)
- Text primary: `#fafafa`
- Text secondary: `#a1a1aa`

**Signature:** Sidebar uses heavily frosted glass `backdrop-blur(16px)` with `rgba(24, 24, 27, 0.70)`. Uses composable Cards (`Card`, `CardHeader`, `CardContent`, etc.) for all data containers.

Full token table and component guidelines in `.agent/skills/web-rules/SKILL.md`.

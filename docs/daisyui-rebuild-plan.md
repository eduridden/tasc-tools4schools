# DaisyUI Rebuild Plan

A phased plan to migrate the TASC Tools4Schools UI from custom Radix UI / shadcn components to DaisyUI 5. Each phase is independently shippable and non-breaking.

---

## Why DaisyUI?

- **65 production-ready components** — covers everything we use
- **Pure CSS classes** — no JS bundle overhead, works with any React pattern
- **Theme system** — one custom theme definition controls all colors site-wide
- **Tailwind v4 native** — `@plugin "daisyui"` drops straight into our existing `index.css`
- **Eliminates 20+ Radix UI packages** — massive reduction in dependency surface

---

## Current Pain Points

| Problem | DaisyUI Solution |
|---------|-----------------|
| 30+ `@radix-ui/*` packages to maintain | Single `daisyui` package |
| Hardcoded Tailwind colors everywhere | Semantic color tokens, theme-aware |
| Custom shadcn wrappers in `src/components/ui/` | Delete and replace with DaisyUI classes directly |
| No consistent dark mode | DaisyUI themes handle it automatically |
| Modal state managed with React state | Native `<dialog>` element |

---

## Phase 1 — Installation & Theme Setup

**Goal:** DaisyUI running alongside current code with zero visual change.

### Steps

**1. Install DaisyUI:**
```bash
npm install -D daisyui@latest
```

**2. Update `src/index.css`:**
```css
@import "tailwindcss";
@plugin "daisyui/theme" {
  name: "tasc";
  default: true;
  prefersdark: false;
  color-scheme: light;

  /* TASC brand blues mapped to DaisyUI tokens */
  --color-base-100: oklch(98% 0.01 240);
  --color-base-200: oklch(95% 0.02 240);
  --color-base-300: oklch(91% 0.03 240);
  --color-base-content: oklch(18% 0.05 240);

  --color-primary: oklch(42% 0.22 260);        /* indigo-900 equivalent */
  --color-primary-content: oklch(98% 0.01 260);

  --color-secondary: oklch(60% 0.18 240);
  --color-secondary-content: oklch(98% 0.01 240);

  --color-accent: oklch(55% 0.22 260);
  --color-accent-content: oklch(98% 0.01 260);

  --color-neutral: oklch(45% 0.05 240);
  --color-neutral-content: oklch(98% 0.01 240);

  --color-info: oklch(65% 0.18 220);           /* sky blue */
  --color-info-content: oklch(98% 0.01 220);

  --color-success: oklch(62% 0.22 145);        /* emerald */
  --color-success-content: oklch(98% 0.01 145);

  --color-warning: oklch(75% 0.22 75);         /* amber */
  --color-warning-content: oklch(20% 0.05 75);

  --color-error: oklch(60% 0.25 25);           /* rose */
  --color-error-content: oklch(98% 0.01 25);

  --radius-selector: 2rem;
  --radius-field: 0.5rem;
  --radius-box: 1rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}
@plugin "daisyui";
```

**3. Add `data-theme` to `index.html`:**
```html
<html lang="en" data-theme="tasc">
```

**Outcome:** DaisyUI is available but no components have changed yet. Existing UI renders exactly as before.

---

## Phase 2 — Header (`header.tsx`)

**Current:** Custom sticky header with Radix DropdownMenu, Avatar, Button.
**Target:** DaisyUI `navbar` + `dropdown` + `avatar` + `btn`.

### Component mapping

| Current | DaisyUI |
|---------|---------|
| `<header className="sticky top-0...">` | `<div class="navbar bg-base-100 shadow-sm sticky top-0 z-50">` |
| `<DropdownMenu>` (Radix) | `<div class="dropdown dropdown-end">` |
| `<Avatar>` (Radix) | `<div class="avatar"><div class="w-10 rounded-full">` |
| `<Button variant="ghost">` | `<button class="btn btn-ghost">` |
| `<Button className="bg-emerald-600...">` | `<button class="btn btn-success">` |
| `<Button className="bg-indigo-600...">` | `<button class="btn btn-primary btn-outline rounded-full">` |
| Mobile: hidden | Add hamburger + `drawer` toggle |

### Mobile nav
The current header has no mobile menu. Use `drawer` for a slide-in nav on mobile:
```html
<div class="drawer">
  <input id="nav-drawer" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content">
    <div class="navbar ...">
      <label for="nav-drawer" class="btn btn-ghost lg:hidden">☰</label>
      ...
    </div>
  </div>
  <div class="drawer-side">
    <label for="nav-drawer" class="drawer-overlay"></label>
    <ul class="menu bg-base-100 min-h-full w-72 p-4">...</ul>
  </div>
</div>
```

**Removes:** `@radix-ui/react-dropdown-menu`, `@radix-ui/react-avatar`

---

## Phase 3 — Stats Cards (`stats-cards.tsx`)

**Current:** Custom `<Card>` components with hardcoded background colors.
**Target:** DaisyUI `stats` component.

### Before (current pattern)
```jsx
<Card className="bg-sky-100 text-sky-700 ...">
  <p className="text-2xl font-bold">42</p>
  <p className="text-xs">Categories</p>
</Card>
```

### After (DaisyUI)
```html
<div class="stats stats-vertical sm:stats-horizontal shadow w-full">
  <div class="stat">
    <div class="stat-title">Total AI Tools</div>
    <div class="stat-value text-primary">42</div>
  </div>
  <div class="stat">
    <div class="stat-title">Categories</div>
    <div class="stat-value text-info">8</div>
  </div>
  <div class="stat">
    <div class="stat-title">Free Tools</div>
    <div class="stat-value text-success">18</div>
  </div>
  <div class="stat">
    <div class="stat-title">Recommended</div>
    <div class="stat-value text-warning">12</div>
  </div>
</div>
```

Loading state uses `skeleton`:
```html
<div class="skeleton h-20 w-full"></div>
```

---

## Phase 4 — Filters (`filters.tsx`)

**Current:** Radix Select, Switch, Label, Button, custom Input styling.
**Target:** DaisyUI `input`, `select`, `toggle`, `btn`, `join`.

### Search bar
```html
<label class="input input-lg w-full flex items-center gap-2">
  <svg ...><!-- search icon --></svg>
  <input type="text" placeholder="Search AI tools..." class="grow" />
</label>
```

### Filter selects
```html
<select class="select select-bordered w-full">
  <option value="all">All Categories</option>
  <option value="...">Writing</option>
</select>
```

### Recommended toggle
```html
<label class="flex items-center gap-2 cursor-pointer">
  <span class="label-text font-semibold">Recommended</span>
  <input type="checkbox" class="toggle toggle-warning" />
</label>
```

### View toggle (grid/table)
```html
<div class="join">
  <button class="join-item btn btn-sm btn-active">
    <!-- grid icon -->
  </button>
  <button class="join-item btn btn-sm">
    <!-- list icon -->
  </button>
</div>
```

### Reset button
```html
<button class="btn btn-outline btn-error btn-sm">
  <!-- icon --> Reset
</button>
```

**Removes:** `@radix-ui/react-select`, `@radix-ui/react-switch`, `@radix-ui/react-label`

---

## Phase 5 — Tool Card (`tool-card.tsx`)

**Current:** Custom Card with gradient header, hardcoded badge colors.
**Target:** DaisyUI `card` + `badge`.

### Card structure
```html
<div class="card bg-base-100 shadow-md hover:shadow-xl hover:-translate-y-1 
            transition-all cursor-pointer group" 
     role="button" tabindex="0">
  <!-- Gradient header — keep as custom bg utility -->
  <div class="rounded-t-2xl p-4 bg-gradient-to-br from-emerald-400 to-teal-500">
    <!-- designation badge -->
    <div class="badge badge-neutral absolute top-4 right-4">Recommended</div>
    <!-- logo + name -->
  </div>
  <div class="card-body gap-3 pt-3">
    <!-- cost + age badges -->
    <div class="flex gap-2">
      <span class="badge badge-success badge-outline">Free</span>
      <span class="badge badge-info badge-outline">All Ages</span>
    </div>
    <!-- category + subject badges -->
    <span class="badge badge-soft" style="background:{color}">Category</span>
    <!-- audience badges -->
    <span class="badge badge-secondary badge-soft">Teachers</span>
  </div>
</div>
```

### Badge color mapping

| Current | DaisyUI |
|---------|---------|
| `bg-emerald-50 text-emerald-700` (Free) | `badge-success badge-soft` |
| `bg-amber-50 text-amber-700` (Freemium) | `badge-warning badge-soft` |
| `bg-rose-50 text-rose-700` (Subscription) | `badge-error badge-soft` |
| `bg-sky-50 text-sky-700` (All Ages) | `badge-info badge-soft` |
| `bg-violet-50 text-violet-700` (13+) | `badge-secondary badge-soft` |
| Custom color from Firestore | `style="background:{color}"` (keep as-is) |

**Removes:** `@radix-ui/react-tooltip` (replace with DaisyUI `tooltip` class)

---

## Phase 6 — Tool Table (`tool-table.tsx`)

**Current:** Custom table markup with manual zebra striping.
**Target:** DaisyUI `table`.

```html
<div class="overflow-x-auto">
  <table class="table table-zebra table-pin-rows">
    <thead>
      <tr>
        <th>Tool</th>
        <th>Category</th>
        <th>Cost</th>
        <th>Age</th>
        <th>Audience</th>
      </tr>
    </thead>
    <tbody>
      <tr class="hover:bg-base-200 cursor-pointer">
        <td><!-- logo + name --></td>
        <td><span class="badge badge-soft">Writing</span></td>
        <td><span class="badge badge-success badge-soft">Free</span></td>
        <td><span class="badge badge-info badge-soft">All Ages</span></td>
        <td><!-- audience badges --></td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## Phase 7 — Modals

### ToolDetailModal (`tool-detail-modal.tsx`)

**Current:** Radix Dialog with custom overlay.
**Target:** Native `<dialog>` + DaisyUI `modal` + `tabs`.

```jsx
const dialogRef = useRef<HTMLDialogElement>(null);

useEffect(() => {
  if (isOpen) dialogRef.current?.showModal();
  else dialogRef.current?.close();
}, [isOpen]);

// JSX:
<dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle">
  <div className="modal-box max-w-3xl">
    {/* Tab navigation */}
    <div className="tabs tabs-lift mb-4">
      <input type="radio" name="tool-tabs" className="tab" aria-label="Overview" defaultChecked />
      <input type="radio" name="tool-tabs" className="tab" aria-label="Details" />
    </div>
    {/* content */}
    <div className="modal-action">
      <form method="dialog">
        <button className="btn">Close</button>
      </form>
    </div>
  </div>
  <form method="dialog" className="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

### LoginModal (`login-modal.tsx`)

Use DaisyUI `modal` with the login form template:
```jsx
<dialog ref={dialogRef} className="modal modal-middle">
  <div className="modal-box max-w-sm">
    <h3 className="font-bold text-lg mb-4">Sign in to TASC</h3>
    <button className="btn btn-block gap-2">
      <!-- Google icon -->
      Continue with Google
    </button>
    <div className="modal-action">
      <form method="dialog"><button className="btn btn-ghost btn-sm">Cancel</button></form>
    </div>
  </div>
  <form method="dialog" className="modal-backdrop"><button>close</button></form>
</dialog>
```

**Removes:** `@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`

---

## Phase 8 — Footer (`footer.tsx`)

**Current:** Custom footer with hardcoded `bg-blue-900` and `text-slate-400`.
**Target:** DaisyUI `footer` with `bg-primary text-primary-content`.

```html
<footer class="footer bg-primary text-primary-content p-10">
  <aside>
    <!-- logo / about -->
    <p class="font-bold text-lg">AI Tools for Schools</p>
    <p class="opacity-70 max-w-sm">Dedicated to providing educators and students...</p>
  </aside>
  <nav>
    <h6 class="footer-title opacity-60">Discovery</h6>
    <button class="link link-hover">✨ Recommended Tools</button>
    <button class="link link-hover">📂 Browse Categories</button>
  </nav>
  <nav>
    <h6 class="footer-title opacity-60">Target Groups</h6>
    <button class="link link-hover">👨‍🏫 For Educators</button>
    <button class="link link-hover">🎓 For Students</button>
  </nav>
</footer>
<footer class="footer footer-center bg-primary text-primary-content border-t border-primary-content/20 px-10 py-4 text-xs opacity-60">
  <p>© 2025 Anglican Schools Corporation. Licensed to TASC.</p>
  <nav class="flex gap-4">
    <a class="link link-hover">Privacy Policy</a>
    <a class="link link-hover">Contact Support</a>
  </nav>
</footer>
```

---

## Phase 9 — Submit Tool Modal (`submit-tool-modal.tsx`)

**Current:** Radix Dialog with manual form field styling.
**Target:** DaisyUI `modal` + `fieldset` + `input` + `select` + `textarea`.

```html
<fieldset class="fieldset">
  <legend class="fieldset-legend">Tool Information</legend>
  <label class="floating-label">
    <span>Tool Name</span>
    <input type="text" placeholder="Tool Name" class="input w-full" required />
  </label>
  <label class="floating-label">
    <span>URL</span>
    <input type="url" placeholder="https://..." class="input w-full" required />
  </label>
  <label>
    <span class="label">Description</span>
    <textarea class="textarea w-full" rows="3"></textarea>
  </label>
  <select class="select w-full">
    <option>Select Cost Model</option>
  </select>
</fieldset>
```

**Removes:** `@radix-ui/react-select` (remaining uses), `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`

---

## Phase 10 — Admin Dashboard (`Admin.tsx`)

**Current:** Uses many Radix/shadcn components for tabs, accordions, forms.
**Target:** DaisyUI `tabs`, `collapse`, `table`, `badge`, `alert`.

This is the largest phase — scope it into sub-tasks:
- Admin tool list → `table` with `badge` status indicators
- Edit tool form → `fieldset` + `input` + `select`
- Categories/Subjects management → `collapse` accordion
- Stats overview → `stats` component

---

## Cleanup Phase — Remove Radix Dependencies

After all phases are complete, remove unused packages:

```bash
npm uninstall \
  @radix-ui/react-accordion \
  @radix-ui/react-alert-dialog \
  @radix-ui/react-avatar \
  @radix-ui/react-checkbox \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-label \
  @radix-ui/react-popover \
  @radix-ui/react-radio-group \
  @radix-ui/react-select \
  @radix-ui/react-separator \
  @radix-ui/react-switch \
  @radix-ui/react-tabs \
  @radix-ui/react-toast \
  @radix-ui/react-tooltip \
  class-variance-authority \
  cmdk
```

Also delete `src/components/ui/` directory (the shadcn wrappers).

---

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| `@radix-ui/*` packages | 20+ | 0 |
| Custom UI wrappers in `src/components/ui/` | 30+ files | 0 |
| CSS bundle overhead | shadcn + custom | DaisyUI (smaller) |
| Dark mode support | Manual | Automatic via theme |
| Component consistency | Mixed | Unified |

---

## Quick Reference — Start Here

For each phase, the workflow is:
1. Use `mcp__daisyui-blueprint__daisyUI-Snippets` to fetch the relevant component HTML
2. Translate HTML to JSX (className, onClick, etc.)
3. Wire up existing React state/props — logic doesn't change
4. Remove the old Radix import once the component is replaced
5. Verify visually in dev server

Start with **Phase 1** (theme setup) then **Phase 2** (header) as it has the most visual impact.

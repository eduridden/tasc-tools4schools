# AGENTS.md — AI Agent Reference for TASC Tools4Schools

This file is the primary reference for AI agents (Claude, Gemini, etc.) working on this codebase. Read this before making any UI changes.

---

## Project Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 7 |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4 + **DaisyUI 5** |
| Backend | Firebase (Firestore, Auth, Functions) |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |

---

## UI Component Strategy

**DaisyUI is the primary component system.** Use DaisyUI classes directly in JSX wherever possible. The legacy Radix UI / shadcn wrappers in `src/components/ui/` are being progressively replaced — do not add new dependencies on them.

**Rule:** Before building a custom component, check if a DaisyUI component covers the use case. If it does, use it.

---

## DaisyUI Setup

DaisyUI 5 is configured as a Tailwind CSS plugin. The setup lives in [src/index.css](src/index.css):

```css
@import "tailwindcss";
@plugin "daisyui";
@plugin "daisyui/theme" {
  name: "tasc";
  default: true;
  /* ... TASC brand colors ... */
}
```

**Theme access:** Use `data-theme="tasc"` on the `<html>` element in [index.html](index.html).

**Color rule:** Always use DaisyUI semantic color names (`bg-primary`, `text-base-content`, `bg-base-200`, etc.) rather than Tailwind hardcoded colors (`bg-blue-600`, `text-slate-700`). This ensures dark mode and theme switching work automatically.

---

## DaisyUI Component Reference

### How to get snippets

Use the `mcp__daisyui-blueprint__daisyUI-Snippets` MCP tool to fetch live HTML snippets for any component. Example:
```json
{ "components": { "navbar": true, "card": true } }
{ "component-examples": { "navbar.responsive-dropdown-menu-on-small-screen-center-menu-on-large-screen": true } }
```

---

### Components in use in this project

#### `navbar` — [Header component](src/components/header.tsx)
```html
<div class="navbar bg-base-100 shadow-sm sticky top-0 z-50">
  <div class="navbar-start"><!-- logo + title --></div>
  <div class="navbar-end"><!-- auth buttons --></div>
</div>
```
- Mobile menu: use `drawer` + hamburger label (see drawer section)
- Key examples: `navbar.responsive-dropdown-menu-on-small-screen-center-menu-on-large-screen`

#### `card` — [ToolCard component](src/components/tool-card.tsx)
```html
<div class="card bg-base-100 shadow-md hover:shadow-xl cursor-pointer">
  <div class="card-body">
    <h2 class="card-title">Tool Name</h2>
    <div class="card-actions">...</div>
  </div>
</div>
```
- Modifiers: `card-border`, `card-side`, `image-full`
- Sizes: `card-xs` through `card-xl`

#### `badge` — used in ToolCard for cost, age, categories, subjects
```html
<span class="badge badge-success">Free</span>
<span class="badge badge-warning">Freemium</span>
<span class="badge badge-error">Subscription</span>
<span class="badge badge-info">All Ages</span>
```
- Styles: `badge-outline`, `badge-soft`, `badge-dash`, `badge-ghost`
- Colors: `badge-neutral`, `badge-primary`, `badge-secondary`, `badge-accent`, `badge-info`, `badge-success`, `badge-warning`, `badge-error`
- Sizes: `badge-xs` through `badge-xl`

#### `stat` — [StatsCards component](src/components/stats-cards.tsx)
```html
<div class="stats stats-vertical sm:stats-horizontal shadow">
  <div class="stat">
    <div class="stat-title">Total AI Tools</div>
    <div class="stat-value">42</div>
  </div>
</div>
```
- Parts: `stat-title`, `stat-value`, `stat-desc`, `stat-figure`, `stat-actions`

#### `footer` — [Footer component](src/components/footer.tsx)
```html
<footer class="footer bg-primary text-primary-content p-10">
  <nav>
    <h6 class="footer-title">Discovery</h6>
    <a class="link link-hover">Recommended Tools</a>
  </nav>
</footer>
```
- `footer-title` styles section headings
- `sm:footer-horizontal` for responsive layout

#### `modal` — [ToolDetailModal](src/components/tool-detail-modal.tsx), [LoginModal](src/components/login-modal.tsx)
```html
<!-- Trigger -->
<button onclick="my_modal.showModal()">Open</button>

<!-- Modal -->
<dialog id="my_modal" class="modal">
  <div class="modal-box">
    <!-- content -->
    <div class="modal-action">
      <form method="dialog"><button class="btn">Close</button></form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
```
- In React, control with `ref.current.showModal()` / `ref.current.close()`
- Placement: `modal-top`, `modal-middle` (default), `modal-bottom`
- Custom width: override `max-w-*` on `modal-box`

#### `drawer` — mobile nav sidebar
```html
<div class="drawer lg:drawer-open">
  <input id="nav-drawer" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content">
    <label for="nav-drawer" class="btn btn-ghost lg:hidden">☰</label>
    <!-- page content -->
  </div>
  <div class="drawer-side">
    <label for="nav-drawer" class="drawer-overlay"></label>
    <ul class="menu bg-base-200 min-h-full w-64 p-4">...</ul>
  </div>
</div>
```
- CSS-only, no JS needed
- `is-drawer-open:` / `is-drawer-close:` variants for conditional styles

#### `input` — search box in [Filters](src/components/filters.tsx)
```html
<input type="text" placeholder="Search tools..." class="input input-lg w-full" />
```
- Sizes: `input-xs` through `input-xl`
- Colors: `input-primary`, `input-error`, etc.

#### `select` — filter dropdowns in [Filters](src/components/filters.tsx)
```html
<select class="select select-bordered">
  <option>All Categories</option>
</select>
```

#### `toggle` — "Recommended only" switch in [Filters](src/components/filters.tsx)
```html
<input type="checkbox" class="toggle toggle-warning" />
```

#### `btn` — all buttons
```html
<button class="btn btn-primary">Submit</button>
<button class="btn btn-ghost btn-sm">Cancel</button>
<button class="btn btn-circle btn-outline">×</button>
```
- Styles: `btn-outline`, `btn-soft`, `btn-ghost`, `btn-dash`, `btn-link`
- Colors: `btn-primary`, `btn-secondary`, `btn-success`, `btn-warning`, `btn-error`, `btn-neutral`
- Sizes: `btn-xs` through `btn-xl`
- Shapes: `btn-wide`, `btn-block`, `btn-square`, `btn-circle`

#### `skeleton` — loading states
```html
<div class="skeleton h-48 w-full rounded-xl"></div>
<div class="skeleton h-4 w-32"></div>
```

#### `table` — [ToolTable component](src/components/tool-table.tsx)
```html
<div class="overflow-x-auto">
  <table class="table table-zebra table-pin-rows">
    <thead><tr><th>Name</th></tr></thead>
    <tbody><tr><td>Tool</td></tr></tbody>
  </table>
</div>
```
- `table-zebra` for striped rows
- `table-pin-rows` for sticky header
- Sizes: `table-xs` through `table-xl`

#### `dropdown` — user avatar menu in [Header](src/components/header.tsx)
```html
<div class="dropdown dropdown-end">
  <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
    <img src="..." class="rounded-full" />
  </div>
  <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box shadow-xl w-52 p-2">
    <li><a>Admin Panel</a></li>
    <li><a>Log out</a></li>
  </ul>
</div>
```

#### `avatar` — user profile picture in [Header](src/components/header.tsx)
```html
<div class="avatar">
  <div class="w-10 rounded-full ring ring-primary">
    <img src="..." />
  </div>
</div>
```

#### `alert` — error/info messages
```html
<div class="alert alert-error">
  <span>Something went wrong.</span>
</div>
```

#### `loading` — spinner states
```html
<span class="loading loading-spinner loading-md"></span>
```

---

## TASC Custom Theme

The TASC brand theme is defined in [src/index.css](src/index.css). Key colors:

| Token | Purpose | Value |
|-------|---------|-------|
| `primary` | TASC blue | `oklch(45% 0.2 240)` (indigo-blue) |
| `primary-content` | Text on primary | white |
| `secondary` | Accent color | light blue |
| `success` | Free tools | green |
| `warning` | Freemium | amber |
| `error` | Subscription / danger | rose |
| `info` | Age labels / info | sky blue |
| `base-100` | Page background | light blue-white |
| `base-200` | Card / panel bg | slightly darker |
| `base-300` | Borders / dividers | even darker |

---

## File Map

| File | Purpose |
|------|---------|
| [src/pages/Home.tsx](src/pages/Home.tsx) | Main homepage — filters, tool grid/table, stats |
| [src/pages/Tool.tsx](src/pages/Tool.tsx) | Individual tool detail page |
| [src/pages/Admin.tsx](src/pages/Admin.tsx) | Admin dashboard |
| [src/components/header.tsx](src/components/header.tsx) | Top navbar with auth |
| [src/components/footer.tsx](src/components/footer.tsx) | Site footer |
| [src/components/tool-card.tsx](src/components/tool-card.tsx) | Grid card for each tool |
| [src/components/tool-table.tsx](src/components/tool-table.tsx) | Table view of tools |
| [src/components/tool-detail-modal.tsx](src/components/tool-detail-modal.tsx) | Tool detail popup |
| [src/components/filters.tsx](src/components/filters.tsx) | Search + filter controls |
| [src/components/stats-cards.tsx](src/components/stats-cards.tsx) | Summary stat blocks |
| [src/components/login-modal.tsx](src/components/login-modal.tsx) | Google login dialog |
| [src/components/submit-tool-modal.tsx](src/components/submit-tool-modal.tsx) | Submit new tool form |
| [src/index.css](src/index.css) | Global styles + DaisyUI theme |
| [src/lib/types.ts](src/lib/types.ts) | TypeScript data types |

---

## DaisyUI MCP Tool Usage

Two MCP tools are available for DaisyUI work:

### `mcp__daisyui-blueprint__daisyUI-Snippets`
Fetch HTML snippets for any component. Use nested object syntax:
```json
{
  "components": { "navbar": true, "card": true, "badge": true },
  "component-examples": { "navbar.responsive-dropdown-menu-on-small-screen-center-menu-on-large-screen": true },
  "layouts": { "top-navbar": true },
  "templates": { "login-form": true },
  "themes": { "custom-theme": true }
}
```

### `mcp__daisyui-blueprint__Figma-to-daisyUI`
Convert a Figma design URL to DaisyUI HTML. Provide the Figma URL and it returns the component structure.

---

## Key Rules for AI Agents

1. **Use DaisyUI semantic colors** — never hardcode `text-slate-700` or `bg-blue-900` in new code
2. **Fetch snippets before implementing** — always use the MCP to get the latest DaisyUI HTML before writing a component
3. **Keep React logic, replace JSX markup** — data fetching, state, and event handlers stay; only the HTML/class structure changes
4. **Modals use native `<dialog>`** — use `dialogRef.current.showModal()` / `.close()` in React
5. **CSS-only interactions** — drawer/toggle/tabs use checkbox state, no JS needed
6. **`cn()` still works** — the `cn()` utility from `src/lib/utils.ts` works fine with DaisyUI classes for conditional styling
7. **Don't remove Radix imports until fully replaced** — components that are partially migrated may still use both

---
name: design-system-consistency
description: Enforce absolute visual consistency, design system compliance, and strict adherence to the project's existing UI tokens, components, and responsive guidelines (colors, typography, CTAs, hover/active micro-interactions, shadows, border-radius, safe-areas, and container hierarchy). Must trigger automatically whenever creating, modifying, or styling any frontend UI element, component, button, modal, card, layout, or CSS/HTML/JS interface, to prevent introducing mismatched styles, uncoordinated CTAs, or breaking the established visual identity.
---

# Design System Consistency & Visual Integrity Guard

A dedicated skill for ensuring that every new or modified frontend component respects the established visual charter, design tokens, and user experience patterns of the project.

---

## 🤝 1. Interoperability & Synergy with Other Skills

This skill is designed to work in harmony with the rest of your agent toolkit:

* **Complementary to `frontend-design` & `brainstorming`:** When creative ideas or new features are conceptualized, this skill translates them into the concrete tokens and styles already established in the codebase without visual dissonance.
* **Complementary to `ui-ux-pro-max`:** Universal ergonomics and accessibility rules (e.g., WCAG 4.5:1 contrast, 44×44px minimum tap targets) are implemented using the project's local CSS variables and existing UI classes.
* **Complementary to `systematic-debugging`:** When fixing visual or functional bugs, this skill ensures the fix preserves the overall styling and does not introduce layout shifts or style regressions.
* **Complementary to `a11y-debugging`:** Enhances accessibility (focus rings, ARIA states) in a way that remains visually cohesive with the project's design language.

---

## 🧠 2. Phase 0 : Mandatory Pre-Flight Reconnaissance (Think Before Coding)

Before writing any HTML, CSS, or frontend JavaScript, the agent **MUST** perform this quick 2-step audit:

1. **Token Inspection (`:root` in `style.css`):**
   * Inspect color palettes (`--primary`, `--bg-soft`, `--border`, `--text`, etc.).
   * Inspect typography definitions (`--font-heading`, `--font-body`, weights, line-heights).
   * Inspect container geometries (`--radius-sm`, `--radius-lg`, `--radius-xl`, `--shadow-...`).
2. **Find the "Twin Component" (Pattern Matching):**
   * Identify the closest already-existing component in the site (e.g., if creating a new confirmation CTA, look at the primary checkout or reservation CTA; if creating a new card, look at existing product cards).
   * **Rule of Replication:** Clone the geometry, padding, hover states, and font hierarchy of the twin component instead of inventing ad-hoc styles.

---

## 📐 3. Core Design System & UX/UI Standards

### A. Button & CTA Hierarchy
Every clickable button must belong to a defined tier:

1. **Primary Action CTA (Tier 1):**
   * **Shape:** Pill or smooth rounded rectangle matching the project's signature (`border-radius: 24px` or `50px`).
   * **Background:** Primary theme color / signature gradient.
   * **Typography:** `var(--font-heading)`, bold / extra-bold (`font-weight: 700-800`).
   * **Hover Interaction:** Smooth elevation (`transform: translateY(-1px)` to `-2px`) with enhanced diffused shadow.
   * **Active State:** Slight tactical press (`transform: scale(0.98)` or `translateY(0)`).
2. **Secondary / Filter Button (Tier 2):**
   * **Shape:** Rounded pill with subtle background (`var(--bg-soft)`) and border (`var(--border)`).
   * **Active / Selected State:** Switches to high-contrast or primary accent.
3. **Icon Buttons & Actions (Tier 3):**
   * **Shape:** Circular (`border-radius: 50%`) with centered flex layout.
   * **Touch Area:** Minimum 36×36px on Desktop, 44×44px on Mobile.

### B. The 4 Interaction States Rule
Never leave an interactive element with only static CSS. Always define:
1. `Default` : Resting state.
2. `:hover` : Subtly elevated or lightened, using the project's standard transition timing (e.g. `transition: all 0.2s cubic-bezier(...)`).
3. `:active` : Physical feedback upon touch or click.
4. `:focus-visible` : Clear outline for keyboard navigation without breaking visual aesthetics.

### C. Responsive Spacing & Safe Areas
* **Grid Units:** Base spacing on consistent 4px / 8px multiples (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).
* **Mobile Thumb-Zone (< 768px):**
  * CTAs in drawers, bottom sheets, or fixed toolbars should be full-width (`width: 100%`) with `min-height: 44px` to `48px`.
  * **Safe Area Requirement:** Fixed bottom bars must always include `padding-bottom: calc(16px + env(safe-area-inset-bottom));`.
* **Desktop (≥ 768px):**
  * Use `width: auto` with balanced padding (`10px 24px`) or `max-width` constraints so buttons do not stretch awkwardly.

### D. Typography & Hierarchy
* **Scale:**
  * H1 / Hero: 32px – 48px | Line-height: 1.15 – 1.2
  * H2 (Section titles): 20px – 24px | Font-weight: 800
  * Body / Item names: 14px – 16px | Line-height: 1.4 – 1.5
  * Badges & Metas: 11px – 12px | Font-weight: 600 – 700 (Never drop below 11px).
* **Text Overflow:** Apply `text-overflow: ellipsis; white-space: nowrap; overflow: hidden;` on compact chips and dynamic labels to prevent awkward text wraps.

### E. Containers, Cards & Modals
* **Shadows:** Use tinted, soft, multi-layered shadows (e.g. `rgba(39, 47, 97, 0.08)`) instead of harsh black shadows.
* **Borders:** Subtle matching borders (`1px` to `1.5px`) rather than heavy outlines.
* **Modal Inactive State:** Always combine `display: none !important;` with `visibility: hidden !important;` when closed to prevent ghost buttons or visual artifacts from leaking onto other pages.

---

## 🚫 4. Anti-Patterns (Strictly Forbidden)

* ❌ **No Arbitrary Raw Hex Colors:** Never write `#ff0000`, `blue`, `#333` directly in components. Always map to `var(--...)`.
* ❌ **No Dissonant Geometries:** Never make a square sharp-edged button in a project where all cards and buttons are rounded pills.
* ❌ **No Missing Mobile Considerations:** Never use fixed pixel container widths (e.g. `width: 600px;` without `max-width: 92%`).
* ❌ **No Browser Default Typography:** Always assign the project's font family tokens.
* ❌ **No Instant 0ms State Jumps:** Always attach smooth easing transitions to interactive hover/focus states.

---

## ✅ 5. Pre-Delivery Sanity Checklist

Before showing completed frontend changes to the user, run through this mental checklist:

1. [ ] *Did I reuse existing CSS variables for all colors, borders, and shadows?*
2. [ ] *Does this element look like it belongs naturally to the same site since day one?*
3. [ ] *Are all 4 interaction states (normal, hover, active, focus) present and smooth?*
4. [ ] *Is the touch target comfortable on mobile (≥ 44px) and elegant on desktop?*
5. [ ] *Did I verify that inactive overlays or modals are cleanly hidden (`display: none`)?*

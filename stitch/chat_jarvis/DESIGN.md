# Design System Specification: High-Density Precision

## 1. Overview & Creative North Star: "The Kinetic Console"
This design system is built for the high-performance marketer. It rejects the "soft SaaS" aesthetic in favor of **The Kinetic Console**—a philosophy that treats the UI as a professional instrument rather than a website. Inspired by the utilitarian elegance of flight decks and high-end IDEs, the interface focuses on high information density, rapid cognition, and tactile depth.

### The Editorial Edge
We move beyond the template by embracing **Command-Line Precision**. This is achieved through:
* **Intentional Asymmetry:** Using rigid, mono-spaced data columns contrasted with fluid, expansive creative previews.
* **Atmospheric Depth:** Replacing crude lines with "Tonal Carving"—defining workspace areas through subtle shifts in luminosity rather than borders.
* **High-Contrast Signaling:** Utilizing a dark, charcoal-void background to make our "Burnt Orange" primary and AI Agent accents feel like glowing filaments in a darkened room.

---

## 2. Colors: Tonal Carving
Our palette is a hierarchy of darkness. The goal is to move the eye through "lightness" of surfaces, not thickness of lines.

### Surface Hierarchy (The "No-Line" Rule)
Explicitly prohibit 1px solid borders for sectioning. Boundaries must be defined by background shifts.
* **Base (`surface` / `#131314`):** The canvas.
* **Submerged (`surface-container-low` / `#1C1B1C`):** Used for sidebars and navigation gutters.
* **Raised (`surface-container` / `#201F20`):** Standard workspace panels and cards.
* **Floating (`surface-container-highest` / `#353436`):** Modals and context menus.

### The "Glass & Gradient" Rule
To elevate the "serious tool" aesthetic, use **Glassmorphism** for all floating overlays (Dropdowns, Popovers).
* **Formula:** `surface-container-highest` at 80% opacity + 12px `backdrop-blur`.
* **Signature Textures:** Apply a 20% linear gradient to Primary CTAs (from `#F28705` to `#FFB690` at 135°) to give buttons a physical, metallic "sheen" that flat colors lack.

### AI Agent Accents (Functional Tinting)
AI modules are not just labeled; they own their space via `surface-tint`.
* **Research:** `tertiary` (`#F29F05`) for amber accents.
* **Market:** `secondary` (`#A1A1AA`) for cool-grey precision.
* **Strategy:** `primary-fixed` (#FFDBCA) for amber-warmth.

---

## 3. Typography: The Information Layer
We use **Inter** for its neutral, high-legibility character and **JetBrains Mono** for data-heavy outputs to reinforce the "pro tool" feel.

| Role | Token | Size/Weight | Tracking | Intent |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-md` | 2.75rem / 600 | -0.02em | Hero analytics and high-impact stats. |
| **Headline** | `headline-sm` | 1.5rem / 600 | -0.01em | Primary section headers. |
| **Title** | `title-sm` | 1rem / 600 | 0 | Card titles and modal headers. |
| **Body** | `body-md` | 0.875rem / 400 | 0 | Primary reading and input text. |
| **Mono** | `label-sm` | 0.6875rem / 500 | +0.02em | Data points, IDs, and AI terminal logs. |

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too heavy for high-density tools. We use **Ambient Radiance**.

*   **The Layering Principle:** Stack `surface-container-low` cards onto a `surface` background. The 2-4% difference in hex value is enough for the human eye to perceive a "step" without a border.
*   **The "Ghost Border" Fallback:** If accessibility requires a border (e.g., in high-glare environments), use `outline-variant` (#584237) at **15% opacity**. It should be felt, not seen.
*   **Ambient Shadows:** For floating elements, use a "Tinted Glow":
    *   `box-shadow: 0 12px 40px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(249, 115, 22, 0.05);` (A subtle orange-tinted shadow for primary actions).

---

## 5. Components: Built for Speed
The spacing system emphasizes a **normal (2)** level of whitespace for an effective high-density layout.
The corners of UI shapes have a **moderate (2)** roundedness, providing a balanced, functional aesthetic across components.

### Buttons
*   **Primary:** `#F28705` background. No border. On hover, apply a slight inner-glow (1px white at 10% opacity) to simulate physical depression.
*   **Secondary:** Transparent background. `outline-variant` border at 20% opacity. Text uses `on-surface`.
*   **Tertiary/Ghost:** No background or border. Uses `secondary` text. Reserved for low-priority utility actions.

### Input Fields
*   **Form Factor:** Height 36px (compact). Background: `surface-container-low`.
*   **Focus State:** Transition border to `primary` (`#F28705`) and add a 2px `primary-container` outer glow at 20% opacity.

### Cards & Lists
*   **Strict Rule:** No horizontal dividers. Use 16px or 24px vertical whitespace gaps from the 4px base system to separate items.
*   **List Hover:** Use `surface-container-high` as a full-width background highlight on hover, with a 4px radius.

### AI Command Bar (Special Component)
A floating, centered input using `surface-container-highest`, a 1px `primary` ghost border, and a `backdrop-blur` of 20px. This is the "brain" of the platform.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `JetBrains Mono` for all numerical data, currency, and timestamps. It aligns numbers vertically, making comparisons faster.
*   **Do** use "Optical Alignment"—labels for icons should be 1px higher than the icon's mathematical center to feel visually centered.
*   **Do** lean into `surface-container` nesting (up to 3 levels deep) to organize complex settings without adding "boxiness."

### Don't
*   **Don't** use pure black (#000000) or pure white (#FFFFFF). Use the specified neutral tokens to maintain the "ink-and-paper" professional look.
*   **Don't** use standard 100% opaque borders to separate the sidebar from the main content. Use a `surface-container-low` background shift instead.
*   **Don't** use sharp corners. Embrace the new moderate roundedness (2) aesthetic across components.
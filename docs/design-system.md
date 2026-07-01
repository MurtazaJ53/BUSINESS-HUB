# Business Hub Design System

**Version:** 2.0  
**Last Updated:** 2026-05-27

## Design Philosophy

Business Hub is a professional shop operations platform. The design balances:
- **Clarity** - Information hierarchy that guides operators through daily tasks
- **Speed** - Fast visual scanning and minimal cognitive load during busy periods
- **Trust** - Professional aesthetic that conveys reliability and control
- **Accessibility** - WCAG 2.1 AA compliant with strong contrast and readable typography

---

## Color System

### Core Palette

#### Neutrals (Foundation)
```
Background Deep:    #0A0E14  (Darkest app background)
Background Base:    #0F141C  (Primary background)
Background Soft:    #161B26  (Elevated surfaces)
Surface:            #1C2230  (Cards, panels)
Surface Strong:     #242B3D  (Active/hover states)
Border Soft:        #2A3342  (Subtle dividers)
Border:             #3A4556  (Standard borders)
Border Strong:      #4A5568  (Emphasized borders)
```

#### Text Hierarchy
```
Text Primary:       #F8FAFC  (Headings, primary content)
Text Secondary:     #CBD5E1  (Body text, labels)
Text Tertiary:      #94A3B8  (Hints, metadata)
Text Disabled:      #64748B  (Disabled states)
```

#### Brand Colors
```
Primary:            #3B82F6  (Blue - primary actions, links)
Primary Hover:      #2563EB  (Hover state)
Primary Light:      #60A5FA  (Light variant)
Primary Dark:       #1E40AF  (Dark variant)

Accent:             #8B5CF6  (Purple - secondary actions)
Accent Hover:       #7C3AED
Accent Light:       #A78BFA
```

#### Semantic Colors
```
Success:            #10B981  (Green - confirmations, positive states)
Success Light:      #34D399
Success Dark:       #059669

Warning:            #F59E0B  (Amber - warnings, attention)
Warning Light:      #FBBF24
Warning Dark:       #D97706

Error:              #EF4444  (Red - errors, destructive actions)
Error Light:        #F87171
Error Dark:         #DC2626

Info:               #06B6D4  (Cyan - informational)
Info Light:         #22D3EE
Info Dark:          #0891B2
```

#### Domain Colors (Contextual)
```
Revenue:            #10B981  (Green - sales, income)
Expense:            #EF4444  (Red - costs, outflows)
Inventory:          #3B82F6  (Blue - stock, catalog)
Customer:           #8B5CF6  (Purple - people, relationships)
Alert:              #F59E0B  (Amber - pulse, attention)
```

---

## Typography

### Font Families
```
Primary (Sans):     Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
Monospace:          "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace
```

### Type Scale

#### Mobile (Flutter)
```
Display Large:      32px / 700 / -0.5px  (Hero numbers, splash)
Display Medium:     28px / 700 / -0.3px  (Section headers)
Display Small:      24px / 700 / -0.2px  (Card headers)

Headline Large:     22px / 600 / -0.2px  (Screen titles)
Headline Medium:    20px / 600 / -0.1px  (Subsection titles)
Headline Small:     18px / 600 / 0px     (List headers)

Title Large:        17px / 600 / 0px     (Prominent labels)
Title Medium:       16px / 600 / 0.1px   (Standard labels)
Title Small:        15px / 600 / 0.1px   (Compact labels)

Body Large:         16px / 400 / 0.2px   (Primary content)
Body Medium:        15px / 400 / 0.2px   (Standard content)
Body Small:         14px / 400 / 0.2px   (Secondary content)

Label Large:        14px / 500 / 0.3px   (Buttons, chips)
Label Medium:       13px / 500 / 0.3px   (Form labels)
Label Small:        12px / 500 / 0.4px   (Metadata, tags)

Caption:            12px / 400 / 0.3px   (Hints, timestamps)
Overline:           11px / 600 / 1.2px   (Eyebrows, uppercase labels)
```

#### Web (Admin)
```
Display:            clamp(32px, 4vw, 48px) / 700 / -1px
Headline 1:         clamp(24px, 3vw, 32px) / 600 / -0.5px
Headline 2:         clamp(20px, 2.5vw, 24px) / 600 / -0.3px
Headline 3:         18px / 600 / -0.2px

Body Large:         16px / 400 / 0.2px
Body:               15px / 400 / 0.2px
Body Small:         14px / 400 / 0.2px

Label:              14px / 500 / 0.3px
Caption:            13px / 400 / 0.3px
Overline:           12px / 600 / 1.2px (uppercase)
```

---

## Spacing System

### Base Unit: 4px

```
Space 1:    4px    (Tight inline spacing)
Space 2:    8px    (Compact spacing)
Space 3:    12px   (Default inline spacing)
Space 4:    16px   (Standard spacing)
Space 5:    20px   (Comfortable spacing)
Space 6:    24px   (Section spacing)
Space 8:    32px   (Large section spacing)
Space 10:   40px   (Major section spacing)
Space 12:   48px   (Screen padding)
Space 16:   64px   (Hero spacing)
Space 20:   80px   (Extra large spacing)
```

### Layout Grid
```
Mobile:     16px side padding, 12px vertical rhythm
Tablet:     24px side padding, 16px vertical rhythm
Desktop:    32px side padding, 20px vertical rhythm
```

---

## Border Radius

```
XS:         4px    (Chips, tags)
SM:         8px    (Buttons, inputs)
MD:         12px   (Cards, small panels)
LG:         16px   (Large cards, modals)
XL:         20px   (Hero cards, sheets)
2XL:        24px   (Bottom sheets, dialogs)
Full:       9999px (Pills, avatars)
```

---

## Elevation & Shadows

```
Level 0:    none                                                    (Flat surfaces)
Level 1:    0 1px 2px rgba(0,0,0,0.12)                            (Subtle lift)
Level 2:    0 2px 8px rgba(0,0,0,0.16)                            (Cards)
Level 3:    0 4px 16px rgba(0,0,0,0.20)                           (Floating elements)
Level 4:    0 8px 24px rgba(0,0,0,0.24)                           (Modals, sheets)
Level 5:    0 16px 48px rgba(0,0,0,0.32)                          (Dialogs)

Glow:       0 0 0 1px rgba(59,130,246,0.2),                       (Focus states)
            0 4px 16px rgba(59,130,246,0.15)
```

---

## Component Patterns

### Buttons

#### Primary (Filled)
```
Background:     Primary (#3B82F6)
Text:           White (#FFFFFF)
Padding:        12px 20px (mobile), 10px 18px (web)
Border Radius:  8px
Font:           Label Large / 500
Hover:          Primary Hover (#2563EB)
Active:         Primary Dark (#1E40AF)
Disabled:       Surface Strong (#242B3D) + Text Disabled (#64748B)
```

#### Secondary (Outlined)
```
Background:     Transparent
Border:         1px solid Border (#3A4556)
Text:           Text Primary (#F8FAFC)
Padding:        12px 20px
Border Radius:  8px
Hover:          Background Surface (#1C2230)
Active:         Background Surface Strong (#242B3D)
```

#### Tertiary (Ghost)
```
Background:     Transparent
Text:           Text Secondary (#CBD5E1)
Padding:        12px 20px
Hover:          Background Surface Soft (#161B26)
```

### Input Fields

```
Background:     Surface (#1C2230)
Border:         1px solid Border Soft (#2A3342)
Text:           Text Primary (#F8FAFC)
Placeholder:    Text Tertiary (#94A3B8)
Padding:        12px 16px
Border Radius:  8px
Focus:          Border Primary (#3B82F6) + Glow
Error:          Border Error (#EF4444)
Disabled:       Background Surface Soft (#161B26) + Text Disabled
```

### Cards

```
Background:     Surface (#1C2230)
Border:         1px solid Border Soft (#2A3342)
Border Radius:  12px
Padding:        16px (mobile), 20px (web)
Shadow:         Level 2
Hover:          Border (#3A4556) + Shadow Level 3
```

### Chips/Tags

```
Background:     Surface Strong (#242B3D)
Text:           Text Secondary (#CBD5E1)
Padding:        6px 12px
Border Radius:  4px
Font:           Label Small / 500
Active:         Background Primary (#3B82F6) + Text White
```

### Bottom Sheets (Mobile)

```
Background:     Surface (#1C2230)
Border Radius:  24px 24px 0 0
Padding:        20px
Handle:         4px × 32px, Border (#3A4556), centered
Shadow:         Level 5
Backdrop:       rgba(0,0,0,0.6)
```

### Modals/Dialogs

```
Background:     Surface (#1C2230)
Border:         1px solid Border (#3A4556)
Border Radius:  16px
Padding:        24px
Max Width:      480px (mobile), 600px (web)
Shadow:         Level 5
Backdrop:       rgba(0,0,0,0.7)
```

---

## Iconography

### Style
- **Outline style** for most UI icons
- **Filled style** for active/selected states
- **Rounded corners** (2px radius on 24px icons)

### Sizes
```
Small:      16px  (Inline icons, metadata)
Medium:     20px  (List items, buttons)
Large:      24px  (Headers, primary actions)
XLarge:     32px  (Feature icons, empty states)
Hero:       48px  (Splash, onboarding)
```

### Color Usage
```
Default:    Text Secondary (#CBD5E1)
Active:     Primary (#3B82F6)
Success:    Success (#10B981)
Warning:    Warning (#F59E0B)
Error:      Error (#EF4444)
Disabled:   Text Disabled (#64748B)
```

---

## Animation & Motion

### Timing Functions
```
Ease Out:       cubic-bezier(0.0, 0.0, 0.2, 1)     (Entrances)
Ease In:        cubic-bezier(0.4, 0.0, 1, 1)       (Exits)
Ease In Out:    cubic-bezier(0.4, 0.0, 0.2, 1)     (Transitions)
Sharp:          cubic-bezier(0.4, 0.0, 0.6, 1)     (Quick actions)
```

### Durations
```
Instant:        100ms   (Micro-interactions)
Fast:           200ms   (Hover, focus states)
Normal:         300ms   (Standard transitions)
Slow:           400ms   (Complex transitions)
Slower:         500ms   (Page transitions)
```

### Common Animations
```
Fade In:        opacity 0 → 1, 200ms ease-out
Slide Up:       translateY(20px) → 0, 300ms ease-out
Scale:          scale(0.95) → 1, 200ms ease-out
Ripple:         scale(0) → 1, 400ms ease-out (Material ripple)
```

---

## Accessibility

### Contrast Ratios (WCAG 2.1 AA)
```
Normal Text:        4.5:1 minimum
Large Text:         3:1 minimum
UI Components:      3:1 minimum
```

### Focus Indicators
```
Outline:        2px solid Primary (#3B82F6)
Offset:         2px
Border Radius:  Inherit from component
```

### Touch Targets (Mobile)
```
Minimum:        44px × 44px
Recommended:    48px × 48px
Spacing:        8px minimum between targets
```

### Screen Reader Support
- Semantic HTML elements
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic content
- Proper heading hierarchy

---

## Responsive Breakpoints

```
Mobile:         < 640px
Tablet:         640px - 1024px
Desktop:        > 1024px
Large Desktop:  > 1440px
```

---

## Implementation Notes

### Mobile (Flutter)
- Use Material 3 design system
- Implement custom theme extending `ThemeData`
- Use `ColorScheme` for semantic colors
- Leverage `TextTheme` for typography
- Apply consistent `BorderRadius` via theme

### Web (Next.js + Tailwind)
- Extend Tailwind config with custom colors
- Use CSS custom properties for dynamic theming
- Implement design tokens as Tailwind theme
- Use `clamp()` for responsive typography
- Apply consistent spacing via Tailwind utilities

---

## Design Tokens Export

### CSS Custom Properties
```css
:root {
  /* Colors */
  --color-bg-deep: #0A0E14;
  --color-bg-base: #0F141C;
  --color-bg-soft: #161B26;
  --color-surface: #1C2230;
  --color-surface-strong: #242B3D;
  --color-border-soft: #2A3342;
  --color-border: #3A4556;
  --color-border-strong: #4A5568;
  
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #CBD5E1;
  --color-text-tertiary: #94A3B8;
  --color-text-disabled: #64748B;
  
  --color-primary: #3B82F6;
  --color-primary-hover: #2563EB;
  --color-primary-light: #60A5FA;
  --color-primary-dark: #1E40AF;
  
  --color-accent: #8B5CF6;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #06B6D4;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  
  /* Border Radius */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  
  /* Shadows */
  --shadow-1: 0 1px 2px rgba(0,0,0,0.12);
  --shadow-2: 0 2px 8px rgba(0,0,0,0.16);
  --shadow-3: 0 4px 16px rgba(0,0,0,0.20);
  --shadow-4: 0 8px 24px rgba(0,0,0,0.24);
  --shadow-5: 0 16px 48px rgba(0,0,0,0.32);
  --shadow-glow: 0 0 0 1px rgba(59,130,246,0.2), 0 4px 16px rgba(59,130,246,0.15);
}
```

---

**End of Design System Documentation**

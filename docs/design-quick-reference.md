# Business Hub Design System - Quick Reference

## Color Palette

### Neutrals
```dart
backgroundDeep:    #0A0E14
background:        #0F141C  ← Primary app background
backgroundSoft:    #161B26
surface:           #1C2230  ← Cards, panels
surfaceStrong:     #242B3D  ← Active states
borderSoft:        #2A3342
border:            #3A4556
borderStrong:      #4A5568
```

### Text
```dart
textPrimary:       #F8FAFC  ← Headings, primary content
textSecondary:     #CBD5E1  ← Body text, labels
textTertiary:      #94A3B8  ← Hints, metadata
textDisabled:      #64748B
```

### Brand
```dart
primary:           #3B82F6  ← Primary actions, links
primaryHover:      #2563EB
primaryLight:      #60A5FA
primaryDark:       #1E40AF

accent:            #8B5CF6  ← Secondary actions
accentHover:       #7C3AED
accentLight:       #A78BFA
```

### Semantic
```dart
success:           #10B981  ← Confirmations, positive
warning:           #F59E0B  ← Warnings, attention
error:             #EF4444  ← Errors, destructive
info:              #06B6D4  ← Informational
```

### Domain
```dart
revenue:           #10B981  ← Sales, income
expense:           #EF4444  ← Costs, outflows
inventory:         #3B82F6  ← Stock, catalog
customer:          #8B5CF6  ← People, relationships
alert:             #F59E0B  ← Pulse, attention
```

## Typography

### Mobile (Flutter)
```dart
Display Large:     32px / 700 / -0.5px
Display Medium:    28px / 700 / -0.3px
Display Small:     24px / 700 / -0.2px

Headline Large:    22px / 600 / -0.2px
Headline Medium:   20px / 600 / -0.1px
Headline Small:    18px / 600 / 0px

Title Large:       17px / 600 / 0px
Title Medium:      16px / 600 / 0.1px
Title Small:       15px / 600 / 0.1px

Body Large:        16px / 400 / 0.2px
Body Medium:       15px / 400 / 0.2px
Body Small:        14px / 400 / 0.2px

Label Large:       14px / 500 / 0.3px
Label Medium:      13px / 500 / 0.3px
Label Small:       12px / 500 / 0.4px
```

### Web (CSS)
```css
Display:           clamp(32px, 4vw, 48px) / 700
Headline 1:        clamp(24px, 3vw, 32px) / 600
Headline 2:        clamp(20px, 2.5vw, 24px) / 600
Headline 3:        18px / 600

Body Large:        16px / 400
Body:              15px / 400
Body Small:        14px / 400

Label:             14px / 500
Caption:           13px / 400
Overline:          12px / 600 (uppercase)
```

## Spacing (4px grid)

```
1:  4px     Tight inline
2:  8px     Compact
3:  12px    Default inline
4:  16px    Standard
5:  20px    Comfortable
6:  24px    Section
8:  32px    Large section
10: 40px    Major section
12: 48px    Screen padding
16: 64px    Hero
20: 80px    Extra large
```

## Border Radius

```
XS:    4px     Chips, tags
SM:    8px     Buttons, inputs
MD:    12px    Cards, small panels
LG:    16px    Large cards, modals
XL:    20px    Hero cards, sheets
2XL:   24px    Bottom sheets, dialogs
Full:  9999px  Pills, avatars
```

## Shadows

```
Level 1:  0 1px 2px rgba(0,0,0,0.12)      Subtle lift
Level 2:  0 2px 8px rgba(0,0,0,0.16)      Cards
Level 3:  0 4px 16px rgba(0,0,0,0.20)     Floating
Level 4:  0 8px 24px rgba(0,0,0,0.24)     Modals
Level 5:  0 16px 48px rgba(0,0,0,0.32)    Dialogs

Glow:     0 0 0 1px rgba(59,130,246,0.2),
          0 4px 16px rgba(59,130,246,0.15)
```

## Usage Examples

### Flutter
```dart
// Colors
Container(
  color: AppPalette.surface,
  child: Text(
    'Hello',
    style: TextStyle(color: AppPalette.textPrimary),
  ),
)

// Buttons
FilledButton(
  onPressed: () {},
  child: Text('Primary Action'),
)

// Cards
Card(
  child: Padding(
    padding: EdgeInsets.all(16),
    child: Column(children: [...]),
  ),
)
```

### CSS/Tailwind
```css
/* Colors */
.panel {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  color: var(--text-primary);
}

/* Buttons */
.btn-primary {
  background: var(--primary);
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
}

/* Typography */
.heading {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}
```

## Component Patterns

### Button States
```
Default:   background: primary, text: white
Hover:     background: primaryHover
Active:    background: primaryDark
Disabled:  background: surfaceStrong, text: textDisabled
```

### Input States
```
Default:   border: borderSoft
Focus:     border: primary (2px) + glow
Error:     border: error
Disabled:  background: backgroundSoft, text: textDisabled
```

### Card Variants
```
Default:   surface + borderSoft + shadow-2
Hover:     surface + border + shadow-3
Active:    surfaceStrong + border
```

## Accessibility

### Contrast Ratios (WCAG 2.1 AA)
```
Normal text:       4.5:1 minimum
Large text:        3:1 minimum
UI components:     3:1 minimum
```

### Touch Targets
```
Minimum:           44px × 44px
Recommended:       48px × 48px
Spacing:           8px minimum between targets
```

### Focus Indicators
```
Outline:           2px solid primary
Offset:            2px
Border Radius:     Inherit from component
```

## Animation

### Durations
```
Instant:   100ms   Micro-interactions
Fast:      200ms   Hover, focus
Normal:    300ms   Standard transitions
Slow:      400ms   Complex transitions
Slower:    500ms   Page transitions
```

### Easing
```
Ease Out:      cubic-bezier(0.0, 0.0, 0.2, 1)   Entrances
Ease In:       cubic-bezier(0.4, 0.0, 1, 1)     Exits
Ease In Out:   cubic-bezier(0.4, 0.0, 0.2, 1)   Transitions
Sharp:         cubic-bezier(0.4, 0.0, 0.6, 1)   Quick actions
```

---

**Quick Reference Version:** 2.0  
**Last Updated:** 2026-05-27

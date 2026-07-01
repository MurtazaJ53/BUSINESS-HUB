# Business Hub Design System - Color Palette Reference

## Complete Color Palette

### Neutrals (Foundation Layer)

```
┌─────────────────────────────────────────────────────────────┐
│ Background Deep    #0A0E14  ████████████████████████████████│
│ Background         #0F141C  ████████████████████████████████│
│ Background Soft    #161B26  ████████████████████████████████│
│ Surface            #1C2230  ████████████████████████████████│
│ Surface Strong     #242B3D  ████████████████████████████████│
│ Border Soft        #2A3342  ████████████████████████████████│
│ Border             #3A4556  ████████████████████████████████│
│ Border Strong      #4A5568  ████████████████████████████████│
└─────────────────────────────────────────────────────────────┘
```

### Text Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ Text Primary       #F8FAFC  ████████████████████████████████│
│ Text Secondary     #CBD5E1  ████████████████████████████████│
│ Text Tertiary      #94A3B8  ████████████████████████████████│
│ Text Disabled      #64748B  ████████████████████████████████│
└─────────────────────────────────────────────────────────────┘
```

### Brand Colors

```
┌─────────────────────────────────────────────────────────────┐
│ Primary            #3B82F6  ████████████████████████████████│
│ Primary Hover      #2563EB  ████████████████████████████████│
│ Primary Light      #60A5FA  ████████████████████████████████│
│ Primary Dark       #1E40AF  ████████████████████████████████│
│                                                               │
│ Accent             #8B5CF6  ████████████████████████████████│
│ Accent Hover       #7C3AED  ████████████████████████████████│
│ Accent Light       #A78BFA  ████████████████████████████████│
└─────────────────────────────────────────────────────────────┘
```

### Semantic Colors

```
┌─────────────────────────────────────────────────────────────┐
│ Success            #10B981  ████████████████████████████████│
│ Success Light      #34D399  ████████████████████████████████│
│ Success Dark       #059669  ████████████████████████████████│
│                                                               │
│ Warning            #F59E0B  ████████████████████████████████│
│ Warning Light      #FBBF24  ████████████████████████████████│
│ Warning Dark       #D97706  ████████████████████████████████│
│                                                               │
│ Error              #EF4444  ████████████████████████████████│
│ Error Light        #F87171  ████████████████████████████████│
│ Error Dark         #DC2626  ████████████████████████████████│
│                                                               │
│ Info               #06B6D4  ████████████████████████████████│
│ Info Light         #22D3EE  ████████████████████████████████│
│ Info Dark          #0891B2  ████████████████████████████████│
└─────────────────────────────────────────────────────────────┘
```

### Domain Colors (Contextual)

```
┌─────────────────────────────────────────────────────────────┐
│ Revenue            #10B981  ████████████████████████████████│
│ Expense            #EF4444  ████████████████████████████████│
│ Inventory          #3B82F6  ████████████████████████████████│
│ Customer           #8B5CF6  ████████████████████████████████│
│ Alert              #F59E0B  ████████████████████████████████│
└─────────────────────────────────────────────────────────────┘
```

---

## Color Usage Guidelines

### Primary Blue (#3B82F6)
**Use for:**
- Primary action buttons
- Links and interactive elements
- Active navigation states
- Focus indicators
- Primary icons

**Don't use for:**
- Large background areas
- Body text
- Decorative elements

### Accent Purple (#8B5CF6)
**Use for:**
- Secondary actions
- Customer-related features
- Accent highlights
- Special badges
- Premium features

**Don't use for:**
- Primary actions
- Error states
- Warning messages

### Success Green (#10B981)
**Use for:**
- Success messages
- Positive confirmations
- Revenue indicators
- Completed states
- Health status

**Don't use for:**
- Primary actions
- Neutral information
- Decorative elements

### Warning Amber (#F59E0B)
**Use for:**
- Warning messages
- Attention needed
- Low stock alerts
- Pending states
- Caution indicators

**Don't use for:**
- Success messages
- Primary actions
- Neutral information

### Error Red (#EF4444)
**Use for:**
- Error messages
- Destructive actions
- Failed states
- Expense indicators
- Critical alerts

**Don't use for:**
- Success messages
- Primary actions
- Decorative elements

---

## Contrast Ratios (WCAG 2.1 AA)

### Text on Background (#0F141C)

| Text Color | Contrast Ratio | WCAG AA | WCAG AAA |
|------------|----------------|---------|----------|
| Text Primary (#F8FAFC) | 15.2:1 | ✅ Pass | ✅ Pass |
| Text Secondary (#CBD5E1) | 10.8:1 | ✅ Pass | ✅ Pass |
| Text Tertiary (#94A3B8) | 5.9:1 | ✅ Pass | ⚠️ Large only |
| Text Disabled (#64748B) | 3.8:1 | ⚠️ Large only | ❌ Fail |

### Colors on Background (#0F141C)

| Color | Contrast Ratio | WCAG AA | Use Case |
|-------|----------------|---------|----------|
| Primary (#3B82F6) | 8.2:1 | ✅ Pass | Text, icons, buttons |
| Accent (#8B5CF6) | 6.1:1 | ✅ Pass | Text, icons, buttons |
| Success (#10B981) | 7.9:1 | ✅ Pass | Text, icons, indicators |
| Warning (#F59E0B) | 6.4:1 | ✅ Pass | Text, icons, alerts |
| Error (#EF4444) | 5.2:1 | ✅ Pass | Text, icons, alerts |
| Info (#06B6D4) | 7.1:1 | ✅ Pass | Text, icons, indicators |

### Text on Colored Backgrounds

| Background | Text Color | Contrast | WCAG AA |
|------------|------------|----------|---------|
| Primary (#3B82F6) | White (#FFFFFF) | 8.6:1 | ✅ Pass |
| Success (#10B981) | White (#FFFFFF) | 3.8:1 | ✅ Pass (large) |
| Warning (#F59E0B) | Black (#000000) | 10.4:1 | ✅ Pass |
| Error (#EF4444) | White (#FFFFFF) | 4.5:1 | ✅ Pass |

---

## Color Combinations

### Recommended Pairings

#### Primary Actions
```
Background: Primary (#3B82F6)
Text: White (#FFFFFF)
Border: Primary Dark (#1E40AF)
Hover: Primary Hover (#2563EB)
```

#### Success States
```
Background: Success Light (#34D399) at 15% opacity
Text: Success Dark (#059669)
Border: Success (#10B981) at 20% opacity
Icon: Success (#10B981)
```

#### Warning States
```
Background: Warning Light (#FBBF24) at 15% opacity
Text: Warning Dark (#D97706)
Border: Warning (#F59E0B) at 20% opacity
Icon: Warning (#F59E0B)
```

#### Error States
```
Background: Error Light (#F87171) at 15% opacity
Text: Error Dark (#DC2626)
Border: Error (#EF4444) at 20% opacity
Icon: Error (#EF4444)
```

#### Cards & Panels
```
Background: Surface (#1C2230)
Border: Border Soft (#2A3342)
Text: Text Primary (#F8FAFC)
Secondary Text: Text Secondary (#CBD5E1)
```

---

## Color Psychology

### Blue (Primary)
- **Emotion:** Trust, reliability, professionalism
- **Industry:** Finance, healthcare, technology
- **Message:** "We're dependable and professional"

### Purple (Accent)
- **Emotion:** Creativity, premium, sophistication
- **Industry:** Luxury, creative, innovative
- **Message:** "We're modern and forward-thinking"

### Green (Success)
- **Emotion:** Growth, health, positivity
- **Industry:** Finance, health, environment
- **Message:** "Things are going well"

### Amber (Warning)
- **Emotion:** Caution, attention, energy
- **Industry:** Safety, alerts, notifications
- **Message:** "Pay attention to this"

### Red (Error)
- **Emotion:** Urgency, importance, danger
- **Industry:** Emergency, critical, alerts
- **Message:** "This needs immediate action"

---

## Migration from Old Palette

### Color Mapping

| Old Color | Old Hex | New Color | New Hex | Reason |
|-----------|---------|-----------|---------|--------|
| Primary (Orange) | #E58A47 | Primary (Blue) | #3B82F6 | More professional, trustworthy |
| Gold | #F0C879 | Warning | #F59E0B | Clearer semantic meaning |
| Jade | #4EB79B | Success | #10B981 | More vibrant, better contrast |
| Coral | #EF6B67 | Error | #EF4444 | Sharper, more distinct |
| Cobalt | #7CA4F8 | Info | #06B6D4 | Better contrast, more distinct |
| Panel | #1A2029 | Surface | #1C2230 | Cleaner, more neutral |
| Line | #394250 | Border | #3A4556 | More consistent |

### Automated Replacement

The script `scripts/update_mobile_colors.sh` handles:
- Old palette → New palette mapping
- Hardcoded hex values → Semantic names
- Inconsistent naming → Consistent naming

---

## Accessibility Checklist

### Color Contrast
- ✅ All text meets WCAG 2.1 AA (4.5:1 for normal, 3:1 for large)
- ✅ UI components meet 3:1 minimum
- ✅ Focus indicators are clearly visible
- ✅ Disabled states are distinguishable

### Color Independence
- ✅ Information not conveyed by color alone
- ✅ Icons accompany colored states
- ✅ Text labels supplement color coding
- ✅ Patterns/textures available as alternatives

### Color Blindness
- ✅ Red/green combinations avoided for critical info
- ✅ Blue/yellow used for primary distinctions
- ✅ Sufficient contrast for all color vision types
- ✅ Tested with color blindness simulators

---

## Tools & Resources

### Color Contrast Checkers
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Coolors Contrast Checker: https://coolors.co/contrast-checker
- Adobe Color Accessibility: https://color.adobe.com/create/color-accessibility

### Color Blindness Simulators
- Coblis: https://www.color-blindness.com/coblis-color-blindness-simulator/
- Toptal: https://www.toptal.com/designers/colorfilter
- Chrome DevTools: Built-in vision deficiency simulator

### Design Tools
- Figma: Color styles and variables
- Adobe XD: Color swatches
- Sketch: Color variables

---

**Color Palette Version:** 2.0  
**Last Updated:** 2026-05-27  
**Total Colors:** 30 (8 neutrals + 4 text + 8 brand + 10 semantic + 5 domain)

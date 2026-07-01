# Business Hub - New Component Library Specification

**Version:** 3.0  
**Date:** 2026-05-28  
**Design Philosophy:** Simple, Clean, Premium, Professional

---

## Design Principles

### 1. Generous Spacing
- Minimum 16px between elements
- 24px section spacing
- 48px screen padding on mobile
- Never cramped, always breathable

### 2. Large Touch Targets
- Minimum 48px × 48px
- Preferred 56px × 56px
- 8px minimum spacing between targets
- Thumb-friendly zones

### 3. Clear Hierarchy
- One primary action per screen
- Secondary actions clearly subordinate
- Tertiary actions hidden until needed

### 4. Smooth Animations
- 200ms for micro-interactions
- 300ms for transitions
- 400ms for complex animations
- Ease-out for entrances, ease-in for exits

### 5. Premium Feel
- Subtle shadows (never heavy)
- Smooth gradients (never harsh)
- Refined typography (never bold everywhere)
- Professional colors (never playful)

---

## Mobile Components

### 1. Hero Metric Card

**Purpose:** Display the most important metric prominently

**Specifications:**
```dart
Container(
  width: double.infinity,
  padding: EdgeInsets.all(24),
  decoration: BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        AppPalette.surface,
        AppPalette.surfaceStrong,
      ],
    ),
    borderRadius: BorderRadius.circular(20),
    border: Border.all(
      color: AppPalette.borderSoft,
      width: 1,
    ),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.1),
        blurRadius: 20,
        offset: Offset(0, 8),
      ),
    ],
  ),
  child: Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      // Label
      Text(
        'TODAY\'S SALES',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.2,
          color: AppPalette.textTertiary,
        ),
      ),
      SizedBox(height: 12),
      // Value
      Text(
        '₹12,450',
        style: TextStyle(
          fontSize: 40,
          fontWeight: FontWeight.w700,
          letterSpacing: -1,
          color: AppPalette.textPrimary,
          height: 1.1,
        ),
      ),
      SizedBox(height: 8),
      // Caption
      Text(
        '23 transactions • +12% from yesterday',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: AppPalette.textSecondary,
        ),
      ),
    ],
  ),
)
```

**Usage:**
- Dashboard hero metric
- Report summaries
- Key performance indicators

---

### 2. Primary Action Button

**Purpose:** Main call-to-action on each screen

**Specifications:**
```dart
Container(
  width: double.infinity,
  height: 56,
  child: FilledButton(
    onPressed: onPressed,
    style: FilledButton.styleFrom(
      backgroundColor: AppPalette.primary,
      foregroundColor: Colors.white,
      padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      elevation: 0,
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 24),
        SizedBox(width: 12),
        Text(
          label,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
      ],
    ),
  ),
)
```

**Usage:**
- Start new sale
- Checkout
- Save changes
- Primary screen actions

---

### 3. Quick Action Tile

**Purpose:** Fast access to common features

**Specifications:**
```dart
Container(
  width: 160,
  height: 160,
  decoration: BoxDecoration(
    color: AppPalette.surface,
    borderRadius: BorderRadius.circular(20),
    border: Border.all(
      color: AppPalette.borderSoft,
      width: 1,
    ),
  ),
  child: Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Icon
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: accentColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                icon,
                size: 28,
                color: accentColor,
              ),
            ),
            SizedBox(height: 16),
            // Label
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppPalette.textPrimary,
              ),
            ),
            SizedBox(height: 4),
            // Subtitle
            Text(
              subtitle,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppPalette.textTertiary,
              ),
            ),
          ],
        ),
      ),
    ),
  ),
)
```

**Usage:**
- Dashboard quick actions
- Feature shortcuts
- Navigation tiles

---

### 4. List Item (Enhanced)

**Purpose:** Display items in lists with clear hierarchy

**Specifications:**
```dart
Container(
  height: 80,
  padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
  decoration: BoxDecoration(
    color: AppPalette.surface,
    border: Border(
      bottom: BorderSide(
        color: AppPalette.borderSoft,
        width: 1,
      ),
    ),
  ),
  child: Row(
    children: [
      // Leading icon/image
      Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: accentColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          icon,
          size: 24,
          color: accentColor,
        ),
      ),
      SizedBox(width: 16),
      // Content
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppPalette.textPrimary,
              ),
            ),
            SizedBox(height: 4),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppPalette.textSecondary,
              ),
            ),
          ],
        ),
      ),
      SizedBox(width: 12),
      // Trailing
      Icon(
        Icons.chevron_right_rounded,
        size: 24,
        color: AppPalette.textTertiary,
      ),
    ],
  ),
)
```

**Usage:**
- Product lists
- Customer lists
- Transaction history
- Settings menu

---

### 5. Search Bar (Premium)

**Purpose:** Fast, prominent search

**Specifications:**
```dart
Container(
  height: 56,
  decoration: BoxDecoration(
    color: AppPalette.surface,
    borderRadius: BorderRadius.circular(16),
    border: Border.all(
      color: AppPalette.borderSoft,
      width: 1,
    ),
  ),
  child: TextField(
    controller: controller,
    style: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w500,
      color: AppPalette.textPrimary,
    ),
    decoration: InputDecoration(
      hintText: 'Search products...',
      hintStyle: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: AppPalette.textTertiary,
      ),
      prefixIcon: Icon(
        Icons.search_rounded,
        size: 24,
        color: AppPalette.textTertiary,
      ),
      suffixIcon: controller.text.isNotEmpty
          ? IconButton(
              icon: Icon(
                Icons.close_rounded,
                size: 20,
                color: AppPalette.textTertiary,
              ),
              onPressed: () => controller.clear(),
            )
          : null,
      border: InputBorder.none,
      contentPadding: EdgeInsets.symmetric(
        horizontal: 20,
        vertical: 16,
      ),
    ),
  ),
)
```

**Usage:**
- POS product search
- Inventory search
- Customer search

---

### 6. Bottom Sheet (Modern)

**Purpose:** Display additional content without leaving screen

**Specifications:**
```dart
showModalBottomSheet(
  context: context,
  isScrollControlled: true,
  backgroundColor: Colors.transparent,
  builder: (context) => Container(
    decoration: BoxDecoration(
      color: AppPalette.background,
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(24),
      ),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Handle
        Container(
          margin: EdgeInsets.only(top: 12),
          width: 40,
          height: 4,
          decoration: BoxDecoration(
            color: AppPalette.border,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        // Content
        Padding(
          padding: EdgeInsets.all(24),
          child: content,
        ),
      ],
    ),
  ),
)
```

**Usage:**
- Product details
- Customer details
- Filters
- Actions menu

---

### 7. Floating Action Button (Enhanced)

**Purpose:** Primary action always accessible

**Specifications:**
```dart
FloatingActionButton.extended(
  onPressed: onPressed,
  backgroundColor: AppPalette.primary,
  foregroundColor: Colors.white,
  elevation: 8,
  extendedPadding: EdgeInsets.symmetric(
    horizontal: 24,
    vertical: 16,
  ),
  shape: RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(16),
  ),
  icon: Icon(icon, size: 24),
  label: Text(
    label,
    style: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.2,
    ),
  ),
)
```

**Usage:**
- POS checkout
- Add new item
- Create customer

---

### 8. Status Badge

**Purpose:** Show status clearly

**Specifications:**
```dart
Container(
  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
  decoration: BoxDecoration(
    color: statusColor.withOpacity(0.1),
    borderRadius: BorderRadius.circular(8),
    border: Border.all(
      color: statusColor.withOpacity(0.2),
      width: 1,
    ),
  ),
  child: Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(
          color: statusColor,
          shape: BoxShape.circle,
        ),
      ),
      SizedBox(width: 6),
      Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: statusColor,
          letterSpacing: 0.3,
        ),
      ),
    ],
  ),
)
```

**Usage:**
- Stock status
- Payment status
- Sync status
- Order status

---

## Web Components

### 1. Metric Card (Redesigned)

**Purpose:** Display key metrics cleanly

**Specifications:**
```tsx
<div className="group relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 transition-all hover:border-[var(--border)] hover:shadow-lg">
  {/* Label */}
  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
    {label}
  </p>
  
  {/* Value */}
  <p className="mt-3 text-4xl font-bold tracking-tight text-[var(--text-primary)]">
    {value}
  </p>
  
  {/* Detail */}
  <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
    {detail}
  </p>
  
  {/* Icon */}
  <div className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
    {icon}
  </div>
</div>
```

**Usage:**
- Dashboard metrics
- Report summaries
- KPI displays

---

### 2. Data Table (Modern)

**Purpose:** Display tabular data cleanly

**Specifications:**
```tsx
<div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)]">
  <table className="w-full">
    <thead className="border-b border-[var(--border-soft)] bg-[var(--bg-soft)]">
      <tr>
        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {header}
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-[var(--border-soft)]">
      <tr className="transition-colors hover:bg-[var(--bg-soft)]">
        <td className="px-6 py-4 text-sm font-medium text-[var(--text-primary)]">
          {cell}
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

**Usage:**
- Product lists
- Customer lists
- Transaction history
- Reports

---

### 3. Action Button (Primary)

**Purpose:** Main call-to-action

**Specifications:**
```tsx
<button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-semibold text-white transition-all hover:bg-[var(--primary-hover)] hover:shadow-lg active:scale-95">
  <Icon className="h-5 w-5" />
  <span>{label}</span>
</button>
```

**Usage:**
- Save changes
- Create new
- Submit forms
- Primary actions

---

### 4. Navigation Item

**Purpose:** Clean, clear navigation

**Specifications:**
```tsx
<Link
  href={href}
  className={`
    group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all
    ${isActive 
      ? 'bg-[var(--primary)] text-white shadow-lg' 
      : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]'
    }
  `}
>
  <Icon className="h-5 w-5" />
  <span>{label}</span>
</Link>
```

**Usage:**
- Side navigation
- Top navigation
- Menu items

---

## Animation Specifications

### Micro-interactions (200ms)
- Button hover
- Input focus
- Checkbox toggle
- Switch toggle

### Transitions (300ms)
- Page navigation
- Modal open/close
- Drawer slide
- Tab switch

### Complex Animations (400ms)
- Bottom sheet
- Accordion expand
- List reorder
- Card flip

### Easing Functions
```dart
// Entrances
Curves.easeOut

// Exits
Curves.easeIn

// Transitions
Curves.easeInOut

// Bouncy (use sparingly)
Curves.elasticOut
```

---

## Spacing System (Enhanced)

### Mobile
```
Micro:      4px   (icon padding)
Tiny:       8px   (inline spacing)
Small:      12px  (compact spacing)
Base:       16px  (default spacing)
Medium:     20px  (comfortable spacing)
Large:      24px  (section spacing)
XLarge:     32px  (major sections)
XXLarge:    48px  (screen padding)
Hero:       64px  (hero spacing)
```

### Web
```
Micro:      4px
Tiny:       8px
Small:      12px
Base:       16px
Medium:     20px
Large:      24px
XLarge:     32px
XXLarge:    48px
Hero:       64px
Massive:    96px  (hero sections)
```

---

## Touch Target Guidelines

### Minimum Sizes
- **Buttons:** 48px × 48px
- **List items:** 72px height
- **Icons:** 44px × 44px tap area
- **Checkboxes:** 44px × 44px
- **Radio buttons:** 44px × 44px

### Spacing Between Targets
- **Minimum:** 8px
- **Recommended:** 12px
- **Comfortable:** 16px

### Thumb Zones (Mobile)
```
┌─────────────────────────┐
│ Hard to reach           │
│                         │
│ Easy to reach          │
│                         │
│ Natural thumb zone     │ ← Primary actions here
└─────────────────────────┘
```

---

## Accessibility

### Color Contrast
- **Normal text:** 4.5:1 minimum
- **Large text:** 3:1 minimum
- **UI components:** 3:1 minimum

### Focus Indicators
- **Outline:** 2px solid primary
- **Offset:** 2px
- **Border radius:** Inherit from component

### Screen Reader Support
- Semantic HTML
- ARIA labels
- Proper heading hierarchy
- Alt text for images

---

**Component Library Version:** 3.0  
**Status:** Ready for Implementation  
**Next:** Implement in Flutter and React

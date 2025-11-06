# Admin Page Animated Background Customization Guide

## Current Configuration

```tsx
<AnimatedBackground
  color="rgba(39, 39, 37, 0.6)"
  animation={{ scale: 25, speed: 40 }}
  noise={{ opacity: 0.2, scale: 1.5 }}
/>
```

## Customizable Parameters

### 1. **`color`** - Base color of the animated shadow
- **Current**: `"rgba(39, 39, 37, 0.6)"` (DupMe surface color, 60% opacity)
- **Examples**:
  - Dark gray: `"rgba(39, 39, 37, 0.6)"`
  - Subtle blue: `"rgba(30, 40, 60, 0.5)"`
  - Purple tint: `"rgba(60, 30, 80, 0.4)"`
  - Green: `"rgba(20, 60, 40, 0.5)"`

### 2. **`animation.scale`** - Intensity of the displacement effect
- **Range**: 0-100
- **Current**: `25` (subtle movement)
- **Presets**:
  - Minimal: `10-20` (barely noticeable)
  - Subtle: `20-35` (recommended for admin dashboard)
  - Medium: `35-50` (more pronounced)
  - Intense: `50-80` (very dynamic)
  - Extreme: `80-100` (chaotic, not recommended)

### 3. **`animation.speed`** - How fast the animation cycles
- **Range**: 1-100
- **Current**: `40` (moderate speed)
- **Presets**:
  - Very Slow: `10-20` (meditative)
  - Slow: `20-40` (calm, professional)
  - Medium: `40-60` (recommended)
  - Fast: `60-80` (energetic)
  - Very Fast: `80-100` (frenetic)

### 4. **`noise.opacity`** - Visibility of the grain texture
- **Range**: 0-1
- **Current**: `0.2` (subtle grain)
- **Presets**:
  - None: `0` (smooth)
  - Subtle: `0.1-0.25` (recommended)
  - Visible: `0.25-0.5` (textured)
  - Heavy: `0.5-1.0` (grainy)

### 5. **`noise.scale`** - Size of grain particles
- **Range**: 0.5-3
- **Current**: `1.5` (medium grain)
- **Presets**:
  - Fine: `0.5-1`
  - Medium: `1-2` (recommended)
  - Coarse: `2-3`

### 6. **`sizing`** - How the mask image scales
- **Options**: `'fill'` | `'stretch'`
- **Current**: `'fill'` (default, maintains aspect ratio)

## Recommended Presets

### Professional/Minimal (Current)
```tsx
color="rgba(39, 39, 37, 0.6)"
animation={{ scale: 25, speed: 40 }}
noise={{ opacity: 0.2, scale: 1.5 }}
```

### Calm & Elegant
```tsx
color="rgba(30, 35, 45, 0.5)"
animation={{ scale: 20, speed: 30 }}
noise={{ opacity: 0.15, scale: 1.2 }}
```

### Dynamic & Modern
```tsx
color="rgba(39, 39, 37, 0.7)"
animation={{ scale: 40, speed: 55 }}
noise={{ opacity: 0.25, scale: 1.8 }}
```

### Subtle & Clean
```tsx
color="rgba(39, 39, 37, 0.4)"
animation={{ scale: 15, speed: 25 }}
noise={{ opacity: 0.1, scale: 1.0 }}
```

### Bold & Energetic
```tsx
color="rgba(50, 30, 70, 0.6)"
animation={{ scale: 50, speed: 65 }}
noise={{ opacity: 0.3, scale: 2.0 }}
```

## How to Change

Edit `/frontend/src/app/admin/page.tsx` around line 276:

```tsx
<AnimatedBackground
  color="YOUR_COLOR_HERE"
  animation={{ scale: YOUR_SCALE, speed: YOUR_SPEED }}
  noise={{ opacity: YOUR_OPACITY, scale: YOUR_SCALE }}
  className="fixed inset-0 -z-10"
/>
```

## Performance Notes

- Lower `animation.scale` = better performance
- Higher `animation.speed` = slightly more GPU usage
- Noise texture is lightweight and won't affect performance significantly
- The component uses `framer-motion` for smooth 60fps animations

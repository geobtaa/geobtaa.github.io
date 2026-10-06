---
title: BTAA Geoportal Brand Guide
description: "Branding guidelines for the Big Ten Academic Alliance Geospatial Information Network"
tableOfContents: true
sidebar:
  order: 04
  hidden: true
---

This guide summarizes the visual identity used by the BTAA Geoportal. It is derived from the Geoportal’s production brand stylesheet and is intended for websites, presentations, outreach materials, and related digital communications.

## Brand Colors

### Core Palette

| Color | Hex | Primary use |
|---|---:|---|
| <span style="display:inline-block;width:1.5rem;height:1.5rem;background:#003C5B;border:1px solid #999;vertical-align:middle;"></span> Dark Blue | `#003C5B` | Structural emphasis, borders, dark backgrounds, and supporting brand elements |
| <span style="display:inline-block;width:1.5rem;height:1.5rem;background:#005E8E;border:1px solid #999;vertical-align:middle;"></span> Blue | `#005E8E` | Primary brand color, headers, navigation, footers, and accents |
| <span style="display:inline-block;width:1.5rem;height:1.5rem;background:#939598;border:1px solid #999;vertical-align:middle;"></span> Gray | `#939598` | Neutral accents and secondary visual elements |
| <span style="display:inline-block;width:1.5rem;height:1.5rem;background:#000000;border:1px solid #999;vertical-align:middle;"></span> Black | `#000000` | Body text |
| <span style="display:inline-block;width:1.5rem;height:1.5rem;background:#FFFFFF;border:1px solid #999;vertical-align:middle;"></span> White | `#FFFFFF` | Page backgrounds and text on blue backgrounds |

### Supporting Interface Colors

These colors appear in the Geoportal interface but are not part of the five-color core palette.

| Color | Hex | Use |
|---|---:|---|
| Deep Blue | `#004C6B` | Intermediate color in the footer gradient |
| Light Gray | `#CCCCCC` | Hover-state accent on dark backgrounds |

The Geoportal footer uses this gradient:

```css
background: linear-gradient(to top, #003C5B, #004C6B);
```

## Recommended Color Usage

- Use BTAA Blue as the primary identifying color.
- Use Dark Blue to add depth, structure, or stronger visual emphasis.
- Use white text on Blue or Dark Blue backgrounds.
- Use black for text on white or light backgrounds.
- Use Gray for secondary elements rather than primary body text.
- Preserve ample white space so that the blue palette remains distinctive without overwhelming the content.

### Accessible Color Pairings

| Foreground | Background | Contrast | Guidance |
|---|---|---:|---|
| White | Dark Blue | 11.68:1 | Suitable for text at all common sizes |
| White | Blue | 7.02:1 | Suitable for text at all common sizes |
| Black | White | 21:1 | Suitable for text at all common sizes |
| Black | Gray | 6.99:1 | Suitable for normal text |
| White | Gray | 3.00:1 | Reserve for large text or non-text interface elements |
| Black | Blue | 2.99:1 | Do not use for normal text |

For links on blue backgrounds, keep the text white and provide an underline, border, or another visible focus treatment. Light Gray on Blue does not provide enough contrast for body-sized text.

## Typography

The brand uses two complementary Google Fonts:

- **Work Sans** for headings, titles, navigation, and other interface labels
- **Lora** for body copy and long-form content

### Work Sans

Available brand weights:

- Semibold — `600`
- Bold — `700`

Headings use Work Sans Bold (`700`). Work Sans provides a direct, modern voice and should be used for:

- Page and section headings
- Titles
- Navigation
- Buttons and interface labels
- Short, emphasized statements

Suggested fallback:

```css
font-family: "Work Sans", Arial, sans-serif;
```

### Lora

Available brand weights:

- Regular — `400`
- Medium — `500`
- Semibold — `600`

Lora is the primary body typeface. Its serif forms support comfortable reading and provide contrast with the more modern heading typeface.

Suggested fallback:

```css
font-family: "Lora", Georgia, serif;
```

### Web Font Import

```css
@import url(
  "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=Work+Sans:wght@600;700&display=swap"
);
```

## Type Scale

The Geoportal uses the following heading sizes:

| Style | Size | Pixels at a 16 px root size | Typeface | Weight |
|---|---:|---:|---|---:|
| Heading 1 | `2.5rem` | 40 px | Work Sans | 700 |
| Heading 2 | `2rem` | 32 px | Work Sans | 700 |
| Heading 3 | `1.75rem` | 28 px | Work Sans | 700 |
| Heading 4 | `1.5rem` | 24 px | Work Sans | 700 |
| Body copy | Platform default | Usually 16 px | Lora | 400 |

Use headings in hierarchical order. Do not select a heading level solely to obtain a particular size.

## Digital Layout

The Geoportal’s primary content width is limited to `1200px`. Documentation layouts add `16px` of vertical padding and `20px` of horizontal padding.

Recommended digital layout principles:

- Limit long pages to a centered maximum width of approximately `1200px`.
- Use consistent outer margins and generous white space.
- Allow two-column layouts to collapse to a single column on smaller screens.
- Keep primary navigation and institutional identification visually distinct.
- Use Blue for primary header and footer regions.
- Use Dark Blue for structural accents and separation.

## Header and Footer Treatment

### Header

The application header uses BTAA Blue with white text and links. The application name is displayed prominently in bold type.

Typical application-title treatment:

```css
font-family: "Work Sans", Arial, sans-serif;
font-size: 36px;
font-weight: 700;
color: #FFFFFF;
```

### Footer

The footer uses white text over a dark blue gradient, with Dark Blue borders providing additional structure.

```css
color: #FFFFFF;
background: linear-gradient(to top, #003C5B, #004C6B);
border-top: 1rem solid #003C5B;
border-bottom: 0.5rem solid #003C5B;
```

## Starter Design Tokens

```css
:root {
  --btaa-dark-blue: #003C5B;
  --btaa-blue: #005E8E;
  --btaa-gray: #939598;
  --btaa-black: #000000;
  --btaa-white: #FFFFFF;

  --btaa-font-heading: "Work Sans", Arial, sans-serif;
  --btaa-font-body: "Lora", Georgia, serif;

  --btaa-content-width: 1200px;
}
```

## Brand Consistency Checklist

Before publishing a branded item, confirm that:

- Blue or Dark Blue provides the primary visual identity.
- Body copy uses Lora where the platform supports custom fonts.
- Headings and interface labels use Work Sans.
- White is used for text on Blue and Dark Blue backgrounds.
- Black is used for primary text on white backgrounds.
- Gray is limited to secondary or supporting elements.
- Heading levels and sizes form a clear hierarchy.
- Color combinations meet accessibility contrast requirements.
- Content retains comfortable margins and white space.

## Logo Guidance

The Geoportal stylesheet references a BTAA logo asset and displays it at an `80px` height in the website header. The stylesheet does not define official logo artwork, clear space, minimum print size, alternate lockups, or rules governing recoloring.

Use the current approved logo files and accompanying BTAA identity guidance for those decisions. Do not recreate, distort, crop, or recolor the logo based solely on this document.

---

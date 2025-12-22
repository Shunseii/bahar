# Bahar Marketing

The marketing website and blog for Bahar - an Arabic language learning platform.

## Tech Stack

- Astro 5 for static site generation
- Tailwind CSS v4 with oklch color system
- React 19 for interactive components
- Motion for animations
- MDX for blog content
- Native Astro i18n for internationalization

## Getting Started

Install packages with `pnpm install`.

## Development

Start the dev server with `pnpm dev`.

The marketing site runs on `http://localhost:4321`.

## Building

Build the static site with `pnpm build`.

The output will be in the `dist/` directory.

## Deployment

This site is deployed to Cloudflare Pages. Configuration is in `wrangler.toml`.

To preview the production build locally:

```bash
pnpm build
pnpm preview
```

## Type Checking

```bash
pnpm type-check
```

## Architecture

### Pages

- `/` - English landing page
- `/blog` - English blog listing
- `/blog/[slug]` - English blog posts
- `/ar` - Arabic landing page (RTL)
- `/ar/blog` - Arabic blog listing
- `/ar/blog/[slug]` - Arabic blog posts

### i18n

The site supports English and Arabic. Translations are stored in JSON files:

- `src/i18n/translations/en.json` - English translations
- `src/i18n/translations/ar.json` - Arabic translations

Arabic pages have full RTL support with appropriate font ordering.

### Blog

Blog posts are stored as MDX files in `src/content/blog/`:

- `src/content/blog/en/` - English posts
- `src/content/blog/ar/` - Arabic posts

Each post requires frontmatter with title, description, pubDate, and optional tags.

### Styling

The site uses Tailwind CSS v4 with oklch colors matching the main app's design system. Theme colors are defined in `src/styles/global.css` with light and dark mode support.

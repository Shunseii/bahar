# Bahar Web

The web application for Bahar - an Arabic language learning platform with personal dictionary, flashcards, and spaced repetition.

## Tech Stack

- React 19 with Vite for bundling
- TanStack Router for client-side routing
- TanStack Query for server state management
- Jotai for client state management
- Shadcn/UI + Tailwind CSS v4 for styling
- Lingui for internationalization
- Orama for client-side full-text search
- Turso SQLite (local WASM sync + remote per-user database)
- Eden Treaty for type-safe API communication

## Getting Started

Install packages with `pnpm install`.

## Development

Start the dev server with `pnpm dev`.

The web app runs on `http://localhost:5173`.

## Building

```bash
pnpm build
```

## Deployment

The app is deployed to Cloudflare Pages. Local preview with Wrangler:

```bash
pnpm wrangler:dev
```

## Architecture

This app uses a local-first architecture with cloud sync:

- **Local Database**: Browser-based SQLite via Turso sync-wasm
- **Server State**: Synced with user's remote Turso database every 60 seconds
- **Search**: Orama (client-side WASM) indexed from local database
- **API**: Elysia endpoints via Eden Treaty for type-safe server operations

## Data Flow

1. On app load, the local database is initialized and synced with the remote
2. Data reads happen from the local database (no network latency)
3. Data writes update the local database immediately
4. Background sync pushes changes to the server every 60 seconds
5. Search queries run against Orama's in-memory index

## UI Components (shadcn)

This app uses shadcn/ui components from the shared `@bahar/web-ui` package.

### Adding New Components

```bash
npx shadcn@latest add [component]
```

This installs components to `packages/web-ui/src/components/`.

### Importing Components

```tsx
import { Button } from "@bahar/web-ui/components/button";
import { Card } from "@bahar/web-ui/components/card";
import { cn } from "@bahar/web-ui/lib/utils";
```

See `packages/web-ui/README.md` for the full list of available components.

## Adding Color Themes

To add a new color theme:

1. **Add CSS variables** in `packages/design-system/colors.css`:

```css
[data-theme="mytheme"] {
  --background: oklch(98% 0.01 180);
  --primary: oklch(55% 0.18 180);
  /* ... other light mode colors */
}

[data-theme="mytheme"].dark {
  --background: oklch(15% 0.025 180);
  --primary: oklch(65% 0.16 180);
  /* ... other dark mode colors */
}
```

2. **Register the theme** in `src/atoms/theme.ts`:

```typescript
export enum ColorTheme {
  DEFAULT = "default",
  NORD = "nord",
  MYTHEME = "mytheme",
}
```

3. **Add translation** in `src/components/ThemeMenu.tsx`:

```typescript
const ColorThemeLabel: FC<{ theme: ColorTheme }> = ({ theme }) => {
  switch (theme) {
    case ColorTheme.MYTHEME:
      return <Trans>My Theme</Trans>;
    // ... other cases
  }
};
```

4. **Extract translations**: `pnpm run i18n:extract`

## Environment Variables

Required environment variables:

- `VITE_API_URL` - Backend API URL
- `VITE_SENTRY_DSN` - Sentry DSN for error tracking

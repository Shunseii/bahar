# @bahar/web-ui

Shared shadcn/ui component library for web applications in the Bahar monorepo.

## Overview

This package contains all shadcn/ui components used by `apps/web` and `apps/marketing`. It follows the [shadcn monorepo pattern](https://ui.shadcn.com/docs/monorepo).

## Adding Components

You can add new shadcn components like this:

```bash
cd apps/web
npx shadcn@latest add [component]
```

Components are automatically installed to `packages/web-ui/src/components/`.

## Importing Components

```tsx
import { Button } from "@bahar/web-ui/components/button";
import { Card, CardContent, CardHeader } from "@bahar/web-ui/components/card";
import { cn } from "@bahar/web-ui/lib/utils";
```

## Configuration

### TypeScript Paths

This package uses TypeScript path aliases. The `tsconfig.json` maps:

```json
{
  "paths": {
    "@bahar/web-ui/*": ["./src/*"]
  }
}
```

Consumer apps must also add this path mapping:

```json
{
  "paths": {
    "@bahar/web-ui/*": ["../../packages/web-ui/src/*"]
  }
}
```

### Tailwind Content Scanning

Apps must include this package in Tailwind's content scanning. Add to your app's CSS:

```css
@source "../../../packages/web-ui/src/**/*.tsx";
```

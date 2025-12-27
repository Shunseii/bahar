# Bahar Mobile App

The mobile application for Bahar - built with React Native and Expo.

## Tech Stack

- React Native 0.81 with Expo SDK 54
- Expo Router for file-based navigation
- TanStack Query for server state management
- Jotai for client state management
- UniWind (Tailwind CSS for React Native) with Tailwind CSS v4
- Lingui for internationalization
- Orama for client-side search
- Expo SQLite for local database
- Better Auth Expo for authentication
- Eden Treaty for type-safe API communication

## Getting Started

Install packages with `pnpm install`.

## Development

Start the dev server:

```bash
pnpm start
# or
pnpm dev
```

Run on specific platforms:

```bash
pnpm android  # Start on Android
pnpm ios      # Start on iOS
```

## Commands

- `pnpm start` - Start Expo development server
- `pnpm android` - Start on Android emulator/device
- `pnpm ios` - Start on iOS simulator/device
- `pnpm test` - Run tests
- `pnpm lint` - Run linter

## Testing

Run tests with `pnpm test` or run specific tests with `pnpm test -t "test name"`.

## Building

The app is built and deployed using Expo Application Services (EAS).

See `eas.json` in the project root for build configuration.

## UI Components

This app uses UniWind (Tailwind CSS for React Native) for styling. It does **not** use shadcn/ui components since those are web-only (built on Radix UI primitives).

For shared utilities like `cn()`, import from `@bahar/design-system`:

```tsx
import { cn } from "@bahar/design-system";
```

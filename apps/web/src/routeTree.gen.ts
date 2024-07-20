/* prettier-ignore-start */

/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is auto-generated by TanStack Router

import { createFileRoute } from '@tanstack/react-router'

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as SearchLayoutRouteImport } from './routes/_search-layout/route'
import { Route as LayoutRouteImport } from './routes/_layout/route'
import { Route as AppLayoutRouteImport } from './routes/_app-layout/route'
import { Route as LayoutSignUpRouteImport } from './routes/_layout/sign-up/route'
import { Route as LayoutLoginRouteImport } from './routes/_layout/login/route'

// Create Virtual Routes

const SearchLayoutIndexLazyImport = createFileRoute('/_search-layout/')()
const AppLayoutSettingsRouteLazyImport = createFileRoute(
  '/_app-layout/settings',
)()
const AppLayoutDictionaryAddRouteLazyImport = createFileRoute(
  '/_app-layout/dictionary/add',
)()

// Create/Update Routes

const SearchLayoutRouteRoute = SearchLayoutRouteImport.update({
  id: '/_search-layout',
  getParentRoute: () => rootRoute,
} as any)

const LayoutRouteRoute = LayoutRouteImport.update({
  id: '/_layout',
  getParentRoute: () => rootRoute,
} as any)

const AppLayoutRouteRoute = AppLayoutRouteImport.update({
  id: '/_app-layout',
  getParentRoute: () => rootRoute,
} as any)

const SearchLayoutIndexLazyRoute = SearchLayoutIndexLazyImport.update({
  path: '/',
  getParentRoute: () => SearchLayoutRouteRoute,
} as any).lazy(() =>
  import('./routes/_search-layout/index.lazy').then((d) => d.Route),
)

const AppLayoutSettingsRouteLazyRoute = AppLayoutSettingsRouteLazyImport.update(
  {
    path: '/settings',
    getParentRoute: () => AppLayoutRouteRoute,
  } as any,
).lazy(() =>
  import('./routes/_app-layout/settings/route.lazy').then((d) => d.Route),
)

const LayoutSignUpRouteRoute = LayoutSignUpRouteImport.update({
  path: '/sign-up',
  getParentRoute: () => LayoutRouteRoute,
} as any).lazy(() =>
  import('./routes/_layout/sign-up/route.lazy').then((d) => d.Route),
)

const LayoutLoginRouteRoute = LayoutLoginRouteImport.update({
  path: '/login',
  getParentRoute: () => LayoutRouteRoute,
} as any).lazy(() =>
  import('./routes/_layout/login/route.lazy').then((d) => d.Route),
)

const AppLayoutDictionaryAddRouteLazyRoute =
  AppLayoutDictionaryAddRouteLazyImport.update({
    path: '/dictionary/add',
    getParentRoute: () => AppLayoutRouteRoute,
  } as any).lazy(() =>
    import('./routes/_app-layout/dictionary/add/route.lazy').then(
      (d) => d.Route,
    ),
  )

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/_app-layout': {
      preLoaderRoute: typeof AppLayoutRouteImport
      parentRoute: typeof rootRoute
    }
    '/_layout': {
      preLoaderRoute: typeof LayoutRouteImport
      parentRoute: typeof rootRoute
    }
    '/_search-layout': {
      preLoaderRoute: typeof SearchLayoutRouteImport
      parentRoute: typeof rootRoute
    }
    '/_layout/login': {
      preLoaderRoute: typeof LayoutLoginRouteImport
      parentRoute: typeof LayoutRouteImport
    }
    '/_layout/sign-up': {
      preLoaderRoute: typeof LayoutSignUpRouteImport
      parentRoute: typeof LayoutRouteImport
    }
    '/_app-layout/settings': {
      preLoaderRoute: typeof AppLayoutSettingsRouteLazyImport
      parentRoute: typeof AppLayoutRouteImport
    }
    '/_search-layout/': {
      preLoaderRoute: typeof SearchLayoutIndexLazyImport
      parentRoute: typeof SearchLayoutRouteImport
    }
    '/_app-layout/dictionary/add': {
      preLoaderRoute: typeof AppLayoutDictionaryAddRouteLazyImport
      parentRoute: typeof AppLayoutRouteImport
    }
  }
}

// Create and export the route tree

export const routeTree = rootRoute.addChildren([
  AppLayoutRouteRoute.addChildren([
    AppLayoutSettingsRouteLazyRoute,
    AppLayoutDictionaryAddRouteLazyRoute,
  ]),
  LayoutRouteRoute.addChildren([LayoutLoginRouteRoute, LayoutSignUpRouteRoute]),
  SearchLayoutRouteRoute.addChildren([SearchLayoutIndexLazyRoute]),
])

/* prettier-ignore-end */

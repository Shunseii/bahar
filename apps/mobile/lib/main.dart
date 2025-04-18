import 'package:bahar/common/providers/app_state_provider.dart';
import 'package:bahar/common/services/database_service.dart';
import 'package:bahar/common/theme.dart';
import 'package:bahar/common/widgets/nav.dart';
import 'package:bahar/features/home/home_screen.dart';
import 'package:bahar/features/onboarding/getting_started_screen.dart';
import 'package:bahar/features/settings/settings_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:toastification/toastification.dart';
import 'package:flutter/widgets.dart';
import 'dart:developer' as developer;
import 'package:flutter_native_splash/flutter_native_splash.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'root');

class RouterRefreshNotifier extends ChangeNotifier {
  RouterRefreshNotifier(Ref ref) {
    ref.listen(appSettingsProvider, (_, __) {
      notifyListeners();
    });
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refreshListenable = RouterRefreshNotifier(ref);

  // appSettings is already loaded in MyApp, so we can safely access it
  final appState = ref.read(appSettingsProvider).value!;
  final hasUserId = appState.userId.isNotEmpty;

  final initialLocation = hasUserId ? '/home' : '/onboarding';

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    refreshListenable: refreshListenable,
    initialLocation: initialLocation,
    redirect: (context, state) {
      final userId = ref.read(userIdProvider);

      // Make sure we're always on the correct route based on auth state
      if (userId.isEmpty && state.fullPath != '/onboarding') {
        return '/onboarding';
      }

      if (userId.isNotEmpty && state.fullPath == '/onboarding') {
        return '/home';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const GettingStartedPage(),
      ),
      ShellRoute(
        navigatorKey: GlobalKey<NavigatorState>(debugLabel: 'shell'),
        builder: (context, state, child) {
          return AuthenticatedScreenLayout(page: child);
        },
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => const HomePage(),
          ),
          GoRoute(
            path: '/decks',
            builder: (context, state) => const Placeholder(),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const SettingsPage(),
          ),
        ],
      ),
    ],
    restorationScopeId: 'app',
    debugLogDiagnostics: true,
  );
});

void main() async {
  // Keep splash screen visible while we initialize
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  try {
    final databaseService = DatabaseService.instance;
    await databaseService.initialize();

    runApp(ProviderScope(child: MyApp()));
  } catch (e) {
    // If there's an error during initialization, remove splash and show error
    FlutterNativeSplash.remove();

    runApp(MaterialApp(
      home: Scaffold(
        body: Center(
          child: Text('Error initializing app: $e'),
        ),
      ),
    ));
  }
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final locale = ref.watch(localeProvider);

    final appSettings = ref.watch(appSettingsProvider);

    // Wait for app settings to be fully loaded before initializing the router
    return appSettings.when(
      data: (settings) {
        final router = ref.watch(routerProvider);

        FlutterNativeSplash.remove();

        return ToastificationConfigProvider(
          config: const ToastificationConfig(
            alignment: Alignment.topCenter,
            maxToastLimit: 3,
          ),
          child: ToastificationWrapper(
            child: MaterialApp.router(
              onGenerateTitle: (context) =>
                  AppLocalizations.of(context)!.appName,
              locale: locale,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              theme: AppTheme.lightTheme(),
              darkTheme: AppTheme.darkTheme(),
              themeMode: themeMode,
              routerConfig: router,
            ),
          ),
        );
      },
      loading: () {
        // Return empty container - the splash screen is still visible
        // We want to keep showing the native splash until data is loaded
        return const SizedBox.shrink();
      },
      error: (error, stack) {
        FlutterNativeSplash.remove();

        return MaterialApp(
          theme: AppTheme.lightTheme(),
          darkTheme: AppTheme.darkTheme(),
          themeMode: ThemeMode.system,
          home: Scaffold(
            body: Center(
              child: Text('Error loading app: $error'),
            ),
          ),
        );
      },
    );
  }
}

class AuthenticatedScreenLayout extends StatelessWidget {
  const AuthenticatedScreenLayout({
    super.key,
    required this.page,
  });

  final Widget page;

  Widget _buildAppBarTitle(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    final l10n = AppLocalizations.of(context)!;

    // Only show search bar on home page
    if (location == '/home') {
      return Consumer(
        builder: (context, ref, child) {
          final theme = Theme.of(context);
          final hintColor = theme.textTheme.labelSmall?.color;

          return SearchBar(
            hintText: l10n.searchHint,
            hintStyle: WidgetStatePropertyAll(
              theme.textTheme.labelLarge!.copyWith(
                color: hintColor,
              ),
            ),
            leading: Icon(
              LucideIcons.search,
              color: hintColor,
              size: 18.0,
            ),
            elevation: WidgetStatePropertyAll(0.0),
            padding: const WidgetStatePropertyAll(
              EdgeInsets.symmetric(horizontal: 8.0),
            ),
            shape: WidgetStatePropertyAll(
              RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12.0),
              ),
            ),
            constraints: const BoxConstraints(
              maxHeight: 40.0,
              minHeight: 40.0,
            ),
            backgroundColor: WidgetStatePropertyAll(
              Theme.of(context).colorScheme.surfaceContainer,
            ),
            side: WidgetStatePropertyAll(
              BorderSide(color: Theme.of(context).colorScheme.outline),
            ),
            onChanged: (value) {
              ref.read(searchQueryProvider.notifier).state = value;
            },
          );
        },
      );
    }

    return const SizedBox.shrink();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final theme = Theme.of(context);

        return Scaffold(
          backgroundColor: theme.colorScheme.surface,
          appBar: AppBar(
            scrolledUnderElevation: 0.0,
            backgroundColor: theme.colorScheme.surfaceContainer,
            title: _buildAppBarTitle(context),
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(1.0),
              child: Container(
                color: theme.colorScheme.outline,
                height: 1.0,
              ),
            ),
            leading: Builder(
              builder: (context) {
                return IconButton(
                  icon: const Icon(
                    LucideIcons.panel_left,
                  ),
                  onPressed: () {
                    Scaffold.of(context).openDrawer();
                  },
                );
              },
            ),
          ),
          drawer: CustomNavigationDrawer(),
          body: Row(
            children: [
              Expanded(
                child: Container(
                  color: theme.colorScheme.surface,
                  child: page,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

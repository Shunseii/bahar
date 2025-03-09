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

final GlobalKey<NavigatorState> _rootNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'root');

// Router configuration with redirect logic
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/home',
    redirect: (context, state) {
      final userId = ref.read(userIdProvider);
      
      // If there's no userId and the user is not already on the onboarding route
      if (userId.isEmpty && state.fullPath != '/onboarding') {
        return '/onboarding';
      }
      
      // If there is a userId and the user is on the onboarding route
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
  WidgetsFlutterBinding.ensureInitialized();

  final databaseService = DatabaseService.instance;
  await databaseService.initialize();

  runApp(ProviderScope(child: MyApp()));
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final locale = ref.watch(localeProvider);
    final router = ref.watch(routerProvider);

    return ToastificationConfigProvider(
      config: const ToastificationConfig(
        alignment: Alignment.topCenter,
        maxToastLimit: 3,
      ),
      child: _EagerInitialization(
        child: ToastificationWrapper(
          child: MaterialApp.router(
            onGenerateTitle: (context) => AppLocalizations.of(context)!.appName,
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.lightTheme(),
            darkTheme: AppTheme.darkTheme(),
            themeMode: themeMode,
            routerConfig: router,
          ),
        ),
      ),
    );
  }
}

class AuthenticatedScreenLayout extends StatelessWidget {
  const AuthenticatedScreenLayout({
    super.key,
    required this.page,
  });

  final Widget page;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final theme = Theme.of(context);

        return Scaffold(
          backgroundColor: theme.colorScheme.surface,
          appBar: AppBar(
            scrolledUnderElevation: 0,
            backgroundColor: theme.colorScheme.surfaceContainer,
            // Bottom border
            bottom: PreferredSize(
              preferredSize: Size.fromHeight(1.0),
              child: Container(
                color: theme.colorScheme.outline,
                height: 1.0,
              ),
            ),
            leading: Builder(
              builder: (context) {
                return IconButton(
                  icon: const Icon(LucideIcons.panel_left),
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

// Eagerly initialize theme, locale, and userId
class _EagerInitialization extends ConsumerWidget {
  const _EagerInitialization({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Eagerly initialize providers by watching them.
    // By using "watch", the provider will stay alive and not be disposed.
    ref.watch(appSettingsProvider);

    return child;
  }
}

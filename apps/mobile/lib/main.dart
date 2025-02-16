import 'package:bahar/core/app_state.dart';
import 'package:bahar/core/theme.dart';
import 'package:bahar/screens/home.dart';
import 'package:bahar/screens/settings.dart';
import 'package:bahar/widgets/nav.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => AppState(),
      child: Consumer<AppState>(
        builder: (context, appState, child) {
          return MaterialApp(
            onGenerateTitle: (context) => AppLocalizations.of(context)!.appName,
            locale: appState.locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.lightTheme(),
            darkTheme: AppTheme.darkTheme(),
            themeMode: appState.themeMode,
            home: MainPage(),
          );
        },
      ),
    );
  }
}

class MainPage extends StatefulWidget {
  const MainPage({super.key});

  @override
  State<MainPage> createState() => _MainPageState();
}

class _MainPageState extends State<MainPage> {
  var selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    Widget page;
    switch (selectedIndex) {
      case 0:
        page = HomePage();
        break;
      case 1:
        page = Placeholder();
        break;
      case 2:
        page = SettingsPage();
        break;
      default:
        throw UnimplementedError("no widget for $selectedIndex");
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final theme = Theme.of(context);

        return Scaffold(
          appBar: AppBar(
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
          drawer: CustomNavigationDrawer(
            selectedIndex: selectedIndex,
            onDestinationSelected: (index) {
              setState(
                () {
                  selectedIndex = index;
                },
              );
            },
          ),
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

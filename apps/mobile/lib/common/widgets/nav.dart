import 'package:bahar/features/home/home_screen.dart';
import 'package:bahar/features/settings/settings_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'dart:developer' as developer;
import 'package:go_router/go_router.dart';

class Destination {
  const Destination(
      this.label, this.icon, this.selectedIcon, this.page, this.path);

  final String label;
  final Widget icon;
  final Widget selectedIcon;
  final Widget page;
  final String path;
}

const List<Destination> destinations = <Destination>[
  Destination(
    'Home',
    Icon(LucideIcons.house),
    Icon(LucideIcons.house),
    HomePage(),
    '/home',
  ),
  Destination(
    'Decks',
    Icon(LucideIcons.layers),
    Icon(LucideIcons.layers),
    Placeholder(),
    '/decks',
  ),
  Destination(
    'Settings',
    Icon(LucideIcons.settings),
    Icon(LucideIcons.settings),
    SettingsPage(),
    '/settings',
  ),
];

class CustomNavigationDrawer extends StatefulWidget {
  const CustomNavigationDrawer({
    super.key,
  });

  @override
  State<CustomNavigationDrawer> createState() => _CustomNavigationDrawerState();
}

class _CustomNavigationDrawerState extends State<CustomNavigationDrawer> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final location = GoRouterState.of(context).uri.path;

    // Find the selected index based on the current path
    int selectedIndex =
        destinations.indexWhere((dest) => dest.path == location);

    if (selectedIndex == -1) selectedIndex = 0;

    return Container(
      decoration: BoxDecoration(
        border: Border(
          left: isRtl
              ? BorderSide(color: theme.colorScheme.outline)
              : BorderSide.none,
          right: isRtl
              ? BorderSide.none
              : BorderSide(color: theme.colorScheme.outline),
        ),
      ),
      child: NavigationDrawer(
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) {
          context.push(destinations[index].path);
        },
        backgroundColor: theme.colorScheme.surfaceContainer,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 16, 16, 10),
            child: Text(
              AppLocalizations.of(context)!.appName,
              style: theme.textTheme.titleSmall,
            ),
          ),
          ...destinations.map((destination) {
            return NavigationDrawerDestination(
              label: Text(destination.label),
              icon: destination.icon,
              selectedIcon: destination.selectedIcon,
            );
          }),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: ElevatedButton(
                onPressed: () {
                  print("Logged out!");
                },
                child: Text("Logout")),
          )
        ],
      ),
    );
  }
}

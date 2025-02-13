import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class Destination {
  const Destination(this.label, this.icon, this.selectedIcon);

  final String label;
  final Widget icon;
  final Widget selectedIcon;
}

const List<Destination> destinations = <Destination>[
  Destination('Home', Icon(LucideIcons.house), Icon(LucideIcons.house)),
  Destination('Decks', Icon(LucideIcons.layers), Icon(LucideIcons.layers)),
  Destination(
      'Settings', Icon(LucideIcons.settings), Icon(LucideIcons.settings)),
];

class CustomNavigationDrawer extends StatelessWidget {
  const CustomNavigationDrawer({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
          border: Border(
              right: BorderSide(
        color: Theme.of(context).colorScheme.outline,
      ))),
      child: NavigationDrawer(
        selectedIndex: selectedIndex,
        onDestinationSelected: onDestinationSelected,
        backgroundColor: Theme.of(context).colorScheme.surfaceContainer,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 16, 16, 10),
            child: Text(
              'Bahar',
              style: Theme.of(context).textTheme.titleSmall,
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

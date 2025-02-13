import 'dart:collection';

import 'package:bahar/core/app_state.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

typedef ThemeOptionEntry = DropdownMenuEntry<ThemeOption>;

enum ThemeOption {
  light("Light", LucideIcons.sun),
  dark("Dark", LucideIcons.moon),
  system("System", LucideIcons.settings);

  const ThemeOption(this.label, this.icon);
  final String label;
  final IconData icon;

  static final List<ThemeOptionEntry> entries = UnmodifiableListView(
    values.map<ThemeOptionEntry>(
      (ThemeOption option) => ThemeOptionEntry(
        value: option,
        label: option.label,
        leadingIcon: Icon(option.icon),
      ),
    ),
  );

  static ThemeOption fromThemeMode(ThemeMode themeMode) {
    return switch (themeMode) {
      ThemeMode.light => ThemeOption.light,
      ThemeMode.dark => ThemeOption.dark,
      ThemeMode.system => ThemeOption.system,
    };
  }

  static ThemeMode toThemeMode(ThemeOption themeOption) {
    return switch (themeOption) {
      ThemeOption.light => ThemeMode.light,
      ThemeOption.dark => ThemeMode.dark,
      ThemeOption.system => ThemeMode.system,
    };
  }
}

class ThemeToggle extends StatelessWidget {
  const ThemeToggle({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    var appState = context.watch<AppState>();

    return DropdownMenu<ThemeOption>(
      dropdownMenuEntries: ThemeOption.entries,
      inputDecorationTheme: Theme.of(context).inputDecorationTheme,
      initialSelection: ThemeOption.fromThemeMode(appState.themeMode),
      selectedTrailingIcon: Icon(LucideIcons.chevron_up),
      trailingIcon: Icon(LucideIcons.chevron_down),
      leadingIcon: Icon(ThemeOption.fromThemeMode(appState.themeMode).icon),
      label: Text("Theme"),
      onSelected: (ThemeOption? newValue) {
        if (newValue != null) {
          appState.setThemeMode(
            ThemeOption.toThemeMode(newValue),
          );
        }
      },
    );
  }
}

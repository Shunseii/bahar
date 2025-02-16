import 'dart:collection';

import 'package:bahar/core/app_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';

typedef ThemeOptionEntry = DropdownMenuEntry<ThemeOption>;

enum ThemeOption {
  dark("theme_dark", LucideIcons.moon),
  light("theme_light", LucideIcons.sun),
  system("theme_system", LucideIcons.monitor);

  const ThemeOption(this.labelKey, this.icon);
  final String labelKey;
  final IconData icon;

  static List<ThemeOptionEntry> getEntries(BuildContext context) {
    return UnmodifiableListView(
      values.map<ThemeOptionEntry>(
        (ThemeOption option) => ThemeOptionEntry(
          value: option,
          label: getTranslatedLabel(context, option.labelKey),
          leadingIcon: Icon(option.icon),
        ),
      ),
    );
  }

  static String getTranslatedLabel(BuildContext context, String labelKey) {
    return switch (labelKey) {
      "theme_dark" => AppLocalizations.of(context)!.themeDark,
      "theme_light" => AppLocalizations.of(context)!.themeLight,
      "theme_system" => AppLocalizations.of(context)!.themeSystem,
      _ => throw UnimplementedError("no label for $labelKey"),
    };
  }

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
      key: Key(appState.locale?.languageCode ?? Locale("en").languageCode),
      dropdownMenuEntries: ThemeOption.getEntries(context),
      inputDecorationTheme: Theme.of(context).inputDecorationTheme,
      initialSelection: ThemeOption.fromThemeMode(appState.themeMode),
      selectedTrailingIcon: Icon(LucideIcons.chevron_up),
      trailingIcon: Icon(LucideIcons.chevron_down),
      leadingIcon: Icon(ThemeOption.fromThemeMode(appState.themeMode).icon),
      label: Text(AppLocalizations.of(context)!.themeLabel),
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

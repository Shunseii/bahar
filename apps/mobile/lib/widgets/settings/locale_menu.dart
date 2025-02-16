import 'dart:collection';

import 'package:bahar/core/app_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';

typedef LocaleOptionEntry = DropdownMenuEntry<LocaleOption>;

enum LocaleOption {
  en("en"),
  ar("ar");

  const LocaleOption(this.labelKey);
  final String labelKey;

  static List<LocaleOptionEntry> getEntries(BuildContext context) {
    return UnmodifiableListView(
      values.map<LocaleOptionEntry>(
        (LocaleOption option) => LocaleOptionEntry(
          value: option,
          label: getTranslatedLabel(context, option.labelKey),
        ),
      ),
    );
  }

  static String getTranslatedLabel(BuildContext context, String labelKey) {
    return switch (labelKey) {
      "en" => AppLocalizations.of(context)!.englishLanguageLabel,
      "ar" => AppLocalizations.of(context)!.arabicLanguageLabel,
      _ => throw UnimplementedError("no label for $labelKey"),
    };
  }

  static LocaleOption fromLocale(Locale locale) {
    return switch (locale.languageCode) {
      "en" => LocaleOption.en,
      "ar" => LocaleOption.ar,
      _ => throw UnimplementedError("no language for $locale"),
    };
  }

  static Locale toLocale(LocaleOption languageOption) {
    return switch (languageOption) {
      LocaleOption.en => Locale("en"),
      LocaleOption.ar => Locale("ar"),
    };
  }
}

class LocaleMenu extends StatelessWidget {
  const LocaleMenu({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    var appState = context.watch<AppState>();

    return DropdownMenu<LocaleOption>(
      dropdownMenuEntries: LocaleOption.getEntries(context),
      inputDecorationTheme: Theme.of(context).inputDecorationTheme,
      initialSelection:
          LocaleOption.fromLocale(appState.locale ?? Locale("en")),
      selectedTrailingIcon: Icon(LucideIcons.chevron_up),
      trailingIcon: Icon(LucideIcons.chevron_down),
      label: Text(AppLocalizations.of(context)!.localeLabel),
      onSelected: (LocaleOption? newValue) {
        if (newValue != null) {
          appState.setLocale(LocaleOption.toLocale(newValue));
        }
      },
    );
  }
}

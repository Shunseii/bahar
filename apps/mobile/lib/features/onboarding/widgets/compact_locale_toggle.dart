import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/common/providers/app_state_provider.dart';
import 'package:bahar/features/settings/widgets/locale_menu.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CompactLocaleToggle extends ConsumerWidget {
  const CompactLocaleToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);
    final localeOption = LocaleOption.fromLocale(locale);

    return PopupMenuButton<LocaleOption>(
      tooltip: AppLocalizations.of(context)!.localeLabel,
      icon: Text(
        locale.languageCode == 'en' ? "EN" : "ع",
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              fontWeight: FontWeight.bold,
            ),
      ),
      itemBuilder: (context) => LocaleOption.values.map((option) {
        final isSelected = option == localeOption;
        return PopupMenuItem<LocaleOption>(
          value: option,
          child: Row(
            children: [
              Expanded(
                child: Text(LocaleOption.getTranslatedLabel(context, option.labelKey)),
              ),
              if (isSelected)
                Icon(
                  Icons.check,
                  size: 16,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
            ],
          ),
        );
      }).toList(),
      onSelected: (LocaleOption newValue) {
        ref.read(appSettingsProvider.notifier).setLocale(
              LocaleOption.toLocale(newValue),
            );
      },
    );
  }
}

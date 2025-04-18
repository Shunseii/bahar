import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/common/providers/app_state_provider.dart';
import 'package:bahar/features/settings/widgets/theme_toggle.dart';
import 'package:bahar/common/widgets/localized_icon.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CompactThemeToggle extends ConsumerWidget {
  const CompactThemeToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final themeOption = ThemeOption.fromThemeMode(themeMode);

    return PopupMenuButton<ThemeOption>(
      tooltip: AppLocalizations.of(context)!.themeLabel,
      icon: LocalizedIcon(
        icon: Icon(
          themeOption.icon,
          color: Theme.of(context).colorScheme.onSurface,
        ),
      ),
      itemBuilder: (context) => ThemeOption.values.map((option) {
        final isSelected = option == themeOption;
        return PopupMenuItem<ThemeOption>(
          value: option,
          child: Row(
            children: [
              LocalizedIcon(
                icon: Icon(
                  option.icon,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              const SizedBox(width: 12.0),
              Expanded(
                child: Text(ThemeOption.getTranslatedLabel(context, option.labelKey)),
              ),
              if (isSelected)
                Icon(
                  Icons.check,
                  size: 16.0,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
            ],
          ),
        );
      }).toList(),
      onSelected: (ThemeOption newValue) {
        ref.read(appSettingsProvider.notifier).setThemeMode(
              ThemeOption.toThemeMode(newValue),
            );
      },
    );
  }
}

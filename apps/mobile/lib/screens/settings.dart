import 'package:bahar/widgets/settings/locale_menu.dart';
import 'package:bahar/widgets/settings/settings_card.dart';
import 'package:bahar/widgets/settings/theme_toggle.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            AppLocalizations.of(context)!.settingsPageTitle,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          SizedBox(height: 24),
          SettingsCard(
            title:
                AppLocalizations.of(context)!.settingsPageAppearanceCardTitle,
            subtitle: AppLocalizations.of(context)!
                .settingsPageAppearanceCardSubtitle,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 24.0,
                children: [
                  ThemeToggle(),
                  LocaleMenu(),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

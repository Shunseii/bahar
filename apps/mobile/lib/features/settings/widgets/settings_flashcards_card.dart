import 'package:bahar/common/widgets/compact_radio_list_tile.dart';
import 'package:bahar/features/settings/providers/settings_provider.dart';
import 'package:bahar/features/settings/widgets/settings_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/features/settings/models/settings_model.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class SettingsFlashcardCard extends ConsumerStatefulWidget {
  const SettingsFlashcardCard({
    super.key,
  });

  @override
  ConsumerState<SettingsFlashcardCard> createState() =>
      _SettingsFlashcardCardState();
}

class _SettingsFlashcardCardState extends ConsumerState<SettingsFlashcardCard> {
  FlashcardFieldDisplay? _showAntonyms = FlashcardFieldDisplay.hidden;

  @override
  void initState() {
    super.initState();

    ref.read(settingsProvider.future).then((settings) {
      setState(() {
        _showAntonyms =
            settings?.showAntonymsInFlashcard ?? FlashcardFieldDisplay.hidden;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return SettingsCard(
      title: AppLocalizations.of(context)!.settingsPageFlashcardsCardTitle,
      subtitle:
          AppLocalizations.of(context)!.settingsPageFlashcardsCardSubtitle,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 24,
          children: [
            AntonymsSection(
              showAntonyms: _showAntonyms,
              onChanged: (FlashcardFieldDisplay? value) {
                setState(() {
                  _showAntonyms = value;
                });
              },
            ),
          ],
        ),
      ],
    );
  }
}

class AntonymsSection extends ConsumerWidget {
  final FlashcardFieldDisplay? showAntonyms;
  final ValueChanged<FlashcardFieldDisplay?>? onChanged;

  const AntonymsSection({
    super.key,
    required this.showAntonyms,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          AppLocalizations.of(context)!.antonymsSettingsTitle,
          style: Theme.of(context).textTheme.titleSmall,
        ),
        Column(
          children: [
            CompactRadioListTile<FlashcardFieldDisplay>(
              titleLabel: AppLocalizations.of(context)!
                  .flashcardFieldDisplaySettingHidden,
              value: FlashcardFieldDisplay.hidden,
              groupValue: showAntonyms,
              onChanged: onChanged,
            ),
            CompactRadioListTile<FlashcardFieldDisplay>(
              titleLabel: AppLocalizations.of(context)!
                  .flashcardFieldDisplaySettingHint,
              value: FlashcardFieldDisplay.hint,
              groupValue: showAntonyms,
              onChanged: onChanged,
            ),
            CompactRadioListTile<FlashcardFieldDisplay>(
              titleLabel: AppLocalizations.of(context)!
                  .flashcardFieldDisplaySettingAnswer,
              value: FlashcardFieldDisplay.answer,
              groupValue: showAntonyms,
              onChanged: onChanged,
            ),
          ],
        ),
        ElevatedButton(
          onPressed: () async {
            final currentSettings = await ref.read(settingsProvider.future);

            ref.read(settingsProvider.notifier).updateSettings(
                  currentSettings!.copyWith(
                    showAntonymsInFlashcard:
                        showAntonyms ?? FlashcardFieldDisplay.hidden,
                  ),
                );

            if (!context.mounted) return;

            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Settings updated!'),
                duration: Duration(seconds: 2), // Adjust the duration as needed
              ),
            );
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.primary,
            foregroundColor: Theme.of(context).colorScheme.onPrimary,
          ),
          child: Text("Save"),
        ),
      ],
    );
  }
}

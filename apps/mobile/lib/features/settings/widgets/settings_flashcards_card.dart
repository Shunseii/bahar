import 'package:bahar/common/widgets/compact_radio_list_tile.dart';
import 'package:bahar/features/settings/widgets/settings_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/features/settings/models/settings_model.dart';

class SettingsFlashcardCard extends StatefulWidget {
  const SettingsFlashcardCard({
    super.key,
  });

  @override
  State<SettingsFlashcardCard> createState() => _SettingsFlashcardCardState();
}

class _SettingsFlashcardCardState extends State<SettingsFlashcardCard> {
  FlashcardFieldDisplay? _showAntonyms = FlashcardFieldDisplay.hidden;

  @override
  Widget build(BuildContext context) {
    return SettingsCard(
      title: AppLocalizations.of(context)!.settingsPageFlashcardsCardTitle,
      subtitle:
          AppLocalizations.of(context)!.settingsPageFlashcardsCardSubtitle,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 24.0,
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

class AntonymsSection extends StatelessWidget {
  final FlashcardFieldDisplay? showAntonyms;
  final ValueChanged<FlashcardFieldDisplay?>? onChanged;

  const AntonymsSection({
    super.key,
    required this.showAntonyms,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
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
        )
      ],
    );
  }
}

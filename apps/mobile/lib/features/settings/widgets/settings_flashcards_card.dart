import 'package:bahar/common/widgets/compact_radio_list_tile.dart';
import 'package:bahar/features/settings/providers/settings_provider.dart';
import 'package:bahar/features/settings/widgets/settings_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/features/settings/models/settings_model.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:toastification/toastification.dart';
import 'package:bahar/common/utils/toast.dart';
import 'package:bahar/common/widgets/primary_button.dart';

class SettingsFlashcardCard extends ConsumerStatefulWidget {
  const SettingsFlashcardCard({
    super.key,
  });

  @override
  ConsumerState<SettingsFlashcardCard> createState() =>
      _SettingsFlashcardCardState();
}

class _SettingsFlashcardCardState extends ConsumerState<SettingsFlashcardCard> {
  FlashcardFieldDisplay? showAntonyms = FlashcardFieldDisplay.hidden;
  bool showReverseFlashcards = false;
  bool isDirty = false;

  @override
  void initState() {
    super.initState();

    ref.read(settingsProvider.future).then((settings) {
      setState(() {
        showAntonyms =
            settings?.showAntonymsInFlashcard ?? FlashcardFieldDisplay.hidden;
        showReverseFlashcards = settings?.showReverseFlashcards ?? false;
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
          spacing: 16,
          children: [
            AntonymsSection(
              showAntonyms: showAntonyms,
              onChanged: (FlashcardFieldDisplay? value) {
                setState(() {
                  isDirty = true;
                  showAntonyms = value;
                });
              },
            ),
            const SizedBox(height: 16),
            ReverseFlashcardsSection(
              showReverseFlashcards: showReverseFlashcards,
              onChanged: (bool value) {
                setState(() {
                  isDirty = true;
                  showReverseFlashcards = value;
                });
              },
            ),
            PrimaryButton(
              label: AppLocalizations.of(context)!.settingsPageSaveButtonLabel,
              disabled: !isDirty,
              onPressed: () async {
                setState(() {
                  isDirty = false;
                });

                final currentSettings = await ref.read(settingsProvider.future);

                ref.read(settingsProvider.notifier).updateSettings(
                      currentSettings!.copyWith(
                        showAntonymsInFlashcard:
                            showAntonyms ?? FlashcardFieldDisplay.hidden,
                        showReverseFlashcards: showReverseFlashcards,
                      ),
                    );

                if (!context.mounted) return;

                showToast(
                  context: context,
                  type: ToastificationType.success,
                  title: 'Settings updated!',
                  description: 'Your settings have been updated.',
                );
              },
            )
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
      ],
    );
  }
}

class ReverseFlashcardsSection extends ConsumerWidget {
  final bool showReverseFlashcards;
  final ValueChanged<bool> onChanged;

  const ReverseFlashcardsSection({
    super.key,
    required this.showReverseFlashcards,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colorScheme = Theme.of(context).colorScheme;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              AppLocalizations.of(context)!.reverseFlashcardsTitle,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            Text(
              AppLocalizations.of(context)!.reverseFlashcardsDescription,
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
        Switch(
          value: showReverseFlashcards,
          onChanged: onChanged,
          thumbColor: WidgetStateProperty.resolveWith<Color>((states) {
            return colorScheme.surfaceContainer;
          }),
          trackColor: WidgetStateProperty.resolveWith<Color>((states) {
            final bool isSelected = states.contains(WidgetState.selected);

            return isSelected ? colorScheme.primary : colorScheme.outline;
          }),
          trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
        ),
      ],
    );
  }
}

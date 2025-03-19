import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/common/widgets/secondary_button.dart';

class ReviewFlashcardsButton extends StatelessWidget {
  const ReviewFlashcardsButton({
    super.key,
    required this.l10n,
  });

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return SecondaryButton(
      label: l10n.reviewFlashcards,
      onPressed: () {
        // TODO: Show flashcards drawer
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(l10n.reviewFlashcards),
          ),
        );
      },
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:bahar/common/widgets/secondary_button.dart';

class AddWordButton extends StatelessWidget {
  const AddWordButton({
    super.key,
    required this.l10n,
  });

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final textColor = Theme.of(context).textTheme.bodyMedium?.color;

    return SecondaryButton(
      label: l10n.addWord,
      icon: Icon(LucideIcons.plus, size: 18.0, color: textColor),
      onPressed: () {
        // TODO: Navigate to add word page
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(l10n.addWord),
          ),
        );
      },
    );
  }
}

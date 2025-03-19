import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class DictionaryEntryCard extends StatelessWidget {
  final String arabicWord;
  final String translation;
  final VoidCallback onEdit;

  const DictionaryEntryCard({
    super.key,
    required this.arabicWord,
    required this.translation,
    required this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: IconButton(
            icon: Icon(
              LucideIcons.square_pen,
              size: 18.0,
              color: theme.colorScheme.onSurface,
            ),
            onPressed: onEdit,
            tooltip: 'Edit',
            style: IconButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: const Size(32.0, 32.0),
            ),
          ),
        ),
        Directionality(
          textDirection: TextDirection.rtl,
          child: Text(
            arabicWord,
            style: theme.textTheme.headlineMedium,
            textAlign: TextAlign.right,
          ),
        ),
        const SizedBox(height: 8.0),
        Text(
          translation,
          style: theme.textTheme.bodyLarge,
        ),
      ],
    );
  }
}

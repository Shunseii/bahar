import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/features/home/widgets/dictionary_section.dart';

class SearchResultsTextContainer extends StatelessWidget {
  const SearchResultsTextContainer({
    super.key,
    required this.filteredWords,
    required this.l10n,
    required this.theme,
  });

  final List<Flashcard> filteredWords;
  final AppLocalizations l10n;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 16.0),
        child: Text(
          '${filteredWords.length} ${l10n.resultsFound}',
          style: theme.textTheme.labelSmall,
        ),
      ),
    );
  }
}

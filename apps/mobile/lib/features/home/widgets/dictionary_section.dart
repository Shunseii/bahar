import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/features/home/widgets/dictionary_entry_card.dart';

typedef Flashcard = ({
  String word,
  String translation,
});

class DictionarySection extends StatelessWidget {
  const DictionarySection({
    super.key,
    required this.l10n,
    required this.theme,
    required this.filteredWords,
  });

  final AppLocalizations l10n;
  final ThemeData theme;
  final List<Flashcard> filteredWords;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      color: theme.colorScheme.surfaceContainer,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Text(
              l10n.dictionary,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8.0),
            Text(
              l10n.dictionaryDescription,
              style: theme.textTheme.labelSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16.0),
            filteredWords.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          l10n.noWordsMessage,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8.0),
                        Text(
                          l10n.addSomeToGetStarted,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filteredWords.length,
                    separatorBuilder: (context, index) => const Divider(),
                    itemBuilder: (context, index) {
                      final word = filteredWords[index];

                      return DictionaryEntryCard(
                        // TODO: Replace with real data
                        arabicWord: word.word,
                        translation: word.translation,
                        onEdit: () {
                          // TODO: Navigate to edit page
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Edit word: ${word.word}'),
                            ),
                          );
                        },
                      );
                    },
                  ),
          ],
        ),
      ),
    );
  }
}

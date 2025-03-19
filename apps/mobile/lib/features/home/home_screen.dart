import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/features/home/widgets/dictionary_section.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:bahar/features/home/widgets/add_word_button.dart';
import 'package:bahar/features/home/widgets/search_results_text_container.dart';
import 'package:bahar/features/home/widgets/review_flashcards_button.dart';

final searchQueryProvider = StateProvider<String>((ref) => '');

// TODO: Placeholder data for demonstration
final dictionaryWordsProvider = Provider<List<Flashcard>>((ref) => [
      (word: 'كتاب', translation: 'book'),
      (word: 'مدرسة', translation: 'school'),
      (word: 'قلم', translation: 'pen'),
      (word: 'شمس', translation: 'sun'),
      (word: 'قمر', translation: 'moon'),
    ]);

// TODO: Filtered words provider based on search query
final filteredWordsProvider = Provider<List<Flashcard>>((ref) {
  final query = ref.watch(searchQueryProvider).toLowerCase();
  final words = ref.watch(dictionaryWordsProvider);

  if (query.isEmpty) {
    return words;
  }

  return words
      .where((word) =>
          word.word.contains(query) ||
          word.translation.toLowerCase().contains(query))
      .toList();
});

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final filteredWords = ref.watch(filteredWordsProvider);
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                AddWordButton(l10n: l10n),
                ReviewFlashcardsButton(l10n: l10n),
              ],
            ),
            const SizedBox(height: 16.0),
            if (filteredWords.isNotEmpty)
              SearchResultsTextContainer(
                filteredWords: filteredWords,
                l10n: l10n,
                theme: theme,
              ),
            DictionarySection(
              l10n: l10n,
              theme: theme,
              filteredWords: filteredWords,
            ),
          ],
        ),
      ),
    );
  }
}

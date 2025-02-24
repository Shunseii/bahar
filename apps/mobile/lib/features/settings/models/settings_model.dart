import 'package:freezed_annotation/freezed_annotation.dart';

// ignore: unused_import
import 'package:flutter/foundation.dart';

part 'settings_model.freezed.dart';
part 'settings_model.g.dart';

// How a field should be displayed in a flashcard.
enum FlashcardFieldDisplay {
  hidden,
  hint,
  answer;
}

@freezed
class SettingsModel with _$SettingsModel {
  // Create a private constructor so that we can
  // add custom toMap and fromMap methods.
  const SettingsModel._();

  const factory SettingsModel({
    required String id,
    required String userId,
    @Default(false) bool showReverseFlashcards,
    @Default(FlashcardFieldDisplay.hidden)
    FlashcardFieldDisplay showAntonymsInFlashcard,
  }) = _SettingsModel;

  factory SettingsModel.fromJson(Map<String, dynamic> json) =>
      _$SettingsModelFromJson(json);

  // Returns a SQL statement that initializes the model
  // in the database by creating a table for it and
  // any other necessary actions.
  static String initDatabaseModelStatement() {
    return """
      CREATE TABLE settings(
        id TEXT NOT NULL PRIMARY KEY, 
        user_id TEXT NOT NULL UNIQUE, 
        show_reverse_flashcards INTEGER DEFAULT 0, 
        show_antonyms_in_flashcard TEXT DEFAULT 'hidden'
      );
    """;
  }

  // Converts the model to a map of the database fields
  Map<String, Object?> toMap() {
    return {
      'id': id,
      'user_id': userId,
      'show_reverse_flashcards': showReverseFlashcards,
      'show_antonyms_in_flashcard': showAntonymsInFlashcard.toString(),
    };
  }

  // Converts the result from the database to a model
  static SettingsModel fromMap(Map<String, Object?> map) {
    return SettingsModel(
      id: map['id'] as String,
      userId: map['user_id'] as String,
      showReverseFlashcards: map['show_reverse_flashcards'] == 1,
      showAntonymsInFlashcard: FlashcardFieldDisplay.values.firstWhere(
        (element) => element.toString() == map['show_antonyms_in_flashcard'],
      ),
    );
  }
}

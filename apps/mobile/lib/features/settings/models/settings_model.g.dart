// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SettingsModelImpl _$$SettingsModelImplFromJson(Map<String, dynamic> json) =>
    _$SettingsModelImpl(
      id: json['id'] as String,
      userId: json['userId'] as String,
      showReverseFlashcards: json['showReverseFlashcards'] as bool? ?? false,
      showAntonymsInFlashcard: $enumDecodeNullable(
              _$FlashcardFieldDisplayEnumMap,
              json['showAntonymsInFlashcard']) ??
          FlashcardFieldDisplay.hidden,
    );

Map<String, dynamic> _$$SettingsModelImplToJson(_$SettingsModelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'userId': instance.userId,
      'showReverseFlashcards': instance.showReverseFlashcards,
      'showAntonymsInFlashcard':
          _$FlashcardFieldDisplayEnumMap[instance.showAntonymsInFlashcard]!,
    };

const _$FlashcardFieldDisplayEnumMap = {
  FlashcardFieldDisplay.hidden: 'hidden',
  FlashcardFieldDisplay.hint: 'hint',
  FlashcardFieldDisplay.answer: 'answer',
};

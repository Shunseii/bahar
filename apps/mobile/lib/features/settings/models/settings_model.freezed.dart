// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'settings_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SettingsModel _$SettingsModelFromJson(Map<String, dynamic> json) {
  return _SettingsModel.fromJson(json);
}

/// @nodoc
mixin _$SettingsModel {
  String get id => throw _privateConstructorUsedError;
  String get userId => throw _privateConstructorUsedError;
  bool get showReverseFlashcards => throw _privateConstructorUsedError;
  FlashcardFieldDisplay get showAntonymsInFlashcard =>
      throw _privateConstructorUsedError;

  /// Serializes this SettingsModel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SettingsModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SettingsModelCopyWith<SettingsModel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SettingsModelCopyWith<$Res> {
  factory $SettingsModelCopyWith(
          SettingsModel value, $Res Function(SettingsModel) then) =
      _$SettingsModelCopyWithImpl<$Res, SettingsModel>;
  @useResult
  $Res call(
      {String id,
      String userId,
      bool showReverseFlashcards,
      FlashcardFieldDisplay showAntonymsInFlashcard});
}

/// @nodoc
class _$SettingsModelCopyWithImpl<$Res, $Val extends SettingsModel>
    implements $SettingsModelCopyWith<$Res> {
  _$SettingsModelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SettingsModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? showReverseFlashcards = null,
    Object? showAntonymsInFlashcard = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      userId: null == userId
          ? _value.userId
          : userId // ignore: cast_nullable_to_non_nullable
              as String,
      showReverseFlashcards: null == showReverseFlashcards
          ? _value.showReverseFlashcards
          : showReverseFlashcards // ignore: cast_nullable_to_non_nullable
              as bool,
      showAntonymsInFlashcard: null == showAntonymsInFlashcard
          ? _value.showAntonymsInFlashcard
          : showAntonymsInFlashcard // ignore: cast_nullable_to_non_nullable
              as FlashcardFieldDisplay,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SettingsModelImplCopyWith<$Res>
    implements $SettingsModelCopyWith<$Res> {
  factory _$$SettingsModelImplCopyWith(
          _$SettingsModelImpl value, $Res Function(_$SettingsModelImpl) then) =
      __$$SettingsModelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String userId,
      bool showReverseFlashcards,
      FlashcardFieldDisplay showAntonymsInFlashcard});
}

/// @nodoc
class __$$SettingsModelImplCopyWithImpl<$Res>
    extends _$SettingsModelCopyWithImpl<$Res, _$SettingsModelImpl>
    implements _$$SettingsModelImplCopyWith<$Res> {
  __$$SettingsModelImplCopyWithImpl(
      _$SettingsModelImpl _value, $Res Function(_$SettingsModelImpl) _then)
      : super(_value, _then);

  /// Create a copy of SettingsModel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? userId = null,
    Object? showReverseFlashcards = null,
    Object? showAntonymsInFlashcard = null,
  }) {
    return _then(_$SettingsModelImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      userId: null == userId
          ? _value.userId
          : userId // ignore: cast_nullable_to_non_nullable
              as String,
      showReverseFlashcards: null == showReverseFlashcards
          ? _value.showReverseFlashcards
          : showReverseFlashcards // ignore: cast_nullable_to_non_nullable
              as bool,
      showAntonymsInFlashcard: null == showAntonymsInFlashcard
          ? _value.showAntonymsInFlashcard
          : showAntonymsInFlashcard // ignore: cast_nullable_to_non_nullable
              as FlashcardFieldDisplay,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SettingsModelImpl extends _SettingsModel with DiagnosticableTreeMixin {
  const _$SettingsModelImpl(
      {required this.id,
      required this.userId,
      this.showReverseFlashcards = false,
      this.showAntonymsInFlashcard = FlashcardFieldDisplay.hidden})
      : super._();

  factory _$SettingsModelImpl.fromJson(Map<String, dynamic> json) =>
      _$$SettingsModelImplFromJson(json);

  @override
  final String id;
  @override
  final String userId;
  @override
  @JsonKey()
  final bool showReverseFlashcards;
  @override
  @JsonKey()
  final FlashcardFieldDisplay showAntonymsInFlashcard;

  @override
  String toString({DiagnosticLevel minLevel = DiagnosticLevel.info}) {
    return 'SettingsModel(id: $id, userId: $userId, showReverseFlashcards: $showReverseFlashcards, showAntonymsInFlashcard: $showAntonymsInFlashcard)';
  }

  @override
  void debugFillProperties(DiagnosticPropertiesBuilder properties) {
    super.debugFillProperties(properties);
    properties
      ..add(DiagnosticsProperty('type', 'SettingsModel'))
      ..add(DiagnosticsProperty('id', id))
      ..add(DiagnosticsProperty('userId', userId))
      ..add(DiagnosticsProperty('showReverseFlashcards', showReverseFlashcards))
      ..add(DiagnosticsProperty(
          'showAntonymsInFlashcard', showAntonymsInFlashcard));
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SettingsModelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.userId, userId) || other.userId == userId) &&
            (identical(other.showReverseFlashcards, showReverseFlashcards) ||
                other.showReverseFlashcards == showReverseFlashcards) &&
            (identical(
                    other.showAntonymsInFlashcard, showAntonymsInFlashcard) ||
                other.showAntonymsInFlashcard == showAntonymsInFlashcard));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, userId, showReverseFlashcards, showAntonymsInFlashcard);

  /// Create a copy of SettingsModel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SettingsModelImplCopyWith<_$SettingsModelImpl> get copyWith =>
      __$$SettingsModelImplCopyWithImpl<_$SettingsModelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SettingsModelImplToJson(
      this,
    );
  }
}

abstract class _SettingsModel extends SettingsModel {
  const factory _SettingsModel(
          {required final String id,
          required final String userId,
          final bool showReverseFlashcards,
          final FlashcardFieldDisplay showAntonymsInFlashcard}) =
      _$SettingsModelImpl;
  const _SettingsModel._() : super._();

  factory _SettingsModel.fromJson(Map<String, dynamic> json) =
      _$SettingsModelImpl.fromJson;

  @override
  String get id;
  @override
  String get userId;
  @override
  bool get showReverseFlashcards;
  @override
  FlashcardFieldDisplay get showAntonymsInFlashcard;

  /// Create a copy of SettingsModel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SettingsModelImplCopyWith<_$SettingsModelImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

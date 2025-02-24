// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_state_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$themeModeHash() => r'56ef34e1501cb300729a2fad7570c945c78b65b4';

/// See also [themeMode].
@ProviderFor(themeMode)
final themeModeProvider = Provider<ThemeMode>.internal(
  themeMode,
  name: r'themeModeProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$themeModeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ThemeModeRef = ProviderRef<ThemeMode>;
String _$localeHash() => r'ac64b506aad1435b21d31d5f81767e878c53c5d4';

/// See also [locale].
@ProviderFor(locale)
final localeProvider = Provider<Locale>.internal(
  locale,
  name: r'localeProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$localeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef LocaleRef = ProviderRef<Locale>;
String _$userIdHash() => r'c36f92a4682babfcf78a13caac29baac4919a685';

/// See also [userId].
@ProviderFor(userId)
final userIdProvider = Provider<String>.internal(
  userId,
  name: r'userIdProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$userIdHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef UserIdRef = ProviderRef<String>;
String _$appSettingsHash() => r'2c0c7af385a9f3676f15ea21e75b3c703cdbe477';

/// See also [AppSettings].
@ProviderFor(AppSettings)
final appSettingsProvider =
    AsyncNotifierProvider<AppSettings, AppState>.internal(
  AppSettings.new,
  name: r'appSettingsProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$appSettingsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$AppSettings = AsyncNotifier<AppState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package

import 'package:bahar/common/view_models/app_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nanoid2/nanoid2.dart';
import 'dart:developer' as developer;

part 'app_state_provider.g.dart';

@Riverpod(keepAlive: true)
class AppSettings extends _$AppSettings {
  static const String _userIdKey = 'user_id';
  static const String _themeModeKey = 'theme_mode';
  static const String _localeKey = 'locale';

  @override
  Future<AppState> build() async {
    final prefs = await SharedPreferences.getInstance();

    final savedThemeModeValue = prefs.getInt(_themeModeKey);
    final savedLocaleValue = prefs.getString(_localeKey);

    final savedThemeMode = savedThemeModeValue != null
        ? ThemeMode.values[savedThemeModeValue]
        : ThemeMode.system;

    final savedLocale = savedLocaleValue != null
        ? Locale(savedLocaleValue)
        : const Locale('en');

    String? userId = prefs.getString(_userIdKey);

    return AppState(
      themeMode: savedThemeMode,
      locale: savedLocale,
      userId: userId ?? "",
    );
  }

  Future<void> createUserId() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = nanoid(); // 21 chars by default

    await prefs.setString(_userIdKey, userId);

    state = AsyncData(
      state.value!.copyWith(userId: userId),
    );
  }

  Future<void> clearUserId() async {
    final prefs = await SharedPreferences.getInstance();

    developer.log(
      "Clearing user id from shared preferences: $userId",
      name: 'app.provider.settings',
    );

    await prefs.remove(_userIdKey);

    state = AsyncData(
      state.value!.copyWith(userId: ""),
    );
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setInt(_themeModeKey, mode.index);

    state = AsyncData(
      state.value!.copyWith(themeMode: mode),
    );
  }

  Future<void> setLocale(Locale locale) async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString(_localeKey, locale.languageCode);

    state = AsyncData(
      state.value!.copyWith(locale: locale),
    );
  }
}

@Riverpod(keepAlive: true)
ThemeMode themeMode(Ref ref) {
  final appSettings = ref.watch(appSettingsProvider);

  return appSettings.when(
    data: (state) => state.themeMode,
    loading: () => ThemeMode.system,
    error: (_, __) => ThemeMode.system,
  );
}

@Riverpod(keepAlive: true)
Locale locale(Ref ref) {
  final appSettings = ref.watch(appSettingsProvider);

  return appSettings.when(
    data: (state) => state.locale,
    loading: () => const Locale('en'),
    error: (_, __) => const Locale('en'),
  );
}

@Riverpod(keepAlive: true)
String userId(Ref ref) {
  final appSettings = ref.watch(appSettingsProvider);

  return appSettings.when(
    data: (state) => state.userId,
    loading: () => "",
    error: (_, __) => "",
  );
}

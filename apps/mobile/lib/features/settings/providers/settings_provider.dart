import 'package:bahar/common/providers/app_state_provider.dart';
import 'package:bahar/common/providers/database_provider.dart';
import 'package:bahar/features/settings/models/settings_model.dart';
import 'package:bahar/features/settings/repositories/settings_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:nanoid2/nanoid2.dart';
import 'dart:developer' as developer;

part 'settings_provider.g.dart';

@riverpod
SettingsRepository settingsRepository(Ref ref) {
  final databaseService = ref.watch(databaseServiceProvider);

  return SettingsRepository(databaseService: databaseService);
}

@riverpod
class Settings extends _$Settings {
  @override
  Future<SettingsModel?> build() async {
    final repository = ref.watch(settingsRepositoryProvider);
    final userId = ref.watch(
      appSettingsProvider.select(
        (state) => state.whenData((appState) => appState.userId).value ?? '',
      ),
    );

    SettingsModel? existingSettings = await repository.get(userId);

    if (existingSettings == null) {
      final defaultSettings = SettingsModel(
        id: nanoid(),
        userId: userId,
      );

      await repository.insert(defaultSettings);

      return defaultSettings;
    }

    return existingSettings;
  }

  Future<void> updateSettings(SettingsModel settings) async {
    final repository = ref.watch(settingsRepositoryProvider);

    developer.log(
      "Updating settings: $settings",
      name: 'app.provider.settings',
    );

    await repository.update(settings);

    developer.log(
      "Successfully updated settings: $settings",
      name: 'app.provider.settings',
    );

    ref.invalidateSelf(); // Refresh the state
  }

  Future<void> clearAllUserSettings() async {
    final repository = ref.watch(settingsRepositoryProvider);
    final userId = ref.watch(userIdProvider);

    developer.log(
      "Clearing all settings for user: $userId",
      name: 'app.provider.settings',
    );

    // Delete settings from database
    await repository.delete(userId);

    // Clear user ID from shared preferences
    await ref.read(appSettingsProvider.notifier).clearUserId();

    ref.invalidateSelf(); // Refresh the state
  }

  Future<void> logAllSettings() async {
    final repository = ref.watch(settingsRepositoryProvider);

    developer.log(
      "Getting all settings data",
      name: 'app.provider.settings',
    );

    final allSettings = await repository.getAll();

    developer.log(
      "All settings data (${allSettings.length} records):\n${allSettings.map((s) => s.toString()).join('\n')}",
      name: 'app.provider.settings',
    );
  }

  Future<void> deleteAllSettings() async {
    final repository = ref.watch(settingsRepositoryProvider);

    developer.log(
      "Deleting all settings data for all users",
      name: 'app.provider.settings',
    );

    await repository.deleteAll();

    await ref.read(appSettingsProvider.notifier).clearUserId();

    ref.invalidateSelf();
  }
}

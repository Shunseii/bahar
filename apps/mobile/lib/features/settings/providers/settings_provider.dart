import 'package:bahar/common/providers/app_state_provider.dart';
import 'package:bahar/common/providers/database_provider.dart';
import 'package:bahar/features/settings/models/settings_model.dart';
import 'package:bahar/features/settings/repositories/settings_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:nanoid2/nanoid2.dart';

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
    await repository.update(settings);

    ref.invalidateSelf(); // Refresh the state
  }
}

import 'package:bahar/features/settings/models/settings_model.dart';
import 'package:bahar/common/services/database_service.dart';

// TODO: figure out how to access this through view model

class SettingsRepository {
  final databaseService = DatabaseService.instance;

  Future<void> insert(SettingsModel settingsModel) async {
    final db = await databaseService.database;
    final input = settingsModel.toMap();

    await db.insert('settings', input);
  }

  Future<void> update(SettingsModel settingsModel) async {
    final db = await databaseService.database;
    final input = settingsModel.toMap();

    await db.update(
      'settings',
      input,
      where: 'user_id = ?',
      whereArgs: [settingsModel.userId],
    );
  }

  Future<SettingsModel?> get(String userId) async {
    final db = await databaseService.database;

    final results = await db.query(
      'settings',
      where: 'user_id = ?',
      whereArgs: [userId],
    );

    if (results.isEmpty) return null;

    return SettingsModel.fromMap(results.first);
  }
}

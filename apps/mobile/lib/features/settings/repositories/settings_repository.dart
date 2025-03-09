import 'package:bahar/features/settings/models/settings_model.dart';
import 'package:bahar/common/services/database_service.dart';
import 'dart:developer' as developer;

class SettingsRepository {
  final DatabaseService databaseService;

  SettingsRepository({required this.databaseService});

  Future<void> insert(SettingsModel settingsModel) async {
    final db = await databaseService.database;
    final input = settingsModel.toMap();

    developer.log(
      "Inserting settings: $input",
      name: 'app.repository.settings',
    );

    await db.insert('settings', input);
  }

  Future<void> update(SettingsModel settingsModel) async {
    final db = await databaseService.database;
    final input = settingsModel.toMap();

    developer.log(
      "Updating settings: $input",
      name: 'app.repository.settings',
    );

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

    developer.log(
      "Getting settings: $results",
      name: 'app.repository.settings',
    );

    if (results.isEmpty) return null;

    return SettingsModel.fromMap(results.first);
  }
  
  Future<void> delete(String userId) async {
    final db = await databaseService.database;
    
    developer.log(
      "Deleting settings for user: $userId",
      name: 'app.repository.settings',
    );
    
    await db.delete(
      'settings',
      where: 'user_id = ?',
      whereArgs: [userId],
    );
  }
}

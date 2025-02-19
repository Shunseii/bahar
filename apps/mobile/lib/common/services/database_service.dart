import 'package:bahar/features/settings/models/settings_model.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class DatabaseService {
  static final DatabaseService instance = DatabaseService._privateConstructor();
  static Database? _database;

  DatabaseService._privateConstructor();

  Future<Database> get database async {
    if (_database != null) return _database!;

    _database = await _initializeDatabase();
    return _database!;
  }

  Future<void> initialize() async {
    if (_database != null) return;

    await _initializeDatabase();
  }

  Future<Database> _initializeDatabase() async {
    // Set the path to the database. Note: Using the `join` function from the
    // `path` package is best practice to ensure the path is correctly
    // constructed for each platform.
    String path = join(await getDatabasesPath(), 'bahar_database.db');

    Database database = await openDatabase(
      path,
      onCreate: _onCreate,

      // Set the version. This executes the onCreate function and provides a
      // path to perform database upgrades and downgrades.
      version: 1,
    );

    return database;
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute(
      SettingsModel.initDatabaseModelStatement(),
    );
  }
}

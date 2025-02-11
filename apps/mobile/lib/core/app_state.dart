import 'package:flutter/material.dart';

class AppState extends ChangeNotifier {
  int _themeMode = 2;

  int get themeMode => _themeMode;

  void setThemeMode(int mode) {
    _themeMode = mode;
    notifyListeners();
  }

  ThemeMode get activeThemeMode {
    switch (_themeMode) {
      case 0:
        return ThemeMode.light;
      case 1:
        return ThemeMode.dark;
      case 2:
      default:
        return ThemeMode.system;
    }
  }
}

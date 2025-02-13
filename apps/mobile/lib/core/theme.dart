import 'package:flutter/material.dart';

class AppTheme {
  static final lightColorScheme = ColorScheme.light(
    background: Color.fromRGBO(249, 251, 253, 1.0),
    surface: Color.fromRGBO(249, 251, 253, 1.0),
    surfaceContainer: Color.fromRGBO(255, 255, 255, 1.0),
    outline: Color.fromRGBO(226, 232, 240, 1.0),
    primary: Color.fromRGBO(37, 99, 235, 1.0),
  );

  static final darkColorScheme = ColorScheme.dark(
    background: Color.fromRGBO(12, 21, 39, 1.0),
    surface: Color.fromRGBO(12, 21, 39, 1.0),
    surfaceContainer: Color.fromRGBO(2, 9, 22, 1.0),
    outline: Color.fromRGBO(30, 41, 59, 1.0),
    primary: Color.fromRGBO(59, 130, 246, 1.0),
  );

  static ThemeData baseTheme() {
    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Inter',
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  // Create ThemeData
  static ThemeData lightTheme() {
    return baseTheme().copyWith(
      colorScheme: lightColorScheme,
      brightness: Brightness.light,
      cardTheme: baseTheme().cardTheme.copyWith(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                width: 1,
                color: lightColorScheme.outline,
              ),
            ),
          ),
      inputDecorationTheme: baseTheme().inputDecorationTheme.copyWith(
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: lightColorScheme.outline,
              ),
            ),
          ),
      textTheme: baseTheme().textTheme.copyWith(
            bodyLarge: TextStyle(color: Colors.black),
            bodyMedium: TextStyle(color: Colors.black),
            bodySmall: TextStyle(color: Colors.black),
            titleLarge: TextStyle(color: Colors.black),
            titleMedium: TextStyle(color: Colors.black),
            titleSmall: TextStyle(color: Colors.black),
            headlineLarge: TextStyle(color: Colors.black),
            headlineMedium: TextStyle(color: Colors.black),
            headlineSmall: TextStyle(color: Colors.black),
            labelLarge: TextStyle(color: Colors.black),
            labelMedium: TextStyle(color: Colors.black),
            labelSmall: TextStyle(
              color: Color.fromRGBO(100, 116, 139, 1.0),
            ),
          ),
    );
  }

  static ThemeData darkTheme() {
    return baseTheme().copyWith(
      colorScheme: darkColorScheme,
      brightness: Brightness.dark,
      cardTheme: baseTheme().cardTheme.copyWith(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                width: 1,
                color: darkColorScheme.outline,
              ),
            ),
          ),
      inputDecorationTheme: baseTheme().inputDecorationTheme.copyWith(
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: darkColorScheme.outline,
              ),
            ),
          ),
      textTheme: baseTheme().textTheme.copyWith(
            bodyLarge: TextStyle(color: Colors.white),
            bodyMedium: TextStyle(color: Colors.white),
            bodySmall: TextStyle(color: Colors.white),
            titleLarge: TextStyle(color: Colors.white),
            titleMedium: TextStyle(color: Colors.white),
            titleSmall: TextStyle(color: Colors.white),
            headlineLarge: TextStyle(color: Colors.white),
            headlineMedium: TextStyle(color: Colors.white),
            headlineSmall: TextStyle(color: Colors.white),
            labelLarge: TextStyle(color: Colors.white),
            labelMedium: TextStyle(color: Colors.white),
            labelSmall: TextStyle(
              color: Color.fromRGBO(148, 163, 184, 1.0),
            ),
          ),
    );
  }
}

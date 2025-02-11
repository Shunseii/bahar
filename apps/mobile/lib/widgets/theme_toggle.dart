import 'package:bahar/core/app_state.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ThemeSettingsWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    var appState = context.watch<AppState>();

    return DropdownButton<int>(
      value: appState.themeMode,
      items: const [
        DropdownMenuItem(value: 0, child: Text('Light')),
        DropdownMenuItem(value: 1, child: Text('Dark')),
        DropdownMenuItem(value: 2, child: Text('System')),
      ],
      onChanged: (int? newValue) {
        if (newValue != null) {
          appState.setThemeMode(newValue);
        }
      },
    );
  }
}

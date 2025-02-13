import 'package:bahar/widgets/settings_card.dart';
import 'package:bahar/widgets/theme_toggle.dart';
import 'package:flutter/material.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            "Settings",
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          SizedBox(height: 24),
          SettingsCard(
            title: "Appearance",
            subtitle: "Customize how the application looks for you.",
            children: [
              ThemeToggle(),
            ],
          ),
        ],
      ),
    );
  }
}

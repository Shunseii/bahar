import 'package:bahar/common/providers/app_state_provider.dart';
import 'package:bahar/common/widgets/primary_button.dart';
import 'package:bahar/features/settings/providers/settings_provider.dart';
import 'package:bahar/features/settings/widgets/settings_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SettingsDebugCard extends ConsumerWidget {
  const SettingsDebugCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userId = ref.watch(userIdProvider);

    return SettingsCard(
      title: "Debug Options",
      subtitle: "Tools for testing and debugging",
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("User ID: $userId"),
            const SizedBox(height: 16),
            PrimaryButton(
              label: "Clear user id from shared preferences",
              onPressed: () async {
                await ref.read(appSettingsProvider.notifier).clearUserId();

                if (context.mounted) {
                  context.go('/onboarding');
                }
              },
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: "Clear all user settings",
              onPressed: () async {
                await ref
                    .read(settingsProvider.notifier)
                    .clearAllUserSettings();
              },
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: "Log all settings data",
              onPressed: () async {
                await ref.read(settingsProvider.notifier).logAllSettings();
              },
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: "Delete all settings data",
              onPressed: () async {
                await ref.read(settingsProvider.notifier).deleteAllSettings();

                if (context.mounted) {
                  context.go('/onboarding');
                }
              },
            ),
          ],
        ),
      ],
    );
  }
}

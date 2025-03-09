import 'package:bahar/common/providers/app_state_provider.dart';
import 'package:bahar/common/widgets/primary_button.dart';
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
              label: "Reset Onboarding (Clear User ID)",
              onPressed: () async {
                // Clear the user ID
                await ref.read(appSettingsProvider.notifier).clearUserId();
                
                // Navigate to onboarding
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
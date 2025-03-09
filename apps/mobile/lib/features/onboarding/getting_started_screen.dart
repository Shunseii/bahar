import 'package:bahar/common/providers/app_state_provider.dart';
import 'package:bahar/common/widgets/primary_button.dart';
import 'package:bahar/features/onboarding/widgets/compact_theme_toggle.dart';
import 'package:bahar/features/onboarding/widgets/compact_locale_toggle.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

class GettingStartedPage extends ConsumerWidget {
  const GettingStartedPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context)!;
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      // Add AppBar to control system overlay style
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        toolbarHeight: 0,
        systemOverlayStyle: theme.brightness == Brightness.dark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 16,
              right: isRtl ? 16 : null,
              left: isRtl ? null : 16,
              child: CompactThemeToggle(),
            ),

            Positioned(
              top: 16,
              right: isRtl ? null : 16,
              left: isRtl ? 16 : null,
              child: CompactLocaleToggle(),
            ),

            // Main content
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(),
                  Center(
                    child: SvgPicture.asset(
                      'assets/logo.svg',
                      width: 120,
                      height: 120,
                      placeholderBuilder: (context) {
                        return Container(
                          width: 120,
                          height: 120,
                          color: theme.colorScheme.primaryContainer,
                          child: Center(
                            child: Text(
                              l10n.appName,
                              style: theme.textTheme.displaySmall?.copyWith(
                                color: theme.colorScheme.onPrimaryContainer,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 32),
                  Text(
                    l10n.welcomeToBahar,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    l10n.appDescription,
                    style: theme.textTheme.bodyLarge,
                  ),
                  const Spacer(),
                  PrimaryButton(
                    label: l10n.getStarted,
                    onPressed: () async {
                      // Create a user ID
                      await ref
                          .read(appSettingsProvider.notifier)
                          .createUserId();

                      // Navigate to home
                      if (context.mounted) {
                        context.go('/home');
                      }
                    },
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

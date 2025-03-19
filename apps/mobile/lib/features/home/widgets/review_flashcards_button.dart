import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:bahar/common/widgets/secondary_button.dart';

class ReviewFlashcardsButton extends StatefulWidget {
  const ReviewFlashcardsButton({
    super.key,
    required this.l10n,
  });

  final AppLocalizations l10n;

  @override
  State<ReviewFlashcardsButton> createState() => _ReviewFlashcardsButtonState();
}

class _ReviewFlashcardsButtonState extends State<ReviewFlashcardsButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<Color?> _colorAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    _colorAnimation = ColorTween(
      begin: Colors.red.shade900,
      end: Colors.red.shade500,
    ).animate(_animationController);
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // TODO: Replace with real data
    const hasFlashcards = true;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        SecondaryButton(
          label: widget.l10n.reviewFlashcards,
          onPressed: () {
            // TODO: Show flashcards drawer
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(widget.l10n.reviewFlashcards),
              ),
            );
          },
        ),
        if (hasFlashcards)
          Positioned(
            right: -1,
            child: _buildNotificationDot(context),
          ),
      ],
    );
  }

  Widget _buildNotificationDot(BuildContext context) {
    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        return Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: _colorAnimation.value,
            borderRadius: BorderRadius.circular(10.0),
            border: Border.all(
              color: Theme.of(context).colorScheme.surface,
              width: 2.0,
            ),
          ),
        );
      },
    );
  }
}

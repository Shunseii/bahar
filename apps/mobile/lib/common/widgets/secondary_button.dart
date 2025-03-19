import 'package:flutter/material.dart';

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget? icon;

  @override
  Widget build(BuildContext context) {
    final textColor = Theme.of(context).textTheme.bodyMedium?.color;

    final buttonStyle = OutlinedButton.styleFrom(
      foregroundColor: textColor,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainer,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12.0),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: 16.0,
        vertical: 8.0,
      ),
    );

    if (icon != null) {
      return OutlinedButton.icon(
        icon: icon!,
        label: Text(label),
        onPressed: onPressed,
        style: buttonStyle,
      );
    }

    return OutlinedButton(
      onPressed: onPressed,
      style: buttonStyle,
      child: Text(label),
    );
  }
}

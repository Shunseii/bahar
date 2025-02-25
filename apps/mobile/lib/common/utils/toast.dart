import 'package:flutter/material.dart';
import 'package:toastification/toastification.dart';

void showToast({
  required BuildContext context,
  required ToastificationType type,
  required String title,
  String? description,
  Duration duration = const Duration(seconds: 4),
}) {
  final theme = Theme.of(context);

  toastification.show(
    style: ToastificationStyle.flat,
    type: type,
    title: Text(title),
    description: description != null ? Text(description) : null,
    autoCloseDuration: duration,
    borderRadius: BorderRadius.circular(12),
    backgroundColor: theme.colorScheme.surfaceContainer,
    foregroundColor: theme.colorScheme.onSurface,
    borderSide: BorderSide(
      color: theme.colorScheme.outline,
    ),
    showProgressBar: true,
    dragToClose: true,
  );
}

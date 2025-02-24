import 'package:flutter/material.dart';

class CompactRadioListTile<T> extends StatelessWidget {
  final String titleLabel;
  final T value;
  final T? groupValue;
  final ValueChanged<T?>? onChanged;

  const CompactRadioListTile({
    super.key,
    required this.titleLabel,
    required this.value,
    required this.groupValue,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return RadioListTile<T>(
      title: Text(
        titleLabel,
        style: Theme.of(context).textTheme.bodySmall,
      ),
      visualDensity: const VisualDensity(
        horizontal: VisualDensity.minimumDensity,
        vertical: VisualDensity.minimumDensity,
      ),
      contentPadding: const EdgeInsets.all(0),
      value: value,
      groupValue: groupValue,
      onChanged: onChanged,
    );
  }
}

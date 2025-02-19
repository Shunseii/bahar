import 'package:flutter/material.dart';

class LocalizedIcon extends StatelessWidget {
  const LocalizedIcon({
    super.key,
    required this.icon,
  });

  final Icon icon;

  @override
  Widget build(BuildContext context) {
    final bool isRtl = Directionality.of(context) == TextDirection.rtl;

    return Transform.flip(
      flipX: isRtl,
      child: icon,
    );
  }
}

import 'package:bahar/widgets/theme_toggle.dart';
import 'package:flutter/material.dart';

class HomePage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    var text = "Hello, world!";

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(text),
          SizedBox(height: 10),
          ThemeSettingsWidget(),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ElevatedButton(
                onPressed: () {
                  print("Next!");
                },
                child: Text('Next'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

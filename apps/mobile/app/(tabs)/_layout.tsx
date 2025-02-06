import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer backBehavior="history">
        <Drawer.Screen
          name="index"
          options={{
            swipeEdgeWidth: 300,
            title: "Home",
          }}
        />
        <Drawer.Screen
          name="explore"
          options={{
            title: "Explore",
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        backBehavior="history"
        screenOptions={{
          headerBackgroundContainerStyle: { backgroundColor: "#fff" },
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            swipeEdgeWidth: 300,
            // header: () => undefined,
            title: "Login",
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

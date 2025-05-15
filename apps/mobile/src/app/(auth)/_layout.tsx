import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        backBehavior="history"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            swipeEdgeWidth: 300,
            title: "Login",
          }}
        />
        <Drawer.Screen
          name="code/[email]"
          options={{
            title: "Code",
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

import React from "react";
import { Drawer } from "expo-router/drawer";

export default function Layout() {
  return (
    <Drawer
      backBehavior="history"
      screenOptions={{
        headerShown: true,
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          swipeEdgeWidth: 300,
          title: "Home",
        }}
      />
    </Drawer>
  );
}

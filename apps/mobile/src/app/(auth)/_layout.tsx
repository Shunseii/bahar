import { Stack } from "expo-router";

export const unstable_settings = {
  initialRouteName: "welcome",
};

const Layout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="code/[email]" />
    </Stack>
  );
};

export default Layout;

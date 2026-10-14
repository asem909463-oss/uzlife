import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppProvider } from "@/src/app-context";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { colors } = useTheme();
  const [loaded, error] = useFonts({
    "Manrope-Regular": require("../assets/fonts/Manrope-Regular.ttf"),
    "Manrope-Medium": require("../assets/fonts/Manrope-Medium.ttf"),
    "Manrope-SemiBold": require("../assets/fonts/Manrope-SemiBold.ttf"),
    "Manrope-Bold": require("../assets/fonts/Manrope-Bold.ttf"),
    "Manrope-ExtraBold": require("../assets/fonts/Manrope-ExtraBold.ttf"),
    "Playfair-Regular": require("../assets/fonts/Playfair-Regular.ttf"),
    "Playfair-SemiBold": require("../assets/fonts/Playfair-SemiBold.ttf"),
    "Playfair-Bold": require("../assets/fonts/Playfair-Bold.ttf"),
    "Playfair-Italic": require("../assets/fonts/Playfair-Italic.ttf"),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app.
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <AppProvider>
              <ToastProvider>
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "slide_from_right" }}>
                  <Stack.Screen name="flash" options={{ animation: "slide_from_bottom" }} />
                  <Stack.Screen name="life-new" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                  <Stack.Screen name="market/new" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                </Stack>
              </ToastProvider>
            </AppProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

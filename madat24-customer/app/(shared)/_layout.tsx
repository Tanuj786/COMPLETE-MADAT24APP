import { Stack } from "expo-router";
import { COLORS } from "~/constants";
export default function SharedLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg }, animation: "slide_from_bottom" }} />;
}

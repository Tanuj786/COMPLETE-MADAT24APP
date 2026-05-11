import React from "react";
import { Tabs, router } from "expo-router";
import { View, Text, Pressable } from "react-native";
import Icon from "~/lib/icons/Icon";
import { COLORS, FONTS } from "~/constants";
import { useNotifStore, useMechanicStore } from "~/stores";

export default function MechanicLayout() {
  const { unreadCount } = useNotifStore();
  const { requests, activeJobs } = useMechanicStore();

  const TAB_BAR_STYLE = {
    backgroundColor: "#080818",
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 10,
    paddingTop: 6,
  };

  return (
    <Tabs screenOptions={{
      tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: COLORS.blue,
      tabBarInactiveTintColor: COLORS.text3,
      tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 10, marginTop: 2 },
      headerStyle: { backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border, elevation: 0, shadowOpacity: 0 },
      headerTintColor: COLORS.text1,
      headerTitleStyle: { fontFamily: FONTS.bold, fontSize: 18 },
      headerRight: () => (
        <Pressable onPress={() => router.push("/(shared)/notifications")} style={{ marginRight: 16 }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {unreadCount > 0 && (
              <View style={{ position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.red, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.bg }}>
                <Text style={{ color: "white", fontSize: 8, fontFamily: FONTS.bold }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </View>
        </Pressable>
      ),
    }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color }) => <Icon name="LayoutDashboard" size={22} color={color} /> }} />
      <Tabs.Screen name="requests"  options={{ title: "Requests",
        tabBarBadge: requests.length > 0 ? requests.length : undefined,
        tabBarBadgeStyle: { backgroundColor: COLORS.amber, color: "#000", fontSize: 10, fontFamily: FONTS.bold },
        tabBarIcon: ({ color }) => <Icon name="Inbox" size={22} color={color} /> }} />
      <Tabs.Screen name="jobs"      options={{ title: "Active Jobs",
        tabBarBadge: activeJobs.length > 0 ? activeJobs.length : undefined,
        tabBarBadgeStyle: { backgroundColor: COLORS.blue, color: "#000", fontSize: 10, fontFamily: FONTS.bold },
        tabBarIcon: ({ color }) => <Icon name="Briefcase" size={22} color={color} /> }} />
      <Tabs.Screen name="chat"     options={{ title: "Chat", tabBarIcon: ({ color }) => <Icon name="MessageSquare" size={22} color={color} /> }} />
      <Tabs.Screen name="reviews"   options={{ title: "Reviews", tabBarIcon: ({ color }) => <Icon name="Star" size={22} color={color} /> }} />
      <Tabs.Screen name="profile"   options={{ title: "Profile", tabBarIcon: ({ color }) => <Icon name="User" size={22} color={color} /> }} />
    </Tabs>
  );
}

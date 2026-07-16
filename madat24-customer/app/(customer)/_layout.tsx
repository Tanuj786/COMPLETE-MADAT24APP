import React from "react";
import { Tabs, useFocusEffect } from "expo-router";
import Icon from "~/lib/icons/Icon";
import { COLORS, FONTS } from "~/constants";
import { useCustomerStore, useNotifStore } from "~/stores";
import { apiGetMyJobs } from "~/lib/api";

export default function CustomerLayout() {
  const { unreadCount } = useNotifStore();
  const { syncJobsFromBackend } = useCustomerStore();

  const refreshCustomerJobs = React.useCallback(() => {
    apiGetMyJobs()
      .then(({ jobs }) => syncJobsFromBackend(jobs))
      .catch(() => {});
  }, [syncJobsFromBackend]);

  React.useEffect(() => {
    refreshCustomerJobs();
  }, [refreshCustomerJobs]);

  useFocusEffect(
    React.useCallback(() => {
      refreshCustomerJobs();
    }, [refreshCustomerJobs]),
  );

  return (
    <Tabs screenOptions={{
      tabBarStyle: {
        backgroundColor: "#080818",
        borderTopColor: COLORS.border,
        borderTopWidth: 1,
        height: 68,
        paddingBottom: 10,
        paddingTop: 6,
      },
      tabBarActiveTintColor: COLORS.orange,
      tabBarInactiveTintColor: COLORS.text3,
      tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 10, marginTop: 2 },
      headerStyle: { backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border, elevation: 0, shadowOpacity: 0 },
      headerTintColor: COLORS.text1,
      headerTitleStyle: { fontFamily: FONTS.bold, fontSize: 18 },
      headerShown: false,
    }}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color }) => <Icon name="Home" size={22} color={color} /> }} />
      <Tabs.Screen name="request"   options={{ title: "Request", tabBarIcon: ({ color }) => <Icon name="PlusCircle" size={22} color={color} /> }} />
      <Tabs.Screen name="history"  options={{ title: "History", tabBarIcon: ({ color }) => <Icon name="ClipboardList" size={22} color={color} /> }} />
      <Tabs.Screen name="invoices" options={{ title: "Invoices", tabBarIcon: ({ color }) => <Icon name="FileText" size={22} color={color} /> }} />
      <Tabs.Screen name="profile"  options={{ title: "Profile",  tabBarIcon: ({ color }) => <Icon name="User" size={22} color={color} /> }} />
    </Tabs>
  );
}

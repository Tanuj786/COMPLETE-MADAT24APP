import React, { useRef, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Animated, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import Icon from "~/lib/icons/Icon";
import { Card, Badge } from "~/components/ui";
import { COLORS, FONTS, STATUS_CFG } from "~/constants";
import { useCustomerStore } from "~/stores";
import { apiGetMyJobs } from "~/lib/api";

export default function History() {
  const { jobs, syncJobsFromBackend } = useCustomerStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      apiGetMyJobs()
        .then(({ jobs }) => syncJobsFromBackend(jobs))
        .catch(() => {});
    }, [syncJobsFromBackend]),
  );

  const sorted = [...jobs].sort((a, b) =>
    new Date(b.timestamps.requested).getTime() - new Date(a.timestamps.requested).getTime()
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <LinearGradient colors={["#0C0C20", COLORS.bg]} style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <Text style={{ color: COLORS.text1, fontFamily: FONTS.black, fontSize: 26 }}>Service History</Text>
        <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 }}>
          {jobs.length} total jobs
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}>
        {sorted.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={{ fontSize: 60, marginBottom: 16 }}>📋</Text>
            <Text style={{ color: COLORS.text2, fontFamily: FONTS.bold, fontSize: 18 }}>No jobs yet</Text>
            <Pressable onPress={() => router.push("/(customer)/request")} style={{ marginTop: 16, backgroundColor: COLORS.orangeDim, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 }}>
              <Text style={{ color: COLORS.orange, fontFamily: FONTS.semibold }}>Request a Service</Text>
            </Pressable>
          </View>
        ) : sorted.map((job, idx) => {
          const cfg = STATUS_CFG[job.status];
          return (
            <Animated.View key={job.id} style={{ opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }] }}>
              <Pressable onPress={() => router.push({ pathname: "/(shared)/job-details", params: { id: job.id } })} style={{ marginBottom: 12 }}>
                <Card accent={cfg.color}>
                  <View style={{ padding: 18 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 16, textTransform: "capitalize", marginBottom: 3 }}>
                          {job.serviceType.replace(/-/g, " ")}
                        </Text>
                        <Text style={{ color: COLORS.text2, fontFamily: FONTS.regular, fontSize: 12 }}>
                          {job.location.address}, {job.location.city}
                        </Text>
                      </View>
                      <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
                    </View>

                    {job.mechanic && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.bg1, borderRadius: 12, padding: 10, marginBottom: 10 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.orangeDim, alignItems: "center", justifyContent: "center" }}>
                          <Icon name="User" size={16} color={COLORS.orange} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: COLORS.text1, fontFamily: FONTS.semibold, fontSize: 13 }}>{job.mechanic.name}</Text>
                          <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 11 }}>{job.mechanic.shopName}</Text>
                        </View>
                        {job.rating && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Text style={{ color: COLORS.amber, fontSize: 12 }}>⭐</Text>
                            <Text style={{ color: COLORS.amber, fontFamily: FONTS.bold, fontSize: 12 }}>{job.rating}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {job.rating && (
                      <View style={{ backgroundColor: COLORS.bg1, borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: COLORS.amber + "25" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: job.review ? 6 : 0 }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <Text key={i} style={{ fontSize: 12 }}>{i <= (job.rating || 0) ? "⭐" : "☆"}</Text>
                          ))}
                          <Text style={{ color: COLORS.amber, fontFamily: FONTS.bold, fontSize: 12, marginLeft: 4 }}>Your review</Text>
                        </View>
                        {!!job.review && (
                          <Text style={{ color: COLORS.text2, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 }}>{job.review}</Text>
                        )}
                        {!!job.reviewMedia?.length && (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                            <View style={{ flexDirection: "row", gap: 7 }}>
                              {job.reviewMedia.map(photo => (
                                <Image key={photo.id} source={{ uri: photo.uri }} style={{ width: 58, height: 58, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border }} />
                              ))}
                            </View>
                          </ScrollView>
                        )}
                      </View>
                    )}

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 11 }}>
                        {formatDistanceToNow(new Date(job.timestamps.requested), { addSuffix: true })}
                      </Text>
                      {job.invoice && (
                        <Text style={{ color: job.invoice.paymentStatus === "paid" ? COLORS.green : COLORS.orange, fontFamily: FONTS.bold, fontSize: 13 }}>
                          ₹{job.invoice.total.toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

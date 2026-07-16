import React from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { formatDistanceToNow } from "date-fns";
import { useFocusEffect } from "expo-router";
import Icon from "~/lib/icons/Icon";
import { useTheme } from "~/components/ui";
import { FONTS } from "~/constants";
import { useAuthStore, useMechanicStore } from "~/stores";
import { apiGetMechReviews } from "~/lib/api";

export default function Reviews() {
  const C = useTheme();
  const { user } = useAuthStore();
  const { reviews, metrics, syncReviewsFromBackend } = useMechanicStore();

  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id) return;
      let cancelled = false;
      apiGetMechReviews(user.id)
        .then(({ reviews }) => {
          if (!cancelled) syncReviewsFromBackend(reviews);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [user?.id, syncReviewsFromBackend]),
  );

  // Distribution from actual review data
  const dist = [5, 4, 3, 2, 1].map(r => ({
    stars: r,
    count: reviews.filter(rv => Math.round(rv.rating) === r).length,
  }));

  // Empty state
  if (reviews.length === 0) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: C.bg1, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Text style={{ fontSize: 42 }}>⭐</Text>
        </View>
        <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 20, marginBottom: 10, textAlign: "center" }}>No Reviews Yet</Text>
        <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
          Reviews appear here after customers rate your service. Complete jobs and ask customers to rate you!
        </Text>
        <View style={{ backgroundColor: C.primaryDim, borderRadius: 16, padding: 16, marginTop: 24, width: "100%", borderWidth: 1, borderColor: C.primary + "30" }}>
          <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 13, textAlign: "center" }}>
            💡 Tip: Customers can review after paying for completed service
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Rating overview */}
        <LinearGradient
          colors={[C.isDark ? "#1A1300" : "#FFF9E8", C.isDark ? "#080810" : C.bg]}
          style={{ margin: 16, borderRadius: 22, padding: 24, borderWidth: 1, borderColor: C.yellow + "30" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 28 }}>
            {/* Big score */}
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: C.yellow, fontFamily: FONTS.black, fontSize: 56, lineHeight: 62 }}>
                {metrics.averageRating.toFixed(1)}
              </Text>
              <View style={{ flexDirection: "row", gap: 3, marginBottom: 4 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Text key={i} style={{ fontSize: 14 }}>{i <= Math.round(metrics.averageRating) ? "⭐" : "☆"}</Text>
                ))}
              </View>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>{metrics.reviewCount} review{metrics.reviewCount !== 1 ? "s" : ""}</Text>
            </View>

            {/* Distribution bars */}
            <View style={{ flex: 1, gap: 7 }}>
              {dist.map(d => {
                const pct = metrics.reviewCount > 0 ? (d.count / metrics.reviewCount) * 100 : 0;
                return (
                  <View key={d.stars} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, width: 10 }}>{d.stars}</Text>
                    <Text style={{ fontSize: 10 }}>⭐</Text>
                    <View style={{ flex: 1, height: 6, backgroundColor: C.bg, borderRadius: 3 }}>
                      <View style={{ height: 6, backgroundColor: C.yellow, borderRadius: 3, width: `${pct}%` }} />
                    </View>
                    <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, width: 16, textAlign: "right" }}>{d.count}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </LinearGradient>

        {/* Review cards */}
        <View style={{ paddingHorizontal: 16 }}>
          {reviews.map(rv => (
            <View key={rv.id} style={{ marginBottom: 12, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.cardBorder, overflow: "hidden" }}>
              <View style={{ padding: 18 }}>
                {/* Reviewer + date */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15 }}>{rv.customerName}</Text>
                    <View style={{ flexDirection: "row", gap: 3, marginTop: 4 }}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <Text key={i} style={{ fontSize: 13 }}>{i <= rv.rating ? "⭐" : "☆"}</Text>
                      ))}
                    </View>
                  </View>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11 }}>
                    {formatDistanceToNow(new Date(rv.createdAt), { addSuffix: true })}
                  </Text>
                </View>

                {/* Tags */}
                {rv.tags && rv.tags.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {rv.tags.map(tag => (
                      <View key={tag} style={{ backgroundColor: C.primaryDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: C.primary + "30" }}>
                        <Text style={{ color: C.primary, fontFamily: FONTS.medium, fontSize: 11 }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Review text */}
                {rv.review ? (
                  <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, marginBottom: rv.mechanicResponse ? 12 : 0 }}>
                    "{rv.review}"
                  </Text>
                ) : null}

                {!!rv.photos?.length && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginBottom: rv.mechanicResponse ? 12 : 0 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {rv.photos.map(photo => (
                        <Image key={photo.id} source={{ uri: photo.uri }} style={{ width: 72, height: 72, borderRadius: 12, borderWidth: 1, borderColor: C.border }} />
                      ))}
                    </View>
                  </ScrollView>
                )}

                {/* Mechanic response */}
                {rv.mechanicResponse && (
                  <View style={{ backgroundColor: C.primaryDim, borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: C.primary }}>
                    <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 12, marginBottom: 4 }}>Your Response:</Text>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13 }}>{rv.mechanicResponse}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

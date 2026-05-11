/**
 * PhotoPicker — Real Camera + Gallery picker
 *
 * Shows an action sheet when user taps "Add Photo" with options:
 *   📷 Take Photo  — opens camera
 *   🖼️ Choose from Gallery — opens photo library
 *   ❌ Cancel
 *
 * Uses expo-image-picker (already in your app dependencies).
 * Uploads to Cloudinary via backend if jobId + token provided.
 * Falls back to local URI if backend not available.
 */

import React, { useState } from "react";
import {
  View, Text, Pressable, Image, ScrollView,
  Alert, Modal, ActionSheetIOS, Platform, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Icon from "~/lib/icons/Icon";
import { FONTS } from "~/constants";
import { useTheme } from "~/components/ui";
import { apiUploadMedia, getToken } from "~/lib/api";

// ── Action Sheet (iOS native; Android uses Alert directly in selectAndUploadPhoto) ──
async function showPickerOptions(): Promise<"camera" | "gallery" | null> {
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["📷 Take Photo", "🖼️ Choose from Gallery", "Cancel"],
        cancelButtonIndex: 2,
        title: "Add Photo",
      },
      (index) => {
        if (index === 0) resolve("camera");
        else if (index === 1) resolve("gallery");
        else resolve(null);
      }
    );
  });
}

// ── Pick image from camera or gallery ───────────────────────────
export async function pickPhoto(source: "camera" | "gallery"): Promise<string | null> {
  try {
    let result: ImagePicker.ImagePickerResult;

    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission",
          "Please allow camera access in Settings to take photos.",
          [{ text: "OK" }]
        );
        return null;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Gallery Permission",
          "Please allow photo library access in Settings.",
          [{ text: "OK" }]
        );
        return null;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [4, 3],
      });
    }

    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0].uri;
  } catch (e: any) {
    Alert.alert("Error", "Could not open " + source + ". " + (e?.message || ""));
    return null;
  }
}

// ── Main hook: show picker and optionally upload ─────────────────
export async function selectAndUploadPhoto(opts: {
  jobId?: string;
  category?: "customer" | "progress" | "completion";
  onPicked: (localUri: string, remoteUrl?: string) => void;
  onError?: (msg: string) => void;
}): Promise<void> {
  const { jobId, category = "customer", onPicked, onError } = opts;

  // Choose source
  let source: "camera" | "gallery" | null = null;

  if (Platform.OS === "android") {
    // Android: use Alert since ActionSheet is iOS-only
    await new Promise<void>((resolve) => {
      Alert.alert(
        "Add Photo",
        "Choose how to add a photo",
        [
          { text: "📷 Take Photo",        onPress: () => { source = "camera";  resolve(); } },
          { text: "🖼️ Choose from Gallery", onPress: () => { source = "gallery"; resolve(); } },
          { text: "Cancel", style: "cancel", onPress: () => { source = null; resolve(); } },
        ],
        { cancelable: true }
      );
    });
  } else {
    source = await showPickerOptions();
  }

  if (!source) return;

  const uri = await pickPhoto(source);
  if (!uri) return;

  // Immediately show locally
  onPicked(uri, undefined);

  // Try to upload to Cloudinary via backend
  if (jobId) {
    try {
      const token = await getToken();
      if (token) {
        const result = await apiUploadMedia(jobId, uri, category);
        // Update with final Cloudinary URL
        onPicked(uri, result.media.url);
      }
    } catch (e: any) {
      // Upload failed — local URI still works for display
      console.warn("Upload failed, using local URI:", e.message);
    }
  }
}

// ── PhotoStrip component — replaces the old fake one everywhere ──
interface PhotoStripProps {
  photos:   Array<{ id: string; uri: string; type: string }>;
  label:    string;
  readonly?: boolean;
  jobId?:   string;
  category?: "customer" | "progress" | "completion";
  onAdd?:   (localUri: string, remoteUrl?: string) => void;
}

export function PhotoStrip({
  photos, label, readonly = false,
  jobId, category = "customer", onAdd,
}: PhotoStripProps) {
  const C = useTheme();
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleAdd = async () => {
    if (!onAdd) return;
    setUploading(true);
    await selectAndUploadPhoto({
      jobId,
      category,
      onPicked: (localUri, remoteUrl) => {
        onAdd(localUri, remoteUrl);
        setUploading(false);
      },
      onError: (msg) => {
        setUploading(false);
        Alert.alert("Error", msg);
      },
    });
    setUploading(false);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      {/* Header row */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 12 }}>{label}</Text>
        {!readonly && onAdd && (
          <Pressable
            onPress={handleAdd}
            disabled={uploading}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.primaryDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 }}
          >
            {uploading
              ? <ActivityIndicator size="small" color={C.primary} />
              : <Icon name="Camera" size={12} color={C.primary} />
            }
            <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 11 }}>
              {uploading ? "Uploading..." : "Add Photo"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Photos or empty state */}
      {photos.length === 0 && !readonly ? (
        <Pressable
          onPress={handleAdd}
          disabled={uploading}
          style={{ height: 90, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed", backgroundColor: C.bg1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}
        >
          {uploading
            ? <ActivityIndicator color={C.primary} />
            : <>
              <Icon name="Camera" size={22} color={C.text3} />
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>Take or choose photo</Text>
            </>
          }
        </Pressable>
      ) : photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {photos.map((p, i) => (
              <Pressable key={i} onPress={() => setPreview(p.uri)}>
                <Image source={{ uri: p.uri }} style={{ width: 88, height: 88, borderRadius: 12, borderWidth: 1.5, borderColor: C.border }} />
                <View style={{ position: "absolute", bottom: 4, right: 4, backgroundColor: "#000A", borderRadius: 6, padding: 3 }}>
                  <Icon name="ZoomIn" size={10} color="white" />
                </View>
              </Pressable>
            ))}
            {!readonly && onAdd && (
              <Pressable
                onPress={handleAdd}
                disabled={uploading}
                style={{ width: 88, height: 88, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary, borderStyle: "dashed", backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}
              >
                {uploading
                  ? <ActivityIndicator color={C.primary} />
                  : <Icon name="Plus" size={28} color={C.primary} />
                }
              </Pressable>
            )}
          </View>
        </ScrollView>
      ) : null}

      {/* Fullscreen preview modal */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable onPress={() => setPreview(null)} style={{ flex: 1, backgroundColor: "#000000EE", alignItems: "center", justifyContent: "center" }}>
          <Image source={{ uri: preview || "" }} style={{ width: "94%", height: 380, borderRadius: 18 }} resizeMode="contain" />
          <Pressable onPress={() => setPreview(null)} style={{ marginTop: 20, backgroundColor: "#1a1a2a", paddingHorizontal: 28, paddingVertical: 13, borderRadius: 22 }}>
            <Text style={{ color: "white", fontFamily: FONTS.semibold, fontSize: 14 }}>Close</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

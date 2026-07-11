import * as Location from "expo-location";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

/** Ask once, cache locally, return {lat, lon} or null. */
export async function getUserLocation(): Promise<{ lat: number; lon: number } | null> {
  // Try cache first
  try {
    const cached = await storage.getItem("aura_location");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof parsed?.lat === "number" && typeof parsed?.lon === "number") {
        return parsed;
      }
    }
  } catch {}

  if (Platform.OS === "web") {
    // Try HTML5 geolocation on web
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve(null); return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          try { await storage.setItem("aura_location", JSON.stringify(loc)); } catch {}
          resolve(loc);
        },
        () => resolve(null),
        { maximumAge: 10 * 60 * 1000, timeout: 5000 }
      );
    });
  }

  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 }).catch(() => null)
      || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
    if (!pos) return null;
    const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    try { await storage.setItem("aura_location", JSON.stringify(loc)); } catch {}
    return loc;
  } catch {
    return null;
  }
}

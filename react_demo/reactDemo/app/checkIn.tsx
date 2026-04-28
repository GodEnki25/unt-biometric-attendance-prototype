import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, useMemo, useRef } from "react";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://192.168.1.252:8000";

const CLASS_LAT = 33.18584015274567;
const CLASS_LON = -96.805340872654;
const GEOFENCE_RADIUS_M = 999999; // set to 75 for production

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type Session = {
  id: string;
  center_lat: number;
  center_lon: number;
  radius_m: number;
  is_open: boolean;
};

type UserLocation = {
  lat: number;
  lon: number;
  accuracy: number;
};

type CheckInResult = {
  ok: boolean;
  reason: string;
  distance_m?: number;
  allowed_distance_m?: number;
  server_time?: string;
};

type FaceCheckResult = {
  ok?: boolean;
  verified?: boolean;
  error?: string;
  similarity?: number;
  message?: string;
};

export default function CheckInScreen() {
  const router = useRouter();
  const cameraRef = useRef<any>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [loc, setLoc] = useState<UserLocation | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [faceResult, setFaceResult] = useState<FaceCheckResult | null>(null);

  const [permisssionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [status, setStatus] = useState("Starting...");
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isUploadingFace, setIsuploadingFace] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    try {
      setIsBootLoading(true);
      setResult(null);
      setFaceResult(null);
      setShowCamera(false);

      const granted = await requestLocationPermission();
      if (!granted) return;

      await fetchSession();
      await getUserLocation();

      setStatus("Ready");
    } catch (err: any) {
      setStatus("Error: " + err.message);
    } finally {
      setIsBootLoading(false);
    }
  }

  async function requestLocationPermission() {
    try {
      setStatus("Checking location services...");
      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        setPermissionStatus("denied");
        setStatus("Location services are turned off on this device.");
        return false;
      }

      setStatus("Requesting location permission...");
      const { status, canAskAgain, granted } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setPermissionStatus("denied");
        setStatus(
          canAskAgain
            ? "Location permission denied."
            : "Location permission is blocked. Enable it in phone settings."
        );
        return false;
      }

      setPermissionStatus("granted");
      setStatus("Location permission granted.");
      return true;
    } catch (err: any) {
      setPermissionStatus("denied");
      setStatus(`Permission error: ${err?.message || "Unknown error"}`);
      return false;
    }
  }

  async function fetchSession() {
    try {
      setStatus("Creating session...");
      const res = await fetch(`${API_BASE}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: 1,
          session_date: new Date().toISOString().split("T")[0],
          start_time: "00:00",
          end_time: "23:59",
        }),
      });

      if (!res.ok) throw new Error("Failed to create session");

      const data = await res.json();
      setSession(data);
      setStatus("Session ready");
    } catch (err: any) {
      console.error(err);
      setStatus("Session error: " + err.message);
      throw err;
    }
  }

  async function getUserLocation(refresh = false) {
    try {
      if (refresh) {
        setIsRefreshingLocation(true);
        setStatus("Refreshing location...");
      } else {
        setStatus("Getting location...");
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });

      setLoc({
        lat: current.coords.latitude,
        lon: current.coords.longitude,
        accuracy: current.coords.accuracy ?? 999,
      });

      setStatus("Ready");
    } catch (err: any) {
      setStatus(`Location error: ${err.message}`);
    } finally {
      setIsRefreshingLocation(false);
    }
  }

  async function refreshLocation() {
    await getUserLocation(true);
  }

  async function retryPermissionFlow() {
    setResult(null);
    setFaceResult(null);
    await initializeApp();
  }

  async function openCameraFlow() {
    if (!inside) return;

    setResult(null);
    setFaceResult(null);

    if (!cameraPermission?.granted) {
      setStatus("Requesting camera permission...");
      const response = await requestCameraPermission();
      if (!response.granted) {
        setStatus("Camera permission denied. Please enable in Settings.");
        return;
      }
    }

    setShowCamera(true);
    setStatus("Camera ready");
  }

  async function captureFaceAndCheckIn() {
    if (!cameraRef.current || !loc || !inside) return;

    try {
      setIsCheckingIn(true);
      setIsuploadingFace(true);
      setResult(null);
      setFaceResult(null);
      setStatus("Capturing face...");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });

      setStatus("Verifying face...");

      const userId = await AsyncStorage.getItem("user_id");

      const formData = new FormData();
      formData.append("user_id", userId ?? "1");
      formData.append("file", {
        uri: photo.uri,
        name: "photo.jpg",
        type: "image/jpeg",
      } as any);

      const res = await fetch(`${API_BASE}/face/verify`, {
        method: "POST",
        body: formData,
      });

      const faceData = await res.json();
      setFaceResult(faceData);

      if (!faceData?.verified) {
        setStatus("Face did not match");
        setResult({
          ok: false,
          reason: faceData?.message || faceData?.error || "Face verification failed.",
        });
        return;
      }

      setStatus("Face verified. Submitting check-in...");
      await submitAttendanceCheckIn();

    } catch (err: any) {
      setResult({
        ok: false,
        reason: err.message || "Face verification failed",
      });
      setStatus("Check-in failed");
    } finally {
      setIsuploadingFace(false);
      setIsCheckingIn(false);
    }
  }

  async function submitAttendanceCheckIn() {
    if (!loc) return;

    const formData = new FormData();

    //const userId = await AsyncStorage.getItem("user_id");
    let userId = await AsyncStorage.getItem("user_id");
    if (!userId) {
    userId = "3";
    await AsyncStorage.setItem("user_id", userId);
}

    formData.append("user_id", userId ?? "1");
    formData.append("latitude", String(loc.lat));
    formData.append("longitude", String(loc.lon));
    formData.append("accuracy", String(loc.accuracy ?? 999));

    const res = await fetch(`${API_BASE}/checkin`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || data.success === false) {
      setResult({
        ok: false,
        reason: data?.message || data?.error || "Server error",
        distance_m: data?.distance_m,
        allowed_distance_m: data?.allowed_radius_m,
      });
      setStatus("Check-in failed");
      return;
    }

    setResult({
      ok: data.location_verified,
      reason: data.location_verified ? "✅ Attendance recorded!" : "Outside allowed geofence",
      distance_m: data.distance_m,
      allowed_distance_m: data.allowed_radius_m,
    });

    setStatus(data.location_verified ? "Check-in successful!" : "Outside geofence");
  }

  const distance = useMemo(() => {
    if (!loc) return null;
    return haversineMeters(loc.lat, loc.lon, CLASS_LAT, CLASS_LON);
  }, [loc]);

  const allowed = GEOFENCE_RADIUS_M;
  const inside = distance !== null && distance <= allowed;

  const renderContent = () => {
    if (isBootLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      );
    }

    if (permisssionStatus === "denied") {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location Access Required</Text>
          <Text style={styles.cardText}>You must allow location access before checking in.</Text>
          <Text style={styles.statusText}>{status}</Text>
          <Pressable style={styles.primaryButton} onPress={retryPermissionFlow}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    if (!session || !loc) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      );
    }

    return (
      <View style={styles.mainContent}>
        <Text style={styles.classTitle}>CSCE 4901</Text>
        <Text style={styles.classRoom}>Classroom 266</Text>

        {!showCamera ? (
          <>
            <View
              style={[
                styles.statusCircle,
                inside ? styles.insideCircle : styles.outsideCircle,
              ]}
            >
              <Text style={styles.statusIcon}>{inside ? "✓" : "✕"}</Text>
              <Text style={styles.statusLabel}>
                {inside ? "INSIDE\nCLASSROOM" : "OUTSIDE\nCLASSROOM"}
              </Text>
            </View>

            <Text style={styles.sessionText}>
              {inside
                ? "Session Ends: 02:00 PM"
                : "Move closer to Classroom 266\nto check in"}
            </Text>

            <Pressable
              onPress={refreshLocation}
              disabled={isRefreshingLocation}
              style={[styles.secondaryButton, isRefreshingLocation && styles.disabledButton]}
            >
              <Text style={styles.secondaryButtonText}>
                {isRefreshingLocation ? "Refreshing..." : "Refresh Location"}
              </Text>
            </Pressable>

            <Pressable
              onPress={openCameraFlow}
              disabled={!inside || isCheckingIn}
              style={[styles.checkInButton, (!inside || isCheckingIn) && styles.disabledButton]}
            >
              <Text style={styles.checkInButtonText}>Continue to Face Scan</Text>
            </Pressable>

            <Text style={styles.lastAttendance}>Last Attendance: 03/06</Text>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Face Verification</Text>

            {!cameraPermission?.granted ? (
              <View style={styles.centerContent}>
                <Text style={styles.cardText}>Camera permission is required to continue.</Text>
                <Pressable style={styles.checkInButton} onPress={openCameraFlow}>
                  <Text style={styles.checkInButtonText}>Allow Camera</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <CameraView ref={cameraRef} style={styles.camera} facing="front" />

                <Pressable
                  onPress={captureFaceAndCheckIn}
                  disabled={isUploadingFace || isCheckingIn}
                  style={[
                    styles.checkInButton,
                    (isUploadingFace || isCheckingIn) && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.checkInButtonText}>
                    {isUploadingFace || isCheckingIn ? "Verifying..." : "Capture Face & Check In"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setShowCamera(false);
                    setFaceResult(null);
                    setStatus("Ready");
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Close Camera</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {result && (
          <View style={[styles.card, { borderColor: result.ok ? "#16a34a" : "#dc2626", borderWidth: 2 }]}>
            <Text style={styles.cardTitle}>Check-In Result</Text>
            <Text style={[styles.cardText, { color: result.ok ? "#16a34a" : "#dc2626", fontWeight: "bold" }]}>
              {result.reason}
            </Text>
            {faceResult?.similarity !== undefined && (
              <Text style={styles.cardText}>
                Face similarity: {(faceResult.similarity * 100).toFixed(1)}%
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{"⬅"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Check In</Text>
        <Image source={require("../assets/logo.png")} style={styles.headerLogo} />
      </View>
      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2" },
  header: {
    height: 90,
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 40,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  backButton: { width: 40 },
  backButtonText: { fontSize: 26, fontWeight: "bold" },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "bold", textAlign: "center" },
  headerLogo: { width: 45, height: 45, borderRadius: 8 },
  content: { flex: 1, padding: 20 },
  centerContent: { justifyContent: "center", alignItems: "center", gap: 14 },
  mainContent: { gap: 14, paddingBottom: 24 },
  card: { backgroundColor: "white", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#ddd" },
  cardTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  cardText: { fontSize: 15, marginBottom: 4, color: "#333" },
  statusText: { fontSize: 15, color: "#444", marginBottom: 8 },
  camera: {
    width: "100%",
    height: 320,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#000",
  },
  primaryButton: { backgroundColor: "#111827", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  primaryButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  secondaryButton: {
    backgroundColor: "white",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  secondaryButtonText: { color: "#111827", fontSize: 16, fontWeight: "600" },
  disabledButton: { opacity: 0.5 },
  classTitle: { fontSize: 24, fontWeight: "bold", color: "#15803d", textAlign: "center" },
  classRoom: { fontSize: 16, color: "#444", marginBottom: 30, textAlign: "center" },
  statusCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    alignSelf: "center",
  },
  insideCircle: { backgroundColor: "#16a34a" },
  outsideCircle: { backgroundColor: "#dc2626" },
  statusIcon: { fontSize: 52, color: "white", fontWeight: "bold" },
  statusLabel: { color: "white", fontSize: 16, fontWeight: "bold", textAlign: "center", marginTop: 10 },
  sessionText: { fontSize: 16, textAlign: "center", marginBottom: 24, color: "#166534", fontWeight: "600" },
  checkInButton: {
    backgroundColor: "#15803d",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 10,
  },
  checkInButtonText: { color: "white", fontSize: 17, fontWeight: "bold" },
  lastAttendance: { marginTop: 24, textAlign: "center", fontSize: 14, color: "#444", fontWeight: "600" },
});
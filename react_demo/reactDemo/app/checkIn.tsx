
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE } from "../constants/api";
import { Colors } from "../constants/theme";

type Session = {
  id: string;
  center_lat: number;
  center_lon: number;
  radius_m: number;
  is_open: boolean;
  session_date?: string;
  start_time?: string;
};

type Coordinates = {
  lat: number;
  lon: number;
  accuracy: number;
};

type GeofenceResult = {
  inside: boolean;
  allow_biometric: boolean;
  reason?: string;
  confirmed_state?: string;
  candidate_state?: string;
  event_type?: string | null;
};

type VerificationResult = {
  status?: string;
  confidence?: number;
  periocular_confidence?: number | null;
  matches?: number;
  required?: number;
  action?: string;
  step?: number;
  total_steps?: number;
  seconds_remaining?: number;
  liveness?: string;
  reason?: string;
  message?: string;
  detail?: unknown;
};

type AttendanceResult = {
  success?: boolean;
  message?: string;
  error?: string;
  detail?: unknown;
};

const MAX_SCAN_MS = 55000;
const MAX_FRAMES = 120;

const actionLabel = (action?: string) => {
  switch (action) {
    case "blink":
      return "Blink once, then reopen your eyes";
    case "open_mouth":
      return "Open your mouth wide";
    case "smile":
      return "Smile widely";
    case "turn_head":
      return "Slowly turn your head to one side";
    default:
      return "Keep your face centered";
  }
};

export default function CheckInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraView | null>(null);
  const scanStopped = useRef(false);
  const scanningRef = useRef(false);
  const mountedRef = useRef(true);

  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();

  const [session, setSession] = useState<Session | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [inside, setInside] = useState(false);
  const [geo, setGeo] = useState<GeofenceResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);

  const [phase, setPhase] = useState<
    "idle" | "face" | "countdown" | "liveness" | "confirm" | "done"
  >("idle");

  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownDeadline, setCountdownDeadline] =
    useState<number | null>(null);

  const [challenge, setChallenge] = useState("");
  const [challengeStep, setChallengeStep] = useState(0);
  const [challengeTotal, setChallengeTotal] = useState(2);
  const [challengeRemaining, setChallengeRemaining] = useState(0);
  const [matches, setMatches] = useState(0);
  const [requiredMatches, setRequiredMatches] = useState(3);

  const [faceDetected, setFaceDetected] = useState(false);

  async function getToken() {
    const token = await SecureStore.getItemAsync("access_token");

    if (!token) {
      throw new Error("Session expired. Please log in again.");
    }

    return token;
  }

  async function getSession(): Promise<Session | null> {
    const token = await getToken();

    const response = await fetch(`${API_BASE}/geofence/session`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Unable to load the attendance session.");
    }

    const data = await response.json();
    const currentSession: Session | null =
      data && typeof data.is_open === "boolean" ? data : null;

    if (mountedRef.current) {
      setSession(currentSession);
    }

    return currentSession;
  }

  async function getCurrentLocation(): Promise<Coordinates> {
    const permission =
      await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Location permission is required.");
    }

    const result = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      lat: result.coords.latitude,
      lon: result.coords.longitude,
      accuracy: result.coords.accuracy ?? 999,
    };
  }

  async function checkGeofence(
    coordinates: Coordinates
  ): Promise<GeofenceResult> {
    const token = await getToken();

    const response = await fetch(`${API_BASE}/geofence/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lat: coordinates.lat,
        lon: coordinates.lon,
        accuracy_m: coordinates.accuracy,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail || "Geofence verification failed."
      );
    }

    return data;
  }

  async function refreshLocation(showLoading = true) {
    if (showLoading) {
      setRefreshing(true);
    }

    try {
      const currentSession = await getSession();
      const coordinates = await getCurrentLocation();
      const result = await checkGeofence(coordinates);

      if (!mountedRef.current) {
        return;
      }

      setLocation(coordinates);
      setGeo(result);

      const allowed =
        currentSession?.is_open === true &&
        result.inside === true &&
        result.allow_biometric === true;

      setInside(allowed);

      console.log("GEOFENCE UPDATE:", {
        phone_lat: coordinates.lat,
        phone_lon: coordinates.lon,
        accuracy_m: coordinates.accuracy,
        inside: result.inside,
        allow_biometric: result.allow_biometric,
        confirmed_state: result.confirmed_state,
        event_type: result.event_type,
      });

      if (!currentSession?.is_open) {
        setStatus("No active instructor session");
      } else if (!allowed) {
        setStatus("Outside Boundary");
      } else {
        setStatus("Inside Boundary");
      }

      if (!allowed && scanningRef.current) {
        scanStopped.current = true;
        setError("Geofence access is no longer valid.");
        setShowCamera(false);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setInside(false);
        setStatus("Location unavailable");
        setError(err?.message || "Unable to check location.");
      }
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }

  async function loadAttendanceStatus() {
    try {
      const token = await getToken();

      const response = await fetch(
        `${API_BASE}/checkin/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.checked_in && mountedRef.current) {
        setCheckedIn(true);

        if (data.check_in_time) {
          setCheckInTime(new Date(data.check_in_time));
        }
      }
    } catch (err) {
      console.log("Attendance status error:", err);
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    const initialize = async () => {
      try {
        setLoading(true);
        await refreshLocation(false);
        await loadAttendanceStatus();
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      mountedRef.current = false;
      scanStopped.current = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!scanningRef.current) {
        void refreshLocation(false);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdownDeadline === null) {
      return;
    }

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((countdownDeadline - Date.now()) / 1000)
      );

      setCountdown(remaining);
    };

    update();

    const interval = setInterval(update, 100);

    return () => clearInterval(interval);
  }, [countdownDeadline]);

  function resetVisualVerification() {
    setPhase("idle");
    setCountdown(null);
    setCountdownDeadline(null);
    setChallenge("");
    setChallengeStep(0);
    setChallengeRemaining(0);
    setMatches(0);
    setFaceDetected(false);
  }

  async function cancelVerification() {
    try {
      const token = await getToken();

      await expoFetch(`${API_BASE}/verify/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.log("Verification cleanup error:", err);
    }
  }

  async function openCamera() {
    if (!inside || !session?.is_open || checkedIn) {
      return;
    }

    try {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();

        if (!permission.granted) {
          throw new Error("Camera permission is required.");
        }
      }

      await cancelVerification();

      resetVisualVerification();
      setError("");
      setCameraReady(false);
      scanStopped.current = false;
      setShowCamera(true);
      setStatus("Position your face inside the camera");
    } catch (err: any) {
      setError(err?.message || "Cannot open camera.");
    }
  }

  function deletePhoto(uri?: string) {
    if (!uri) {
      return;
    }

    try {
      const photo = new File(uri);

      if (photo.exists) {
        photo.delete();
      }
    } catch (err) {
      console.log("Temporary image cleanup failed:", err);
    }
  }

  async function sendVerificationFrame(
    photoUri: string
  ): Promise<VerificationResult> {
    const token = await getToken();
    const form = new FormData();

    form.append("file", new File(photoUri));

    const response = await expoFetch(`${API_BASE}/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    const text = await response.text();

    let data: VerificationResult;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid response from biometric server.");
    }

    if (!response.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : `Verification failed (HTTP ${response.status}).`
      );
    }

    return data;
  }

  async function submitAttendance(photoUri: string) {
    if (!location || !inside || !session?.is_open) {
      throw new Error("Student is not inside an active geofence.");
    }

    const token = await getToken();
    const form = new FormData();

    form.append("latitude", String(location.lat));
    form.append("longitude", String(location.lon));
    form.append("accuracy", String(location.accuracy));
    form.append("file", new File(photoUri));

    const response = await expoFetch(`${API_BASE}/checkin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    const data: AttendanceResult = await response.json();

    if (!response.ok || data.success !== true) {
      throw new Error(
        data.error ||
        data.message ||
        "Attendance was not accepted."
      );
    }

    setCheckedIn(true);
    setCheckInTime(new Date());
    setPhase("done");
    setStatus("Check-in complete");
    setShowCamera(false);
  }

  function processVerificationResult(data: VerificationResult) {
    switch (data.status) {
      case "liveness_countdown": {
        setPhase("countdown");
        setFaceDetected(true);
        setChallenge("");

        const remaining = Math.max(
          0,
          data.seconds_remaining ?? 0
        );

        setCountdownDeadline(Date.now() + remaining * 1000);
        setStatus("Face matched. Prepare for liveness.");
        return "continue";
      }

      case "liveness_pending": {
        setPhase("liveness");
        setCountdown(null);
        setCountdownDeadline(null);

        setFaceDetected(true);
        setChallenge(actionLabel(data.action));
        setChallengeStep(data.step ?? 1);
        setChallengeTotal(data.total_steps ?? 2);
        setChallengeRemaining(
          Math.ceil(data.seconds_remaining ?? 0)
        );

        setStatus("Complete the liveness challenge");
        return "continue";
      }

      case "scanning": {
        setCountdown(null);
        setCountdownDeadline(null);
        setChallenge("");
        setFaceDetected(true);
        setMatches(data.matches ?? 0);
        setRequiredMatches(data.required ?? 3);

        if (data.liveness === "passed") {
          setPhase("confirm");
          setStatus("Liveness passed. Confirming identity...");
        } else {
          setPhase("face");
          setStatus("Matching your face...");
        }

        return "continue";
      }

      case "no_face_detected":
      case "invalid_frame": {
        setFaceDetected(false);
        setStatus("Keep one face centered in the frame");
        return "continue";
      }

      case "multiple_faces_detected":
      case "invalid_face_count": {
        setFaceDetected(false);
        setStatus("Only one face should be visible");
        return "continue";
      }

      case "verified": {
        if (data.liveness !== "passed") {
          throw new Error(
            "Verification did not confirm successful liveness."
          );
        }

        return "verified";
      }

      case "face_not_enrolled": {
        throw new Error("No enrolled biometric profile found.");
      }

      case "face_not_matched": {
        setStatus("Face mismatch. Please try again.");
        return "continue";
      }

      case "liveness_failed": {
        throw new Error(
          `Liveness failed: ${data.reason || "challenge expired"}`
        );
      }

      default: {
        throw new Error(
          `Unexpected verification status: ${data.status}`
        );
      }
    }
  }

  async function scanAndCheckIn() {
    if (
      scanningRef.current ||
      !cameraRef.current ||
      !cameraReady ||
      !inside ||
      !session?.is_open ||
      checkedIn
    ) {
      return;
    }

    scanningRef.current = true;
    scanStopped.current = false;

    let attendanceCompleted = false;

    setScanning(true);
    setError("");
    resetVisualVerification();
    setPhase("face");
    setStatus("Scanning your face...");

    try {
      // A new attempt must start a new backend verifier.
      await cancelVerification();

      const started = Date.now();

      for (
        let attempt = 0;
        attempt < MAX_FRAMES && Date.now() - started < MAX_SCAN_MS;
        attempt++
      ) {
        if (scanStopped.current || !cameraRef.current) {
          break;
        }

        let photoUri: string | undefined;

        try {
          const image = await cameraRef.current.takePictureAsync({
            quality: 0.55,
            skipProcessing: false,
            shutterSound: false,
          });

          photoUri = image?.uri;

          if (!photoUri) {
            continue;
          }

          if (scanStopped.current) {
            break;
          }

          const response = await sendVerificationFrame(photoUri);

          if (scanStopped.current) {
            break;
          }

          const outcome = processVerificationResult(response);

          if (outcome === "verified") {
            setStatus("Verification complete. Recording attendance...");

            await submitAttendance(photoUri);

            attendanceCompleted = true;
            break;
          }
        } finally {
          deletePhoto(photoUri);
        }
      }

      if (!attendanceCompleted && !scanStopped.current) {
        throw new Error(
          "Verification timed out. Please try again."
        );
      }
    } catch (err: any) {
      if (!scanStopped.current) {
        setError(err?.message || "Verification failed.");
        setStatus("Check-in failed");
      }
    } finally {
      if (!attendanceCompleted) {
        await cancelVerification();
      }

      setScanning(false);
      scanningRef.current = false;
      setCountdown(null);
      setCountdownDeadline(null);
    }
  }

  async function closeCamera() {
    scanStopped.current = true;

    await cancelVerification();

    setShowCamera(false);
    setCameraReady(false);
    setScanning(false);
    resetVisualVerification();
    setStatus("Ready");
  }

  const canCheckIn =
    inside &&
    session?.is_open === true &&
    !checkedIn;

  const faceColor = faceDetected
    ? "#27AE60"
    : "#FFFFFF";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.body}>Initializing GeoFace...</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top }
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={25}
            color={Colors.textPrimary}
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          GeoFace Check-In
        </Text>

        <View style={{ width: 25 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Attendance Check-In</Text>
        <Text style={styles.subtitle}>
          Confirm your classroom location and verify your identity.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Class Session</Text>

          <Text style={styles.value}>
            CSCE4999 - Capstone Testing
          </Text>

          <Text style={styles.muted}>
            {session?.is_open
              ? `Active session · ${session.radius_m} m radius`
              : "No active instructor session"}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons
              name="location-outline"
              size={28}
              color={inside ? "#27AE60" : "#E74C3C"}
            />

            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                Geofence Status
              </Text>

              <Text
                style={[
                  styles.status,
                  { color: inside ? "#27AE60" : "#E74C3C" }
                ]}
              >
                {inside ? "Inside Boundary" : "Outside Boundary"}
              </Text>
            </View>
          </View>

          <Text style={styles.muted}>
            {geo?.reason || status}
          </Text>

          {location && (
            <Text style={styles.small}>
              GPS accuracy: ±{Math.round(location.accuracy)} m
            </Text>
          )}

          <Pressable
            onPress={() => void refreshLocation()}
            disabled={refreshing || scanning}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {refreshing ? "Refreshing..." : "Refresh Location"}
            </Text>
          </Pressable>
        </View>

        {checkedIn ? (
          <View style={styles.card}>
            <Ionicons
              name="checkmark-circle"
              size={60}
              color="#27AE60"
              style={{ alignSelf: "center" }}
            />

            <Text style={styles.successTitle}>
              Attendance Recorded
            </Text>

            <Text style={styles.mutedCenter}>
              Your check-in was successfully recorded.
            </Text>

            {checkInTime && (
              <Text style={styles.mutedCenter}>
                {checkInTime.toLocaleString()}
              </Text>
            )}

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.primaryButtonText}>
                Done
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Biometric Verification
            </Text>

            {!showCamera ? (
              <>
                <Text style={styles.muted}>
                  Each check-in requires facial recognition and
                  a new liveness test.
                </Text>

                <Pressable
                  onPress={() => void openCamera()}
                  disabled={!canCheckIn}
                  style={[
                    styles.primaryButton,
                    !canCheckIn && styles.disabledButton
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    Start Face Verification
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.cameraFrame}>
                  <CameraView
                    ref={cameraRef}
                    facing="front"
                    mode="picture"
                    animateShutter={false}
                    style={styles.camera}
                    onCameraReady={() => {
                      setCameraReady(true);
                      setStatus("Camera ready");
                    }}
                  />

                  <View
                    pointerEvents="none"
                    style={[
                      styles.faceOval,
                      { borderColor: faceColor }
                    ]}
                  />

                  {phase === "countdown" && countdown !== null && (
                    <View
                      pointerEvents="none"
                      style={styles.countdownOverlay}
                    >
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={38}
                        color="#FFFFFF"
                      />

                      <Text style={styles.overlayTitle}>
                        Face Matched Successfully
                      </Text>

                      <Text style={styles.overlaySubtitle}>
                        Liveness test starts in
                      </Text>

                      <Text style={styles.countdownNumber}>
                        {countdown}
                      </Text>

                      <Text style={styles.overlaySubtitle}>
                        Keep your face centered and get ready
                      </Text>
                    </View>
                  )}

                  {phase === "liveness" && (
                    <View
                      pointerEvents="none"
                      style={styles.challengeOverlay}
                    >
                      <Text style={styles.challengeTitle}>
                        Liveness Test
                      </Text>

                      <Text style={styles.challengeAction}>
                        {challenge}
                      </Text>

                      <Text style={styles.challengeMeta}>
                        Step {challengeStep}/{challengeTotal}
                        {" · "}
                        {challengeRemaining}s
                      </Text>
                    </View>
                  )}

                  {phase === "confirm" && (
                    <View
                      pointerEvents="none"
                      style={styles.challengeOverlay}
                    >
                      <Text style={styles.challengeAction}>
                        Liveness Passed
                      </Text>

                      <Text style={styles.challengeMeta}>
                        Final face confirmation:
                        {" "}
                        {matches}/{requiredMatches}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.feedback}>
                  {scanning && (
                    <ActivityIndicator
                      size="small"
                      color={Colors.primary}
                    />
                  )}

                  <Text style={styles.feedbackText}>
                    {status}
                  </Text>
                </View>

                <Pressable
                  onPress={() => void scanAndCheckIn()}
                  disabled={!cameraReady || scanning}
                  style={[
                    styles.primaryButton,
                    (!cameraReady || scanning) &&
                      styles.disabledButton
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {scanning
                      ? "Verifying..."
                      : "Verify Face & Check In"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void closeCamera()}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    Close Camera
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {!!error && (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={25}
              color="#C0392B"
            />

            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        <Text style={styles.privacyText}>
          Verification frames are processed temporarily and
          removed from the phone's application cache after use.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  value: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 16,
    marginTop: 16,
  },
  muted: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  mutedCenter: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
  },
  small: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
  status: {
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    minHeight: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.primary,
    minHeight: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
  cameraFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111111",
    marginTop: 12,
  },
  camera: {
    flex: 1,
  },
  faceOval: {
    position: "absolute",
    top: "9%",
    bottom: "9%",
    left: "17%",
    right: "17%",
    borderWidth: 3,
    borderRadius: 160,
  },
  countdownOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.60)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  overlayTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12,
  },
  overlaySubtitle: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },
  countdownNumber: {
    color: "#FFFFFF",
    fontSize: 86,
    fontWeight: "900",
    marginVertical: 8,
  },
  challengeOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  challengeTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  challengeAction: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  challengeMeta: {
    color: "#FFFFFF",
    fontSize: 13,
    marginTop: 8,
  },
  feedback: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 48,
    gap: 10,
  },
  feedbackText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    flexShrink: 1,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#27AE60",
    textAlign: "center",
    marginTop: 12,
  },
  errorCard: {
    backgroundColor: "#FFF1F0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F5C6CB",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#C0392B",
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  privacyText: {
    textAlign: "center",
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});

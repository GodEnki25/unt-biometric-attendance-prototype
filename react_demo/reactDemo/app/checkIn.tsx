import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, Platform, Alert, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useMemo, useRef } from "react";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

//API address is now stored in constants/api.ts so the frontend
//does not need a hardcoded backend IP in each screen.
import { API_BASE } from "../constants/api";
import { Colors, Radius, Spacing } from "../constants/theme";

type Session = {
  id: string;
  center_lat: number;
  center_lon: number;
  radius_m: number;
  is_open: boolean;
  session_date?: string;
  start_time?: string;
  end_time?: string | null;
};

type UserLoation = {
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

// UPDATED FOR NEW BIOMETRIC API
type FaceCheckResult = {
  status?: string;
  user?: string;
  confidence?: number;
  matches?: number;
  required?: number;
  action?: string;
  step?: number;
  total_steps?: number;
  seconds_remaining?: number;
  reason?: string;
  error?: string;
  detail?: any;
};

type GeofenceResult = {
  inside: boolean;
  allow_biometric: boolean;
  reason: string;
  confirmed_state?: "INSIDE" | "OUTSIDE";
  candidate_state?: "INSIDE" | "OUTSIDE" | null;
  candidate_count?: number;
  state_changed?: boolean;
  event_type?: "EXIT" | "REENTER" | null;
  presence_tracking?: boolean;
  radius_m?: number;
  accuracy_buffer_m?: number;
  allowed_radius_m?: number;
  engine?: string;
};

export default function CheckInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get the userId that was passed from dashboard.tsx
  const { userId } = useLocalSearchParams();

  const cameraRef = useRef<CameraView | null>(null);
  const scanStopped = useRef(false);
  const scanningRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [challengeText, setChallengeText] = useState("");

  const [session, setSession] = useState<Session | null>(null);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [loc, setLoc] = useState<UserLoation | null>(null);
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

  const [inside, setInside] = useState(false);
  const [geofenceResult, setGeofenceResult] = useState<GeofenceResult | null>(null);

  useEffect(() => {
    initializeApp();
    return () => {
      scanStopped.current = true;
    };
  }, []);

  useEffect(() => {
    console.log(
      "LOCATION WATCH EFFECT:",
      permisssionStatus
    );
    
    if (permisssionStatus !== "granted") {
      return;
    }

    const interval = setInterval(async() => {
      await fetchSession();
      await getUserLocation(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [permisssionStatus]);

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
      await fetchCheckInStatus();


    }
    catch (err: any) {
      setStatus("Error: " + err.message);
    }
    finally {
      setIsBootLoading(false);
    }
  }

  async function requestLocationPermission() {

    try {
      setStatus("Requesting location permission...");
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setPermissionStatus("denied");
        setStatus("Location permission denied.");
        return false;
      }

      setPermissionStatus("granted");
      return true;
    }

    catch (err: any) {
      setPermissionStatus("denied");
      setStatus(`Permission error: ${err.message}`);
      return false;
    }
  }

  async function fetchSession() {

    setStatus("Fetching session...");
    const token = await SecureStore.getItemAsync("access_token");

    if (!token) {
      throw new Error("Not logged in.");
    }

    const res = await fetch(`${API_BASE}/geofence/session`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch session (${res.status})`);
    }

    const data = await res.json();
    setSession(data);
  }

  async function verifyGeofence(currentLoc: UserLoation) {
    try {
      setStatus("Checking geofence...");

      const token = await SecureStore.getItemAsync("access_token");

      const res = await fetch(`${API_BASE}/geofence/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lat: currentLoc.lat,
          lon: currentLoc.lon,
          accuracy_m: currentLoc.accuracy,
        }),
      });

      const data: GeofenceResult = await res.json();

      console.log("GEOFENCE UPDATE:", {
        phone_lat: currentLoc.lat,
        phone_lon: currentLoc.lon,
        inside: data.inside,
        confirmed_state: data.confirmed_state,
        candidate_state: data.candidate_state,
        candidate_count: data.candidate_count,
        state_changed: data.state_changed,
        event_type: data.event_type,
      });

      if (!res.ok) {
        throw new Error("Geofence check failed");
      }

      setGeofenceResult(data);
      setInside(data.inside === true && data.allow_biometric === true);

      setStatus(data.inside ? "Inside geofence" : "Outside geofence");

      return data.inside === true;
    }

    catch (err: any) {
      setInside(false);
      setGeofenceResult(null);
      setStatus(`Geofence error: ${err.message}`);
      return false;
    }

  }

  async function getUserLocation(refresh = false) {

    try {
      if (refresh) {
        setIsRefreshingLocation(true);
        setStatus("Refreshing location...");
      }

      else {
        setStatus("Getting location...");
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const currentLoc = {
        lat: current.coords.latitude,
        lon: current.coords.longitude,
        accuracy: current.coords.accuracy ?? 999,
      };

      setLoc(currentLoc);

      await verifyGeofence(currentLoc);
    }

    catch (err: any) {
      setStatus(`Location error: ${err.message}`);
    }

    finally {
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

  async function fetchCheckInStatus() {
    const token = await SecureStore.getItemAsync("access_token");

    if(!token) {
      return;
    }

    const res = await fetch(`${API_BASE}/checkin/status`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      return;
    }

    const data = await res.json();

    if(data.checked_in) {
      setAlreadyCheckedIn(true);

      if(data.check_in_time) {
        setCheckInTime(new Date(data.check_in_time));
      }
    }
  }

  // ------------------------------------------------
  // BIOMETRIC VERIFICATION API
  // ------------------------------------------------

  async function sendToFaceAPI(photoUri: string): Promise<FaceCheckResult> {
    const token = await SecureStore.getItemAsync("access_token");
    if (!token) throw new Error("Authentication token not found. Please log in again.");
    const formData = new FormData();
    formData.append("file", new File(photoUri));
    const res = await expoFetch(`${API_BASE}/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(typeof data?.detail === "string" ? data.detail : "Face verification failed");
    }
    return data;
  }

  async function cancelFaceVerification() {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (token) {
        await expoFetch(`${API_BASE}/verify/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.log("Verification cleanup error:", error);
    }
  }

  function deleteTemporaryPhoto(uri: string | undefined) {
    if (!uri) return;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (error) {
      console.log("Temporary photo cleanup error:", error);
    }
  }

  function labelForAction(action?: string) {
    switch (action) {
      case "blink": return "Blink once: open, close, then open your eyes";
      case "open_mouth": return "Close your mouth, then open it";
      case "turn_head": return "Look forward, then gently turn your head";
      default: return "Keep your face in view";
    }
  }

  async function submitAttendanceCheckIn(photoUri: string) {
    if (!loc || !inside) return;

    const token = await SecureStore.getItemAsync("access_token");

    if (!token) {
      throw new Error("No authentication token found");
    }

    const formData = new FormData();

    formData.append("latitude", String(loc.lat));
    formData.append("longitude", String(loc.lon));
    formData.append("accuracy", String(loc.accuracy));

    const photoFile = new File(photoUri);
    formData.append("file", photoFile);

    const res = await expoFetch(`${API_BASE}/checkin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      setResult({
        ok: false,
        reason: data?.detail
          ? JSON.stringify(data.detail)
          : data?.message || "Server error",
      });

      setStatus("Check-in failed");
      return;
    }

    setResult({
      ok: data.success,
      reason: data.message || data.error || "Check-in failed",
    });

    if (data.success) {
      setAlreadyCheckedIn(true);
      setCheckInTime(new Date());
    }

    setStatus(
      data.success
        ? "Check-in complete"
        : "Check-in rejected"
    );
  }

  async function openCameraFlow() {
    if (!inside || !session?.is_open) return;

    scanStopped.current = false;
    setCameraReady(false);
    setChallengeText("");
    setResult(null);
    setFaceResult(null);

    if (!cameraPermission) {
      setStatus("Checking camera permission...");
      return;
    }

    if (!cameraPermission.granted) {
      setStatus("Requesting camera permission...")
      const response = await requestCameraPermission();

      if (!response.granted) {
        setStatus("Camera permission denied.");
        return;
      }
    }

    setShowCamera(true);
    setStatus("Position your face in the camera");
  }


  // ------------------------------------------------
  // BIOMETRIC CAPTURE + VERIFICATION
  // ------------------------------------------------

  async function captureFaceAndCheckIn() {
    if (!cameraRef.current || !cameraReady || !loc || !inside || !session?.is_open || scanningRef.current) return;
    scanningRef.current = true;
    scanStopped.current = false;
    let verified = false;
    try {
      setIsCheckingIn(true);
      setIsuploadingFace(true);
      setResult(null);
      setFaceResult(null);
      setChallengeText("");
      const startedAt = Date.now();
      const maxScanMs = 27000;
            for (let attempt = 0; attempt < 55 && Date.now() - startedAt < maxScanMs; attempt++) {
        if (scanStopped.current || !cameraRef.current) break;
        let photoUri: string | undefined;
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.55,
            skipProcessing: false,
          });
          photoUri = photo?.uri;
          if (!photoUri || scanStopped.current) break;
          setStatus("Checking identity and liveness...");
          const data = await sendToFaceAPI(photoUri);
          if (scanStopped.current) break;
          setFaceResult(data);
          if (data.status === "liveness_pending") {
            const action = labelForAction(data.action);
            setChallengeText(`${action} · Step ${data.step ?? 1}/${data.total_steps ?? 2} · ${Math.ceil(data.seconds_remaining ?? 0)}s`);
            setStatus("Complete the liveness challenge");
            continue;
          }
          if (data.status === "scanning") {
            setStatus(`Matching face... ${data.matches ?? 0}/${data.required ?? 3}`);
            continue;
          }
          if (data.status === "no_face_detected" || data.status === "invalid_frame") {
            setStatus("Keep one face centered in the frame");
            continue;
          }
          if (data.status === "verified") {
            verified = true;
            setChallengeText("Liveness and identity verified");
            setStatus("Face verified. Submitting check-in...");
            // Preserve the existing attendance endpoint, payload and geofence values.
            await submitAttendanceCheckIn(photoUri);
            setShowCamera(false);
            return;
          }
          if (data.status === "face_not_matched" || data.status === "face_not_enrolled" || data.status === "liveness_failed") {
            throw new Error(data.status === "liveness_failed"
              ? "Liveness challenge failed or expired. Please retry."
              : data.status === "face_not_enrolled"
                ? "No enrolled face profile was found."
                : "Face does not match the enrolled student.");
          }
          throw new Error(`Unexpected verification status: ${data.status ?? "unknown"}`);
        } finally {
          deleteTemporaryPhoto(photoUri);
        }
      }
      if (!scanStopped.current) {
        throw new Error("Verification timed out. Please try again.");
      }
    } catch (err: any) {
      if (!scanStopped.current) {
        setResult({ ok: false, reason: err?.message || "Face verification failed" });
        setStatus("Check-in failed");
      }
    } finally {
      if (!verified) await cancelFaceVerification();
      scanningRef.current = false;
      setIsuploadingFace(false);
      setIsCheckingIn(false);
    }
  }

  function formatSessionDate(date?: string) {
    if(!date) return "Current session";

    const [year, month, day] = date.split("-").map(Number);

    return new Date (
      year,
      month - 1,
      day
    ).toLocaleDateString("en-US" ,{
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatSessionTime(time?: string) {
    if(!time) return "";

    const [hours, minutes] = time.split(":").map(Number);

    const date = new Date();
    date.setHours(hours, minutes, 0);

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatCheckInTime(date: Date | null) {
    if (!date) {
      return "—";
    }

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // ============================================================
  // PAGE CONTENT
  // ============================================================

  const renderContent = () => {
    if (isBootLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator
            size="large"
            color={Colors.primary}
          />

          <Text style={styles.statusText}>
            {status}
          </Text>
        </View>
      );
    }

    if (permisssionStatus === "denied") {
      return (
        <View style={styles.permissionCard}>
          <View style={styles.largeSoftIcon}>
            <Ionicons
              name="location-outline"
              size={40}
              color={Colors.primary}
            />
          </View>

          <Text style={styles.permissionTitle}>
            Location Access Required
          </Text>

          <Text style={styles.permissionText}>
            Location access is required to verify that
            you are inside the classroom geofence.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={retryPermissionFlow}
          >
            <Text style={styles.primaryButtonText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    if (!session || !loc) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator
            size="large"
            color={Colors.primary}
          />

          <Text style={styles.statusText}>
            {status}
          </Text>
        </View>
      );
    }

    // ============================================================
    // SUCCESS STATE
    // ============================================================

    if (result?.ok === true || alreadyCheckedIn) {
      return (
        <ScrollView
          contentContainerStyle={
            styles.successContent
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successIconOuter}>
            <View style={styles.successIconInner}>
            <Ionicons
              name="checkmark"
              size={44}
              color={Colors.success}
            />
            </View>
          </View>

          <Text style={styles.successTitle}>
            Checked in successfully
          </Text>

          <Text style={styles.successSubtitle}>
            Your attendance has been recorded.
          </Text>

          {/* =====================================================
              SESSION DETAILS
          ====================================================== */}
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>
              Session details
            </Text>

            <View style={styles.detailRow}>
              <Ionicons
                name="book-outline"
                size={23}
                color={Colors.textSecondary}
              />

                <Text style={styles.detailLabel}>
                  COURSE
                </Text>
             
              <Text style={styles.detailValue}>
                CSCE 4901 - Capstone
              </Text>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.detailRow}>
              <Ionicons
                name="location-outline"
                size={23}
                color={Colors.textSecondary}
              />
             
                <Text style={styles.detailLabel}>
                  ROOM
                </Text>
             
              <Text style={styles.detailValue}>
                Classroom 266
              </Text>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.detailRow}>
              <Ionicons
                name="time-outline"
                size={23}
                color={Colors.textSecondary}
              />
              
                <Text style={styles.detailLabel}>
                  CHECK-IN TIME
                </Text>

                <Text style={styles.detailValue}>
                  {formatCheckInTime(checkInTime)}
                </Text>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.detailRow}>
              <Ionicons
                name="person-outline"
                size={23}
                color={Colors.textSecondary}
              />

                <Text style={styles.detailLabel}>
                  STATUS
                </Text>
             
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>
                  Present
                </Text>
              </View>
            </View>
          </View>

          {/* =====================================================
              VERIFICATION STATUS
          ====================================================== */}
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>
              Verification status
            </Text>

            <View style={styles.verifyRow}>
              <View style={styles.smallSoftIcon}>
                <Ionicons
                  name="location-outline"
                  size={23}
                  color={Colors.primary}
                />
              </View>

              <View
                style={styles.verifyTextWrap}
              >
                <Text style={styles.detailLabel}>
                  GEOFENCE STATUS
                </Text>

                <Text
                  style={styles.verifyValue}
                >
                  {inside
                    ? "Inside boundary"
                    : "Outside boundary"}
                </Text>
              </View>

              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>
                  Verified
                </Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.verifyRow}>
              <View style={styles.smallSoftIcon}>
                <MaterialCommunityIcons
                  name="face-recognition"
                  size={23}
                  color={Colors.primary}
                />
              </View>

              <View
                style={styles.verifyTextWrap}
              >
                <Text style={styles.detailLabel}>
                  FACE VERIFICATION
                </Text>

                <Text
                  style={styles.verifyValue}
                >
                  Complete
                </Text>
              </View>

              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>
                  Verified
                </Text>
              </View>
            </View>
          </View>

          {/* =====================================================
              ACTIONS
          ====================================================== */}
          <Pressable
            style={styles.sessionDetailsButton}
            onPress={() => {}}
          >
            <Text style={styles.sessionDetailButtonText}>
              View Session Details
            </Text>
          </Pressable>

          <Pressable
            style={styles.doneButton}
            onPress={() => router.back()}
          >
            <Text style={styles.doneButtonText}>
              Done
            </Text>
          </Pressable>
        </ScrollView>
      );
    }

    // ============================================================
    // NORMAL CHECK-IN STATE
    // ============================================================

    return (
      <ScrollView
        contentContainerStyle={styles.preCheckInContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =====================================================
            PAGE INTRO
        ====================================================== */}
        <View style={styles.pageIntro}>
          <Text style={styles.pageTitle}>Check In</Text>
          <Text style={styles.pageSubtitle}>
            Verify your presence in class.
          </Text>
        </View>

        {/* =====================================================
            CURRENT CLASS
        ====================================================== */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Current Class</Text>
          <Text style={styles.courseHero}>
            CSCE 4901 - Capstone
          </Text>

          <View style={styles.currentClassRow}>
            <Ionicons name="book-outline" size={27} color={Colors.textSecondary} />
            <Text style={styles.currentClassLabel}>Course</Text>
            <Text style={styles.currentClassValue}>CSCE 4901 - Capstone</Text>
          </View>

          <View style={styles.currentClassRow}>
            <Ionicons name="location-outline" size={27} color={Colors.textSecondary} />
            <Text style={styles.currentClassLabel}>Room</Text>
            <Text style={styles.currentClassValue}>Classroom 266</Text>
          </View>

          <View style={styles.currentClassRow}>
            <Ionicons name="time-outline" size={27} color={Colors.textSecondary} />
            <Text style={styles.currentClassLabel}>Session Time</Text>
            <View style={styles.sessionTimeWrap}>
              <Text style={styles.currentClassValue}>{formatSessionDate(session.session_date)}</Text>
              <Text style={styles.sessionSubValue}>{session.is_open ? `Started ${formatSessionTime(session.start_time)}` : `Ended ${formatSessionTime(session.end_time ?? undefined)}`}</Text>
            </View>
          </View>
        </View>

        {/* =====================================================
            LOCATION STATUS
        ====================================================== */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Location Status</Text>

          <View style={styles.statusCardRow}>
            <View style={[
              styles.largeSoftIcon,
              inside ? styles.successSoftBackground : styles.dangerSoftBackground,
            ]}>
              <Ionicons
                name="location-outline"
                size={46}
                color={inside ? Colors.success : Colors.danger}
              />
            </View>

            <View style={styles.statusTextWrap}>
              <Text style={[
                styles.statusHeadline,
                { color: inside ? Colors.success : Colors.danger },
              ]}>
                {inside
                  ? "You are inside the classroom boundary"
                  : "You are outside the classroom boundary"}
              </Text>
              <Text style={styles.statusMeta}>
                Lat: {loc.lat.toFixed(6)}, {loc.lon.toFixed(6)}
              </Text>
              <Text style={styles.statusMeta}>
                Accuracy: ±{Math.round(loc.accuracy)} m
              </Text>
            </View>
          </View>
        </View>

        {/* =====================================================
            FACE VERIFICATION
        ====================================================== */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Face Verification</Text>

          {!showCamera ? (
            <View style={styles.statusCardRow}>
              <View style={styles.largeSoftIcon}>
                <MaterialCommunityIcons
                  name="face-recognition"
                  size={44}
                  color={Colors.primary}
                />
              </View>

              <View style={styles.statusTextWrap}>
                <Text style={styles.faceReadyTitle}>Ready to verify</Text>
                <Text style={styles.faceReadyText}>
                  Your face will be matched for attendance when you start check-in.
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.cameraHelper}>
                Keep your face centered and follow the instructions that appear below.
              </Text>
              <View style={styles.cameraFrame}>
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing="front"
                  mode="picture"
                  onCameraReady={() => {
                    setCameraReady(true);
                    console.log("CAMERA READY");
                    setStatus("Camera ready");
                  }}
                />
              </View>
              {!!challengeText && (
                <Text style={styles.cameraHelper}>{challengeText}</Text>
              )}
              <Pressable
                onPress={captureFaceAndCheckIn}
                disabled={!cameraReady || isUploadingFace || isCheckingIn}
                style={[
                  styles.primaryButton,
                  (isUploadingFace || isCheckingIn) && styles.disabledButton,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isUploadingFace || isCheckingIn
                    ? "Verifying..."
                    : "Verify Face & Check In"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  scanStopped.current = true;
                  void cancelFaceVerification();
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

        {!showCamera && (
          <Pressable
            onPress={openCameraFlow}
            disabled={!inside || !session.is_open || isCheckingIn}
            style={[
              styles.startButton,
              (!inside || isCheckingIn) && styles.startButtonDisabled,
            ]}
          >
            <Text style={styles.startButtonText}>Start Check-In</Text>
            <Ionicons name="arrow-forward" size={28} color={Colors.surface} />
          </Pressable>
        )}

        <View style={styles.privacyRow}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={Colors.textSecondary}
          />
          <Text style={styles.privacyText}>
            Location is only checked during active class sessions.
          </Text>
        </View>

        {result && result.ok === false && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={24} color={Colors.danger} />
            <View style={styles.errorTextWrap}>
              <Text style={styles.errorTitle}>Check-in unsuccessful</Text>
              <Text style={styles.errorText}>{result.reason}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* =========================================================
          HEADER
      ========================================================== */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top },
        ]}
      >
        <View style={styles.headerBrand}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerDivider} />
          <Text style={styles.headerTitle}>
            {result?.ok === true || alreadyCheckedIn ? "Attendance Status" : "Check In"}
          </Text>
        </View>

        <Ionicons
          name="person-outline"
          size={30}
          color={Colors.textSecondary}
        />
      </View>

      {/* =========================================================
          PAGE CONTENT
      ========================================================== */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({

  // ============================================================
  // PAGE
  // ============================================================

  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    flex: 1,
  },

  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },

  statusText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: "center",
  },


  // ============================================================
  // HEADER
  // ============================================================

  header: {
    minHeight: 94,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },

  headerBrand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  headerLogo: {
    width: 62,
    height: 62,
  },

  headerDivider: {
    width: 2,
    height: 42,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
  },

  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 25,
    fontWeight: "800",
  },


  // ============================================================
  // PRE-CHECK-IN PAGE
  // ============================================================

  preCheckInContent: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 30,
  },

  pageIntro: {
    marginBottom: Spacing.lg,
  },

  pageTitle: {
    color: Colors.textPrimary,
    fontSize: 40,
    fontWeight: "800",
  },

  pageSubtitle: {
    color: Colors.textSecondary,
    fontSize: 20,
    marginTop: Spacing.sm,
  },


  // ============================================================
  // CARDS
  // ============================================================

  infoCard: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.lg,
    paddingHorizontal: 22,
    paddingVertical: 22,
    marginBottom: 18,
  },

  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 22,
  },

  courseHero: {
    color: Colors.textPrimary,
    fontSize: 27,
    fontWeight: "700",
    marginBottom: 18,
  },


  // ============================================================
  // CURRENT CLASS
  // ============================================================

  currentClassRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  currentClassLabel: {
    width: 120,
    color: Colors.textSecondary,
    fontSize: 16,
  },

  currentClassValue: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },

  sessionRow: {
    alignItems: "flex-start",
    paddingTop: 10,
  },

  sessionTimeWrap: {
    flex: 1,
  },

  sessionSubValue: {
    color: Colors.textSecondary,
    fontSize: 16,
    marginTop: 5,
  },


  // ============================================================
  // LOCATION STATUS
  // ============================================================

  statusCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },

  largeSoftIcon: {
    width: 94,
    height: 94,
    borderRadius: Radius.pill,
    backgroundColor: Colors.featureIconBackground,
    alignItems: "center",
    justifyContent: "center",
  },

  successSoftBackground: {
    backgroundColor: Colors.successSoft,
  },

  dangerSoftBackground: {
    backgroundColor: Colors.dangerSoft,
  },

  statusTextWrap: {
    flex: 1,
  },

  statusHeadline: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    marginBottom: Spacing.sm,
  },

  statusMeta: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },


  // ============================================================
  // FACE VERIFICATION
  // ============================================================

  faceReadyTitle: {
    color: Colors.primary,
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 6,
  },

  faceReadyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
  },


  // ============================================================
  // CAMERA
  // ============================================================

  cameraHelper: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 14,
  },

  cameraFrame: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  camera: {
    flex: 1,
  },


  // ============================================================
  // START CHECK-IN
  // ============================================================

  startButton: {
    minHeight: 64,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    marginTop: 2,
  },

  startButtonDisabled: {
    backgroundColor: Colors.disabled,
  },

  startButtonText: {
    flex: 1,
    color: Colors.surface,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginLeft: 28,
  },


  // ============================================================
  // PRIVACY NOTE
  // ============================================================

  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 20,
    paddingHorizontal: 14,
  },

  privacyText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },


  // ============================================================
  // SUCCESS STATE
  // ============================================================

  successContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 22,
    alignItems: "center",
  },

  successIconOuter: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    backgroundColor: Colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  successIconInner: {
    width: 70,
    height: 70,
    borderRadius: Radius.pill,
    borderWidth: 3,
    borderColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
  },

  successTitle: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },

  successSubtitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 22,
  },


  // ============================================================
  // SESSION DETAILS
  // ============================================================

  detailRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  detailLabel: {
    width: 116,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },

  detailValue: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },

  rowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },

  successBadge: {
    backgroundColor: Colors.successSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },

  successBadgeText: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: "800",
  },


  // ============================================================
  // VERIFICATION STATUS
  // ============================================================

  verifyRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  smallSoftIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.featureIconBackground,
    alignItems: "center",
    justifyContent: "center",
  },

  verifyTextWrap: {
    flex: 1,
  },

  verifyLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },

  verifyValue: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: "500",
  },


  // ============================================================
  // BUTTONS
  // ============================================================

  primaryButton: {
    width: "100%",
    minHeight: 58,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 4,
  },

  primaryButtonText: {
    color: Colors.surface,
    fontSize: 18,
    fontWeight: "800",
  },

  secondaryButton: {
    width: "100%",
    minHeight: 54,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },

  outlineButton: {
    width: "100%",
    minHeight: 58,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  outlineButtonText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: "800",
  },

  sessionDetailsButton: {
    width: "100%",
    minHeight: 56,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  sessionDetailButtonText: {
    color: Colors.surface,
    fontSize: 17,
    fontWeight: "800",
  },

  doneButton: {
    width: "100%",
    minHeight: 56,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  doneButtonText:{
    color: Colors.primary,
    fontSize: 17,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.5,
  },


  // ============================================================
  // PERMISSION STATE
  // ============================================================

  permissionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  permissionTitle: {
    color: Colors.textPrimary,
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 18,
  },

  permissionText: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 22,
  },


  // ============================================================
  // ERROR STATE
  // ============================================================

  errorCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.dangerSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: 18,
  },

  errorTextWrap: {
    flex: 1,
  },

  errorTitle: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: "800",
  },

  errorText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 3,
  },

});
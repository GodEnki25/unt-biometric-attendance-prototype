import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePresenceTracking } from "@/hooks/usePresenceTracking";
import { getStoredItem, setStoredItem } from "../utils/storage";

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
const MAX_VERIFICATION_ATTEMPTS = 3;
const VERIFICATION_LOCK_KEY = "geoface_verification_locked_token";
const VERIFICATION_LOCK_MESSAGE =
  "Face verification failed after 3 attempts. Camera access is locked. Log out and log in again to retry.";

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
  const scrollRef = useRef<React.ElementRef<typeof ScrollView> | null>(null);
  const faceCardY = useRef(0);
  const pendingCameraScroll = useRef(false);
  const scanStopped = useRef(false);
  const scanningRef = useRef(false);
  const mountedRef = useRef(true);

  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();

  const [session, setSession] = useState<Session | null>(null);

  const {
    location,
    rawInside,
    confirmedInside,
    permissionStatus: presencePermissionStatus,
    isRefreshing: presenceRefreshing,
    refreshPresence,
    startCheckedInTracking,
  } = usePresenceTracking();

  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [verificationLocked, setVerificationLocked] = useState(false);
  const verificationLockedRef = useRef(false);

  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);

  const inside = checkedIn ? confirmedInside : rawInside;

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
    const token = await getStoredItem("access_token");

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

        const token = await getToken();
        const lockedToken = await getStoredItem(VERIFICATION_LOCK_KEY);
        const locked = lockedToken === token;
        verificationLockedRef.current = locked;
        setVerificationLocked(locked);

        if (locked) {
          setError(VERIFICATION_LOCK_MESSAGE);
          setStatus("Verification locked");
        }

        const currentSession = await getSession();
        await loadAttendanceStatus();

        if (currentSession?.is_open) {
          await refreshPresence();
        }
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
    if (verificationLocked) {
      setStatus("Verification locked — log out and log in to retry");
      return;
    }

    if (presencePermissionStatus === "denied") {
      setStatus("Location permission is required");
      return;
    }

    if (!session?.is_open) {
      setStatus("No active instructor session");
      return;
    }

    if (!location) {
      setStatus("Checking location...");
      return;
    }

    setStatus(inside ? "Inside Boundary" : "Outside Boundary");
  }, [
    presencePermissionStatus,
    session?.is_open,
    location,
    inside,
    verificationLocked,
  ]);

  useEffect(() => {
    if (!inside && scanningRef.current) {
      scanStopped.current = true;
      setError("Geofence access is no longer valid.");
      setShowCamera(false);
    }
  }, [inside]);

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
    if (verificationLockedRef.current) {
      setError(VERIFICATION_LOCK_MESSAGE);
      setStatus("Verification locked");
      return;
    }

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

    await startCheckedInTracking();

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
      checkedIn ||
      verificationLockedRef.current
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
      for (
        let verificationAttempt = 1;
        verificationAttempt <= MAX_VERIFICATION_ATTEMPTS;
        verificationAttempt++
      ) {
        if (scanStopped.current || !cameraRef.current) {
          break;
        }

        await cancelVerification();
        resetVisualVerification();
        setPhase("face");
        setStatus(
          `Scanning your face (attempt ${verificationAttempt}/${MAX_VERIFICATION_ATTEMPTS})...`
        );

        const started = Date.now();
        let biometricVerified = false;

        try {
          for (
            let frameIndex = 0;
            frameIndex < MAX_FRAMES &&
            Date.now() - started < MAX_SCAN_MS;
            frameIndex++
          ) {
            if (scanStopped.current || !cameraRef.current) {
              break;
            }

            let photoUri: string | undefined;

            try {
              const image =
                await cameraRef.current.takePictureAsync({
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

              const response =
                await sendVerificationFrame(photoUri);

              if (scanStopped.current) {
                break;
              }

              const outcome =
                processVerificationResult(response);

              if (outcome === "verified") {
                biometricVerified = true;
                setStatus(
                  "Verification complete. Recording attendance..."
                );

                await submitAttendance(photoUri);

                attendanceCompleted = true;
                break;
              }
            } finally {
              deletePhoto(photoUri);
            }
          }

          if (attendanceCompleted || scanStopped.current) {
            break;
          }

          throw new Error(
            "Verification timed out. Please try again."
          );
        } catch (err: any) {
          const reason =
            err?.message || "Verification failed.";

          const retryableBiometricFailure =
            !biometricVerified &&
            (reason.startsWith("Liveness failed:") ||
              reason ===
                "Verification timed out. Please try again.");

          if (
            !retryableBiometricFailure ||
            scanStopped.current
          ) {
            throw err;
          }

          if (
            verificationAttempt ===
            MAX_VERIFICATION_ATTEMPTS
          ) {
            const token = await getToken();

            await setStoredItem(
              VERIFICATION_LOCK_KEY,
              token
            );

            verificationLockedRef.current = true;
            setVerificationLocked(true);
            setShowCamera(false);
            setCameraReady(false);

            throw new Error(
              VERIFICATION_LOCK_MESSAGE
            );
          }

          setStatus(
            `Verification failed (attempt ${verificationAttempt}/${MAX_VERIFICATION_ATTEMPTS}). ` +
              `${MAX_VERIFICATION_ATTEMPTS - verificationAttempt} attempt(s) remaining. Retrying...`
          );
        }
      }
    } catch (err: any) {
      if (!scanStopped.current) {
        setError(
          err?.message || "Verification failed."
        );

        setStatus(
          verificationLockedRef.current
            ? "Verification locked"
            : "Check-in failed"
        );
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

    setStatus(
      verificationLockedRef.current
        ? "Verification locked"
        : "Ready"
    );
  }

  const canCheckIn =
    inside &&
    session?.is_open === true &&
    !checkedIn &&
    !verificationLocked;

  const renderContent = () => {
    if (loading) {
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

    if (presencePermissionStatus === "denied") {
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
            onPress={() => void refreshPresence()}
          >
            <Text style={styles.primaryButtonText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    if (!session || !location) {
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

    if (checkedIn) {
      const currentlyInside = confirmedInside;

      return (
        <ScrollView
          contentContainerStyle={styles.successContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.successIconOuter,
              !currentlyInside && styles.outsideIconOuter,
            ]}
          >
            <View
              style={[
                styles.successIconInner,
                !currentlyInside && styles.outsideIconInner,
              ]}
            >
              <Ionicons
                name={currentlyInside ? "checkmark" : "close"}
                size={44}
                color={
                  currentlyInside
                    ? Colors.success
                    : Colors.danger
                }
              />
            </View>
          </View>

          <Text style={styles.successTitle}>
            {currentlyInside
              ? "Checked in successfully"
              : "Outside Classroom"}
          </Text>

          <Text style={styles.successSubtitle}>
            {currentlyInside
              ? "Your attendance has been recorded."
              : "You have left the classroom boundary. Return to Classroom 266."}
          </Text>

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
                {checkInTime
                  ? checkInTime.toLocaleString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }
                    )
                  : "Current session"}
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

              <View
                style={
                  currentlyInside
                    ? styles.successBadge
                    : styles.dangerBadge
                }
              >
                <Text
                  style={
                    currentlyInside
                      ? styles.successBadgeText
                      : styles.dangerBadgeText
                  }
                >
                  {currentlyInside ? "Present" : "Outside"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>
              Verification status
            </Text>

            <View style={styles.verifyRow}>
              <View
                style={[
                  styles.smallSoftIcon,
                  !currentlyInside &&
                    styles.dangerSoftBackground,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={23}
                  color={
                    currentlyInside
                      ? Colors.primary
                      : Colors.danger
                  }
                />
              </View>

              <View style={styles.verifyTextWrap}>
                <Text style={styles.detailLabel}>
                  GEOFENCE STATUS
                </Text>

                <Text style={styles.verifyValue}>
                  {currentlyInside
                    ? "Inside boundary"
                    : "Outside boundary"}
                </Text>
              </View>

              <View
                style={
                  currentlyInside
                    ? styles.successBadge
                    : styles.dangerBadge
                }
              >
                <Text
                  style={
                    currentlyInside
                      ? styles.successBadgeText
                      : styles.dangerBadgeText
                  }
                >
                  {currentlyInside
                    ? "Verified"
                    : "Not in range"}
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

              <View style={styles.verifyTextWrap}>
                <Text style={styles.detailLabel}>
                  FACE VERIFICATION
                </Text>

                <Text style={styles.verifyValue}>
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

    return (
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={
          styles.preCheckInContent
        }
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (
            pendingCameraScroll.current &&
            showCamera
          ) {
            pendingCameraScroll.current = false;

            scrollRef.current?.scrollTo({
              y: Math.max(
                0,
                faceCardY.current - 16
              ),
              animated: true,
            });
          }
        }}
      >
        <View style={styles.pageIntro}>
          <Text style={styles.pageTitle}>
            Check In
          </Text>

          <Text style={styles.pageSubtitle}>
            Verify your presence in class.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>
            Current Class
          </Text>

          <Text style={styles.courseHero}>
            CSCE 4901 - Capstone
          </Text>

          <View style={styles.currentClassRow}>
            <Ionicons
              name="book-outline"
              size={27}
              color={Colors.textSecondary}
            />

            <Text style={styles.currentClassLabel}>
              Course
            </Text>

            <Text style={styles.currentClassValue}>
              CSCE 4901 - Capstone
            </Text>
          </View>

          <View style={styles.currentClassRow}>
            <Ionicons
              name="location-outline"
              size={27}
              color={Colors.textSecondary}
            />

            <Text style={styles.currentClassLabel}>
              Room
            </Text>

            <Text style={styles.currentClassValue}>
              Classroom 266
            </Text>
          </View>

          <View style={styles.currentClassRow}>
            <Ionicons
              name="time-outline"
              size={27}
              color={Colors.textSecondary}
            />

            <Text style={styles.currentClassLabel}>
              Session Time
            </Text>

            <View style={styles.sessionTimeWrap}>
              <Text style={styles.currentClassValue}>
                {session.session_date ??
                  "Current session"}
              </Text>

              <Text style={styles.sessionSubValue}>
                {session.is_open
                  ? `Started ${
                      session.start_time ??
                      "Active"
                    }`
                  : "Ended Closed"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>
            Location Status
          </Text>

          <View style={styles.statusCardRow}>
            <View
              style={[
                styles.largeSoftIcon,
                inside
                  ? styles.successSoftBackground
                  : styles.dangerSoftBackground,
              ]}
            >
              <Ionicons
                name="location-outline"
                size={46}
                color={
                  inside
                    ? Colors.success
                    : Colors.danger
                }
              />
            </View>

            <View style={styles.statusTextWrap}>
              <Text
                style={[
                  styles.statusHeadline,
                  {
                    color: inside
                      ? Colors.success
                      : Colors.danger,
                  },
                ]}
              >
                {inside
                  ? "You are inside the classroom boundary"
                  : "You are outside the classroom boundary"}
              </Text>

              <Text style={styles.statusMeta}>
                Lat:{" "}
                {location.lat.toFixed(6)},{" "}
                {location.lon.toFixed(6)}
              </Text>

              <Text style={styles.statusMeta}>
                Accuracy: ±
                {Math.round(location.accuracy)} m
              </Text>
            </View>
          </View>
        </View>

        <View
          style={styles.infoCard}
          onLayout={(event) => {
            faceCardY.current =
              event.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.cardTitle}>
            Face Verification
          </Text>

          {!showCamera ? (
            <View style={styles.statusCardRow}>
              <View
                style={[
                  styles.largeSoftIcon,
                  (!inside ||
                    verificationLocked) &&
                    styles.dangerSoftBackground,
                ]}
              >
                <MaterialCommunityIcons
                  name="face-recognition"
                  size={44}
                  color={
                    !inside ||
                    verificationLocked
                      ? Colors.danger
                      : Colors.primary
                  }
                />
              </View>

              <View style={styles.statusTextWrap}>
                <Text
                  style={[
                    styles.faceReadyTitle,
                    (!inside ||
                      verificationLocked) &&
                      styles.faceUnavailableTitle,
                  ]}
                >
                  {!inside
                    ? "Not available"
                    : verificationLocked
                      ? "Verification locked"
                      : "Ready to verify"}
                </Text>

                <Text style={styles.faceReadyText}>
                  {!inside
                    ? "Move inside the classroom boundary to enable face verification."
                    : verificationLocked
                      ? "You have used all 3 verification attempts. Log out and log in again to retry."
                      : "Your face will be matched for attendance when you start check-in."}
                </Text>

                {!inside && (
                  <View
                    style={
                      styles.waitingBadge
                    }
                  >
                    <Text
                      style={
                        styles.waitingBadgeText
                      }
                    >
                      Waiting for location
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.cameraHelper}>
                Keep your face centered and follow
                the instructions that appear below.
              </Text>

              <View style={styles.cameraFrame}>
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing="front"
                  mode="picture"
                  animateShutter={false}
                  onCameraReady={() => {
                    setCameraReady(true);
                    console.log("CAMERA READY");
                    setStatus("Camera ready");
                  }}
                />

                {phase === "countdown" &&
                  countdown !== null && (
                    <View
                      pointerEvents="none"
                      style={
                        styles.livenessCameraOverlay
                      }
                    >
                      <Text
                        style={
                          styles.livenessTitle
                        }
                      >
                        Face matched successfully
                      </Text>

                      <Text
                        style={
                          styles.livenessSubtitle
                        }
                      >
                        Liveness test starts in
                      </Text>

                      <Text
                        style={
                          styles.livenessCountdown
                        }
                      >
                        {countdown}
                      </Text>

                      <Text
                        style={
                          styles.livenessSubtitle
                        }
                      >
                        Keep your face inside the
                        frame
                      </Text>
                    </View>
                  )}

                {phase === "liveness" && (
                  <View
                    pointerEvents="none"
                    style={
                      styles.challengeCameraOverlay
                    }
                  >
                    <Text
                      style={
                        styles.challengeCameraText
                      }
                    >
                      {challenge}
                    </Text>
                  </View>
                )}

                <View
                  pointerEvents="none"
                  style={[
                    styles.faceGuideOverlay,
                    {
                      borderColor:
                        faceDetected
                          ? Colors.success
                          : Colors.surface,
                    },
                  ]}
                />
              </View>

              <View
                style={
                  styles.scanInstructionCard
                }
              >
                <View style={styles.scanFeedback}>
                  {scanning && (
                    <ActivityIndicator
                      size="small"
                      color={Colors.primary}
                    />
                  )}

                  <Text
                    style={
                      styles.scanFeedbackText
                    }
                  >
                    {status}
                  </Text>
                </View>

                {phase === "liveness" &&
                  !!challenge && (
                    <View
                      style={
                        styles.challengeRow
                      }
                    >
                      <Ionicons
                        name="scan-outline"
                        size={22}
                        color={Colors.primary}
                      />

                      <Text
                        style={
                          styles.challengeInstruction
                        }
                      >
                        {challenge}
                      </Text>
                    </View>
                  )}
              </View>

              <Pressable
                onPress={() =>
                  void scanAndCheckIn()
                }
                disabled={
                  !cameraReady ||
                  scanning
                }
                style={[
                  styles.primaryButton,
                  scanning &&
                    styles.disabledButton,
                ]}
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  {scanning
                    ? "Verifying..."
                    : "Verify Face & Check In"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  void closeCamera()
                }
                style={
                  styles.secondaryButton
                }
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Close Camera
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {!showCamera && (
          <Pressable
            onPress={() =>
              void openCamera()
            }
            disabled={
              !canCheckIn ||
              scanning
            }
            style={[
              styles.startButton,
              (!canCheckIn ||
                scanning) &&
                styles.startButtonDisabled,
            ]}
          >
            <Text style={styles.startButtonText}>
              Start Check-In
            </Text>

            <Ionicons
              name="arrow-forward"
              size={28}
              color={Colors.surface}
            />
          </Pressable>
        )}

        <View style={styles.privacyRow}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={Colors.textSecondary}
          />

          <Text style={styles.privacyText}>
            Location is only checked during active
            class sessions.
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={24}
              color={Colors.danger}
            />

            <View style={styles.errorTextWrap}>
              <Text style={styles.errorTitle}>
                Check-in unsuccessful
              </Text>

              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
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
            {checkedIn
              ? "Attendance Status"
              : "Check In"}
          </Text>
        </View>

        <Ionicons
          name="person-outline"
          size={30}
          color={Colors.textSecondary}
        />
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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

  statusCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },

  largeSoftIcon: {
    width: 94,
    height: 94,
    borderRadius: Radius.pill,
    backgroundColor:
      Colors.featureIconBackground,
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
    minWidth: 0,
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

  faceUnavailableTitle: {
    color: Colors.danger,
  },

  waitingBadge: {
    alignSelf: "flex-start",
    backgroundColor:
      Colors.disabledSurface,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },

  waitingBadgeText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },

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

  livenessCameraOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: Colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  livenessTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.surface,
    textAlign: "center",
  },

  livenessSubtitle: {
    fontSize: 14,
    color: Colors.surface,
    textAlign: "center",
    marginTop: 8,
  },

  livenessCountdown: {
    fontSize: 82,
    fontWeight: "900",
    color: Colors.surface,
    marginVertical: 8,
  },

  challengeCameraOverlay: {
    position: "absolute",
    top: 12,
    left: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
    padding: 12,
    alignItems: "center",
  },

  challengeCameraText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  faceGuideOverlay: {
    position: "absolute",
    top: "9%",
    bottom: "9%",
    left: "17%",
    right: "17%",
    borderWidth: 3,
    borderRadius: 160,
  },

  scanInstructionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: Spacing.md,
  },

  challengeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },

  challengeInstruction: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  scanFeedback: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 24,
  },

  scanFeedbackText: {
    color: Colors.textSecondary,
    fontSize: 14,
    flexShrink: 1,
    textAlign: "center",
  },

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

  outsideIconOuter: {
    backgroundColor: Colors.dangerSoft,
  },

  outsideIconInner: {
    borderColor: Colors.danger,
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

  dangerBadge: {
    backgroundColor: Colors.dangerSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },

  dangerBadgeText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: "800",
  },

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
    backgroundColor:
      Colors.featureIconBackground,
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

  doneButtonText: {
    color: Colors.primary,
    fontSize: 17,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.5,
  },

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
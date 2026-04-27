
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, useMemo, useRef } from "react";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions} from "expo-camera";

const API_BASE = 
    Platform.OS === "web" 
    ? "http://192.168.50.206:8000"
    : Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://192.168.50.206:8000";

    // Demo classroom geofence coordinates for attendance validation
    const CLASS_LAT = 33.18584015274567; //change to lat of location wanted
    const CLASS_LON = -96.805340872654; //change to lon of location
    const GEOFENCE_RADIUS_M = 75;

    function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
        
        const R = 6371000; // Earth radius in meters
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
    }

    type FaceCheckResult = {
      ok?: boolean;
      error?: string;
      face_detected?: number;
      reason?: string;
      detail?: any;
    }

export default function CheckInScreen()
{
    const router = useRouter();
    const cameraRef = useRef<any>(null);

    const [session, setSession] = useState<Session | null>(null);
    const [loc, setLoc] = useState<UserLoation | null>(null);
    const [result, setResult] = useState<CheckInResult | null>(null);
    const [faceResult, setFaceResult] = useState<FaceCheckResult | null>(null);

    const [permisssionStatus, setPermissionStatus] = useState < "unknown" | "granted" | "denied" > ("unknown");
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
            }
            catch (err: any){
                setStatus("Error: " + err.message);
            }
            finally {
                setIsBootLoading(false);
            }
        }

  async function requestLocationPermission() {
    try {
      console.log("========== LOCATION PERMISSION START ==========");

      setStatus("Checking location services...");

      // Debug 1:
      // Verify phone GPS/location services are physically enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();

      console.log("LOCATION SERVICES ENABLED:", servicesEnabled);

      if (!servicesEnabled) {
        console.log("DEBUG: Device location services are OFF");

        setPermissionStatus("denied");
        setStatus("Location services are turned off on this device.");

        return false;
      }

      setStatus("Requesting location permission...");

      // Debug 2:
      // Ask Expo Go for foreground location permission
      const { status, canAskAgain, granted, expires } =
        await Location.requestForegroundPermissionsAsync();

      console.log("LOCATION PERMISSION RESPONSE:", {
        status,
        granted,
        canAskAgain,
        expires,
      });

      // Debug 3:
      // Permission denied by user or blocked in settings
      if (status !== "granted") {
        console.log("DEBUG: Permission was NOT granted");

        setPermissionStatus("denied");

        if (!canAskAgain) {
          console.log(
            "DEBUG: Permission permanently blocked — must enable in phone settings"
          );

          setStatus(
            "Location permission is blocked. Enable it in phone settings."
          );
        } 
        else {
        console.log("DEBUG: User denied permission");

        setStatus("Location permission denied.");
      }

      return false;
    }

      // Debug 4:
      // Permission success
      console.log("DEBUG: Location permission GRANTED");

      setPermissionStatus("granted");
      setStatus("Location permission granted.");

      console.log("========== LOCATION PERMISSION SUCCESS ==========");

      return true;
    } 
      catch (err: any) {
      // Debug 5:
      // Unexpected Expo/internal error
      console.log("========== LOCATION PERMISSION ERROR ==========");
      console.log("FULL ERROR OBJECT:", err);
      console.log("ERROR MESSAGE:", err?.message);
      console.log("ERROR STACK:", err?.stack);

      setPermissionStatus("denied");
      setStatus(`Permission error: ${err?.message || "Unknown error"}`);

      return false;
    }
  }

        async function fetchSession() {

          try{
            setStatus("Creating session...");

            const res = await fetch(`${API_BASE}/session`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                course_id: 1,
                session_date: new Date().toISOString().split("T")[0],
                start_time: "00:00",
                end_time: "23:59",
              }),
            });

            if (!res.ok) {
              throw new Error("Failed to create session");
            }

            const data = await res.json();

            console.log("Session created:", data);

            setSession(data);
            setStatus("Session ready");
          }

          catch (err) {
            console.error(err);
            setStatus("Session error");
          }

        }

        async function getUserLocation(refresh = false) {

            try{
                if (refresh) {
                    setIsRefreshingLocation(true);
                    setStatus("Refreshing location...");
                }

                else {
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

        //Sends captured photo to backedn face API
        //Current logic only checks if a face exists in the image (doesnt actually work)
        //Replace this later with full facial recognition logic
        async function sendToFaceAPI(photoUri: string) {
          const formData = new FormData();

          formData.append("file", {
            uri: photoUri,
            name: "photo.jpg",
            type: "image/jpeg",
          } as any);

          const res = await fetch(`${API_BASE}/face/check`, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data?.detail || data.error || "Face check failed");
          }

          return data;

        }

        // Sends location data to backend for geofence validation before attendance check-in
        async function submitAttendanceCheckIn() {
          if (!loc) return;

        const formData = new FormData();

        formData.append("user_id", "1");
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
          reason: data.location_verified
          ? "Location verified"
          : "Outside allowed geofence",
          distance_m: data.distance_m,
          allowed_distance_m: data.allowed_radius_m,
        });

        setStatus(data.location_verified ? "Geofence verified" : "Outside geofence");
      }

        //Opens camera flow after geofence validation passes
        //User must be inside allwed classroom radius before camera opens
        //Camera permission is requested here if not already gratned
        async function openCameraFlow() {
          if(!inside) return;

          setResult(null);
          setFaceResult(null);

          if(!cameraPermission) {
            setStatus("Checking camera permission...");
            return;
          }

          if(!cameraPermission.granted) {
            setStatus("Requesting camera permission...")
            const response = await requestCameraPermission();

            if(!response.granted) {
              setStatus("Camera permission denied.");
              return;
            }
          }

          setShowCamera(true);
          setStatus("Cemera ready");
        }

        //Captures live photo from front camera
        //If no face is detected -> block attendance check-in (Does not actually work)
        //If face is detected -> continue to submit attendance
        //Replace face detection section here with actual biometric comparison logic
        async function captureFaceAndCheckIn() {
          if(!cameraRef.current || !loc || !inside) return;

          try{
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
            const faceData = await sendToFaceAPI(photo.uri);
            setFaceResult(faceData);

            if(!faceData?.face_detected || faceData.face_detected < 1) {
              setStatus("No face detected");
              setResult({
                ok: false,
                reason: "No face detected. Please try again.",
              });
              return;
            }

            setStatus("Face detected. Submitting check-in...");
            await submitAttendanceCheckIn();
          }

          catch ( err: any) {
            setResult({
              ok: false,
              reason: err.message || "Face verification fialed",
            });
            setStatus("Check-in fialed");
          }

          finally {
            setIsuploadingFace(false);
            setIsCheckingIn(false);
          }
        }

        // Calculate live distance between student location and classroom geofence center
        const distance = useMemo(() => {

            if(!loc) return null;
            return haversineMeters(
              loc.lat,
              loc.lon,
              CLASS_LAT,
              CLASS_LON
            );
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
                        <ActivityIndicator size={"large"} />
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
          <Text style={styles.statusIcon}>
            {inside ? "✓" : "✕"}
          </Text>

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
          style={[
            styles.secondaryButton,
            isRefreshingLocation && styles.disabledButton,
          ]}
        >
          <Text style={styles.secondaryButtonText}>
            {isRefreshingLocation ? "Refreshing..." : "Refresh Location"}
          </Text>
        </Pressable>

        <Pressable
          onPress={openCameraFlow}
          disabled={!inside || isCheckingIn}
          style={[
            styles.checkInButton,
            (!inside || isCheckingIn) && styles.disabledButton,
          ]}
        >
          <Text style={styles.checkInButtonText}>
            Continue to Face Scan
          </Text>
        </Pressable>

        <Text style={styles.lastAttendance}>
          Last Attendance: 03/06
        </Text>
      </>
    ) : (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Face Verification</Text>

        {!cameraPermission?.granted ? (
          <View style={styles.centerContent}>
            <Text style={styles.cardText}>
              Camera permission is required to continue.
            </Text>

            <Pressable
              style={styles.checkInButton}
              onPress={openCameraFlow}
            >
              <Text style={styles.checkInButtonText}>
                Allow Camera
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
            />

            <Pressable
              onPress={captureFaceAndCheckIn}
              disabled={isUploadingFace || isCheckingIn}
              style={[
                styles.checkInButton,
                (isUploadingFace || isCheckingIn) &&
                  styles.disabledButton,
              ]}
            >
              <Text style={styles.checkInButtonText}>
                {isUploadingFace || isCheckingIn
                  ? "Verifying..."
                  : "Capture Face & Check In"}
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
              <Text style={styles.secondaryButtonText}>
                Close Camera
              </Text>
            </Pressable>
          </>
        )}
      </View>
    )}

    {result && (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Check-In Result</Text>
        <Text style={styles.cardText}>{result.reason}</Text>
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

        <Image
          source={require("../assets/logo.png")}
          style={styles.headerLogo}
        />
      </View>

      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
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
  backButton: {
    width: 40,
  },
  backButtonText: {
    fontSize: 26,
    fontWeight: "bold",
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
  },
  headerLogo: {
    width: 45,
    height: 45,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  mainContent: {
    gap: 14,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    marginBottom: 4,
    color: "#333",
  },
  statusText: {
    fontSize: 15,
    color: "#444",
    marginBottom: 8,
  },
  geofenceStatus: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "bold",
  },
  camera: {
    width: "100%",
    height: 320,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#000",
  },
  primaryButton: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "white",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  classTitle: {
  fontSize: 24,
  fontWeight: "bold",
  color: "#15803d",
  textAlign: "center",
},

classRoom: {
  fontSize: 16,
  color: "#444",
  marginBottom: 30,
  textAlign: "center",
},

statusCircle: {
  width: 180,
  height: 180,
  borderRadius: 90,
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 24,
  alignSelf: "center",
},

insideCircle: {
  backgroundColor: "#16a34a",
},

outsideCircle: {
  backgroundColor: "#dc2626",
},

statusIcon: {
  fontSize: 52,
  color: "white",
  fontWeight: "bold",
},

statusLabel: {
  color: "white",
  fontSize: 16,
  fontWeight: "bold",
  textAlign: "center",
  marginTop: 10,
},

sessionText: {
  fontSize: 16,
  textAlign: "center",
  marginBottom: 24,
  color: "#166534",
  fontWeight: "600",
},

checkInButton: {
  backgroundColor: "#15803d",
  paddingVertical: 16,
  borderRadius: 30,
  alignItems: "center",
  marginTop: 10,
},

checkInButtonText: {
  color: "white",
  fontSize: 17,
  fontWeight: "bold",
},

lastAttendance: {
  marginTop: 24,
  textAlign: "center",
  fontSize: 14,
  color: "#444",
  fontWeight: "600",
},
});
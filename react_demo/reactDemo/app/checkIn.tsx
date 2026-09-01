
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, useMemo, useRef } from "react";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions} from "expo-camera";


  import { API_BASE } from "../constants/api";


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
    };

    type FaceCheckResult = {
      ok?: boolean;
      error?: string;
      face_detected?: number;
      reason?: string;
      detail?: any;
    };

    type GeofenceResult = {
      inside: boolean;
      allow_biometric: boolean;
      reason: string;
      radius_m?: number;
      accuracy_buffer_m?: number;
      allowed_radius_m?: number;
      engine?: string;
    };

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

    const [inside, setInside] = useState(false);
    const [geofenceResult, setGeofenceResult] = useState<GeofenceResult | null>(null);

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
            const res = await fetch(`${API_BASE}/geofence/session`);

            if (!res.ok) {
                throw new Error("Failed to fetch session");
            }

            const data = await res.json();
            setSession(data);
        }

        async function verifyGeofence(currentLoc: UserLoation) {
          try{
            setStatus("Checking geofence...");

            const res = await fetch(`${API_BASE}/geofence/check`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                lat: currentLoc.lat,
                lon: currentLoc.lon,
                accuracy_m: currentLoc.accuracy,
              }),
            });

            const data: GeofenceResult = await res.json();

            if(!res.ok) {
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

            try{
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

        async function submitAttendanceCheckIn() {
          if(!loc || !inside) return;

          const payload = {
            student_id: "student-123",
            lat: Number(loc.lat),
            lon: Number(loc.lon),
            accuracy_m: Number(loc.accuracy),
          };

          const res = await fetch(`${API_BASE}/checkin`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const data = await res.json();

          if(!res.ok) {
            setResult({
              ok: false,
              reason: data?.detail ? JSON.stringify(data.detail) : "Server error",
            });
            setStatus("Check-in failed");
            return;
          }

          setResult(data);
          setStatus(data.ok ? "Check-in complete" : "Check-in rejected");

        }

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
        <Text style={styles.statusText}>Status: {status}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session</Text>
          <Text style={styles.cardText}>ID: {session.id}</Text>
          <Text style={styles.cardText}>Radius: {session.radius_m} m</Text>
          <Text style={styles.cardText}>Open: {String(session.is_open)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Location</Text>
          <Text style={styles.cardText}>Latitude: {loc.lat}</Text>
          <Text style={styles.cardText}>Longitude: {loc.lon}</Text>
          <Text style={styles.cardText}>
            Accuracy: {Number(loc.accuracy).toFixed(1)} m
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fence Check</Text>
          <Text
            style={[
              styles.geofenceStatus,
              { color: inside ? "#15803d" : "#b91c1c" },
            ]}
          >
            {inside ? "INSIDE GEOFENCE" : "OUTSIDE GEOFENCE"}
          </Text>
        </View>

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

        {!showCamera ? (
          <Pressable
            onPress={openCameraFlow}
            disabled={!inside || isCheckingIn}
            style={[
              styles.primaryButton,
              (!inside || isCheckingIn) && styles.disabledButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              Continue to Face Scan
            </Text>
          </Pressable>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Face Verification</Text>

            {!cameraPermission?.granted ? (
              <View style={styles.centerContent}>
                <Text style={styles.cardText}>
                  Camera permission is required to continue.
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={openCameraFlow}
                >
                  <Text style={styles.primaryButtonText}>Allow Camera</Text>
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
                    styles.primaryButton,
                    (isUploadingFace || isCheckingIn) && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
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
                  <Text style={styles.secondaryButtonText}>Close Camera</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {faceResult && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Face Result</Text>
            <Text style={styles.cardText}>
              Faces Detected: {String(faceResult.face_detected ?? 0)}
            </Text>
            {faceResult.error ? (
              <Text style={styles.cardText}>Error: {faceResult.error}</Text>
            ) : null}
          </View>
        )}

        {result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Server Result</Text>
            <Text style={styles.cardText}>OK: {String(result.ok)}</Text>
            <Text style={styles.cardText}>Reason: {result.reason}</Text>

            {typeof result.distance_m === "number" && (
              <Text style={styles.cardText}>
                Distance: {result.distance_m.toFixed(1)} m
              </Text>
            )}

            {typeof result.allowed_distance_m === "number" && (
              <Text style={styles.cardText}>
                Allowed Distance: {result.allowed_distance_m.toFixed(1)} m
              </Text>
            )}

            {result.server_time && (
              <Text style={styles.cardText}>
                Server Time: {result.server_time}
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
          <Text style={styles.backButtonText}>{"<"}</Text>
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
});
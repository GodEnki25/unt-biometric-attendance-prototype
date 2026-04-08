
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, useMemo, use } from "react";
import * as Location from "expo-location";

const API_BASE = 
    Platform.OS === "web" 
    ? "http://localhost:8000"
    : Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://localhost:8000";

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

export default function CheckInScreen()
{
    const router = useRouter();

    const [session, setSession] = useState<Session | null>(null);
    const [loc, setLoc] = useState<UserLoation | null>(null);
    const [result, setResult] = useState<CheckInResult | null>(null);

    const [permisssionStatus, setPermissionStatus] = useState < "unknown" | "granted" | "denied" > ("unknown");
    const [status, setStatus] = useState("Starting...");
    const [isBootLoading, setIsBootLoading] = useState(true);
    const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
    const [isCheckingIn, setIsCheckingIn] = useState(false);

    useEffect(() => {
        initializeApp();
        }, []);

        async function initializeApp() {
            try {
                setIsBootLoading(true);
                setResult(null);

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
            const res = await fetch(`${API_BASE}/session`);

            if (!res.ok) {
                throw new Error("Failed to fetch session");
            }

            const data = await res.json();
            setSession(data);
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
            await initializeApp();
        }

        async function checkIn() {
            if (!loc || !inside) return;
        

            try {
             setIsCheckingIn(true);
             setStatus("Submitting check-in");

                const payload = {

                    student_id: "student-123",
                    lat: Number(loc?.lat),
                    lon: Number(loc?.lon),
                    accuracy_m: Number(loc?.accuracy)
                };

                const res = await fetch (`${API_BASE}/checkin`, {
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

            catch (err: any) {

                setResult({
                    ok: false,
                 reason: err.message || "Request failed",
                });

                setStatus("Check-in failed");
            }

            finally {
                setIsCheckingIn(false);
            }
        }
    
        const distance = useMemo(() => {

            if (!session || !loc) return null;
            return haversineMeters (
                loc.lat,
                loc.lon,
                session.center_lat,
                session.center_lon
            );
        }, [session, loc]);

        const allowed = useMemo(() => {

            if(!session || !loc) return null;
            return session.radius_m + Math.min(loc.accuracy, 50);

        }, [session, loc]);

        const inside = distance !== null && allowed !== null && distance <= allowed;

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
          <Text style={styles.cardText}>ID: {session?.id}</Text>
          <Text style={styles.cardText}>Radius: {session?.radius_m} m</Text>
          <Text style={styles.cardText}>Open: {String(session?.is_open)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Location</Text>
          <Text style={styles.cardText}>Latitude: {loc?.lat}</Text>
          <Text style={styles.cardText}>Longitude: {loc?.lon}</Text>
          <Text style={styles.cardText}>
            Accuracy: {Number(loc?.accuracy).toFixed(1)} m
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fence Check</Text>
          <Text style={styles.cardText}>
            Distance: {distance?.toFixed(1)} m
          </Text>
          <Text style={styles.cardText}>
            Allowed: {allowed?.toFixed(1)} m
          </Text>
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

        <Pressable
          onPress={checkIn}
          disabled={!inside || isCheckingIn}
          style={[
            styles.primaryButton,
            (!inside || isCheckingIn) && styles.disabledButton,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isCheckingIn ? "Checking In..." : "Check In"}
          </Text>
        </Pressable>

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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  mainContent: {
    gap: 14,
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
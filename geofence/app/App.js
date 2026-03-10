import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, Text, View, Pressable, ActivityIndicator, Platform } from "react-native";
import * as Location from "expo-location";

const API_BASE =
  Platform.OS === "web"
  ? "http://localhost:8000"
  : Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://localhost:8000";

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
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

export default function App() {
  const [session, setSession] = useState(null);
  const [loc, setLoc] = useState(null);
  const [status, setStatus] = useState("Starting...");
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setStatus("Requesting location permission...");
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setStatus("Location permission denied");
        return;
      }

      setStatus("Fetching session...");
      const sessionRes = await fetch(`${API_BASE}/session`);
      const sessionData = await sessionRes.json();
      setSession(sessionData);

      setStatus("Getting location...");
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLoc({
        lat: current.coords.latitude,
        lon: current.coords.longitude,
        accuracy: current.coords.accuracy ?? 999,
      });

      setStatus("Ready");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  async function refreshLocation() {
    try {
      setStatus("Refreshing location...");
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLoc({
        lat: current.coords.latitude,
        lon: current.coords.longitude,
        accuracy: current.coords.accuracy ?? 999,
      });

      setStatus("Ready");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

async function checkIn() {
  if (!loc) return;

  try {
    const payload = {
      student_id: "student-123",
      lat: Number(loc.lat),
      lon: Number(loc.lon),
      accuracy_m: Number(loc.accuracy),
    };

    console.log("Sending payload:", payload);

    const res = await fetch(`${API_BASE}/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("Server response:", data);

    if (!res.ok) {
      setResult({
        ok: false,
        reason: data?.detail ? JSON.stringify(data.detail) : "Server error",
      });
      return;
    }

    setResult(data);
  } catch (err) {
    setResult({
      ok: false,
      reason: err.message || "Request failed",
    });
  }
}

  const distance = useMemo(() => {
    if (!session || !loc) return null;
    return haversineMeters(loc.lat, loc.lon, session.center_lat, session.center_lon);
  }, [session, loc]);

  const allowed = useMemo(() => {
    if (!session || !loc) return null;
    return session.radius_m + Math.min(loc.accuracy, 50);
  }, [session, loc]);

  const inside = distance !== null && allowed !== null && distance <= allowed;

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: "bold", marginBottom: 20 }}>
        Geofence Attendance
      </Text>

      <Text style={{ marginBottom: 15 }}>Status: {status}</Text>

      {!session || !loc ? (
        <ActivityIndicator size="large" />
      ) : (
        <View style={{ gap: 14 }}>
          <View style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}>
            <Text style={{ fontWeight: "bold" }}>Session</Text>
            <Text>ID: {session.id}</Text>
            <Text>Radius: {session.radius_m} m</Text>
            <Text>Open: {String(session.is_open)}</Text>
          </View>

          <View style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}>
            <Text style={{ fontWeight: "bold" }}>Your Location</Text>
            <Text>Latitude: {loc.lat}</Text>
            <Text>Longitude: {loc.lon}</Text>
            <Text>Accuracy: {Number(loc.accuracy).toFixed(1)} m</Text>
          </View>

          <View style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}>
            <Text style={{ fontWeight: "bold" }}>Fence Check</Text>
            <Text>Distance: {distance.toFixed(1)} m</Text>
            <Text>Allowed: {allowed.toFixed(1)} m</Text>
            <Text style={{ fontWeight: "bold", marginTop: 6 }}>
              {inside ? "INSIDE GEOFENCE" : "OUTSIDE GEOFENCE"}
            </Text>
          </View>

          <Pressable
            onPress={refreshLocation}
            style={{
              borderWidth: 1,
              borderRadius: 10,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text>Refresh Location</Text>
          </Pressable>

          <Pressable
            onPress={checkIn}
            disabled={!inside}
            style={{
              borderWidth: 1,
              borderRadius: 10,
              padding: 14,
              alignItems: "center",
              opacity: inside ? 1 : 0.5,
            }}
          >
            <Text>Check In</Text>
          </Pressable>

          {result && (
            <View style={{ borderWidth: 1, borderRadius: 10, padding: 12 }}>
              <Text style={{ fontWeight: "bold" }}>Server Result</Text>
              <Text>OK: {String(result?.ok)}</Text>
              <Text>Reason: {result?.reason ?? "No reason returned"}</Text>
              
              {typeof result?.distance_m === "number" && (
                <Text>Distance: {Number(result.distance_m).toFixed(1)} m</Text>
              )}

              {typeof result?.allowed_distance_m === "number" && (
                <Text>Allowed Distance: {Number(result.allowed_distance_m).toFixed(1)} m</Text>
              )}

              {result?.server_time && (
                <Text>Server Time: {result.server_time}</Text>
              )}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
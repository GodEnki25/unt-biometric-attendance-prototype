import { View, Text, StyleSheet, Pressable, Image, ImageBackground, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useState, useRef } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://192.168.1.252:8000";

export default function FaceEnrollScreen() {
  const router = useRouter();
  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [status, setStatus] = useState("");

  async function openCamera() {
    if (!cameraPermission?.granted) {
      const response = await requestCameraPermission();
      if (!response.granted) {
        Alert.alert("Permission denied", "Camera access is required.");
        return;
      }
    }
    setShowCamera(true);
  }

  async function captureAndEnroll() {
    if (!cameraRef.current) return;

    try {
      setIsEnrolling(true);
      setStatus("Capturing face...");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      setStatus("Enrolling face...");

      let userId = await AsyncStorage.getItem("user_id");
      if (!userId) {
      // Temporary: hardcode for testing
    userId = "3"; // Sorel Agbogla's user_id
    await AsyncStorage.setItem("user_id", userId);
}

     // const userId = await AsyncStorage.getItem("user_id");
      //if (!userId) {
       // Alert.alert("Error", "User not logged in.");
       //return;
     // }

      const formData = new FormData();
      formData.append("user_id", userId);
      formData.append("file", {
        uri: photo.uri,
        name: "enroll.jpg",
        type: "image/jpeg",
      } as any);

      const res = await fetch(`${API_BASE}/face/enroll`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        Alert.alert("Enrollment Failed", data.error || "Please try again.");
        setStatus("");
        return;
      }

      Alert.alert("Success!", "Your face has been enrolled.", [
        { text: "Continue", onPress: () => router.replace("/dashboard") }
      ]);

    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
      setStatus("");
    } finally {
      setIsEnrolling(false);
    }
  }

  return (
    <ImageBackground
      source={require("../assets/background.png")}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{"⬅"}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Face Enrollment</Text>
          <Image source={require("../assets/logo.png")} style={styles.headerLogo} />
        </View>

        <View style={styles.content}>
          {!showCamera ? (
            <View style={styles.box}>
              <Text style={styles.title}>Enroll Your Face</Text>
              <Text style={styles.message}>
                Position your face clearly in the camera. Make sure you are in good lighting.
              </Text>
              <Pressable style={styles.acceptButton} onPress={openCamera}>
                <Text style={styles.buttonText}>Open Camera</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.box}>
              <Text style={styles.title}>Face Enrollment</Text>

              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
              />

              {status ? <Text style={styles.statusText}>{status}</Text> : null}

              <Pressable
                style={[styles.acceptButton, isEnrolling && { opacity: 0.6 }]}
                onPress={captureAndEnroll}
                disabled={isEnrolling}
              >
                {isEnrolling
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.buttonText}>Capture & Enroll</Text>
                }
              </Pressable>

              <Pressable
                style={styles.declineButton}
                onPress={() => setShowCamera(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  backgroundImage: { transform: [{ scale: 1.3 }] },
  container: { flex: 1 },
  header: {
    height: 90,
    backgroundColor: "#0f5c00",
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    flexDirection: "row",
  },
  backButton: { width: 40 },
  backButtonText: { fontSize: 26, fontWeight: "bold", color: "white" },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "bold", textAlign: "center", color: "white" },
  headerLogo: { width: 45, height: 45, borderRadius: 8 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  box: {
    width: "100%",
    maxWidth: 350,
    padding: 25,
    borderRadius: 12,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  message: { fontSize: 16, textAlign: "center", marginBottom: 20 },
  camera: {
    width: "100%",
    height: 280,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#000",
  },
  statusText: { textAlign: "center", color: "#444", marginBottom: 10 },
  acceptButton: {
    backgroundColor: "green",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  declineButton: {
    backgroundColor: "red",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
});
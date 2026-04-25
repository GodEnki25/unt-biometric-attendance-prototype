
import { View, Text, StyleSheet, Pressable, Image, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { CameraView } from "expo-camera";

export default function FaceEnrollScreen()
{
    const router = useRouter();
    const [captureCount, setCaptureCount] = useState(0);

    function handleCapture() {
        const nextCount = captureCount + 1;
        setCaptureCount(nextCount);

        if (nextCount >= 3) {
            router.push("/login");
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

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.headerLogo}
                />
            </View>

            <View style={styles.content}>
                <View style={styles.cameraBox}>
                    <CameraView style={styles.cameraPreview} facing="front" />
                </View>

                <Pressable style={styles.captureButton} onPress={handleCapture}>
                    <Text style={styles.captureButtonText}>Capture</Text>
                </Pressable>
                <Text style={styles.capturedImageCount}>Image Captured: {captureCount} / 3</Text>
            </View>
        </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,

    },
    backgroundImage: {
        transform: [{ scale:1.3 }]
    },
    container: {
        flex: 1,
        
    },


    header: {
        height: 90,
        backgroundColor: "#0f5c00",
        paddingHorizontal: 20,
        paddingTop: 40,
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        flexDirection: "row"
    },
    backButton: {
        width: 40
    },
    backButtonText: {
        fontSize: 26,
        fontWeight: "bold",
        color: "white"
    },
    headerTitle: {
        flex: 1,
        fontSize: 22,
        fontWeight: "bold",
        textAlign: "center",
        color: "white"
    },
    headerLogo: {
        width: 45,
        height: 45,
        borderRadius: 8
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20
    },
    cameraBox: {
        width: "100%",
        maxWidth: 380,
        height: 400,
        borderRadius: 20,
        overflow: "hidden",
        marginBottom: 90,
        backgroundColor: "#000"
    },
    cameraPreview: {
        flex: 1,
    },
    captureButton: {
        backgroundColor: "#0f5c00",
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 10,
        marginBottom: 20,
        alignItems: "center"
    },
    captureButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold"
    },
    capturedImageCount: {
        color: "#0a3a00",
        fontSize: 42,
        fontWeight: "bold"
    }
});
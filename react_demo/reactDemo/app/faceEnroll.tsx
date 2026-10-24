
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import { API_BASE } from "../constants/api";

const MAX_ATTEMPTS = 35;

export default function FaceEnrollScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const userId = params.userId?.toString();

    const [permission, requestPermission] = useCameraPermissions();
    const [cameraReady, setCameraReady] = useState(false);
    const [statusMessage, setStatusMessage] = useState(
        "Position your face inside the frame"
    );

    const cameraRef = useRef<CameraView | null>(null);
    const isCapturing = useRef(false);
    const stopScanning = useRef(false);

    async function captureFaceScan() {
        if (
            stopScanning.current ||
            isCapturing.current ||
            !cameraReady ||
            !cameraRef.current
        ) {
            return;
        }

        if (!userId) {
            setStatusMessage("User information missing");
            return;
        }

        isCapturing.current = true;

        let sessionStarted = false;
        let completed = false;
        let token: string | null = null;

        try {
            setStatusMessage("Preparing face scan...");

            token = await SecureStore.getItemAsync("access_token");

            if (!token) {
                throw new Error(
                    "Authentication required. Please log in again."
                );
            }

            if (stopScanning.current) return;

            const headers = {
                Authorization: `Bearer ${token}`
            };

            const startResponse = await expoFetch(
                `${API_BASE}/enroll/start`,
                {
                    method: "POST",
                    headers
                }
            );

            if (!startResponse.ok) {
                throw new Error(
                    `Unable to start enrollment (HTTP ${startResponse.status}).`
                );
            }

            const startResult = await startResponse.json();

            if (startResult.status !== "ready") {
                throw new Error(
                    startResult.message ?? "Enrollment could not start."
                );
            }

            sessionStarted = true;

            if (stopScanning.current) return;

            setStatusMessage("Scanning face...");

            for (
                let attempt = 0;
                attempt < MAX_ATTEMPTS;
                attempt++
            ) {
                if (
                    stopScanning.current ||
                    !cameraRef.current
                ) {
                    break;
                }

                let photoFile: File | null = null;

                try {
                    const photo =
                        await cameraRef.current.takePictureAsync({
                            quality: 0.55,
                            skipProcessing: false,
                            shutterSound: false
                        });

                    if (!photo?.uri) continue;

                    photoFile = new File(photo.uri);

                    if (stopScanning.current) break;

                    const formData = new FormData();

                    formData.append("file", photoFile);

                    const response = await expoFetch(
                        `${API_BASE}/enroll/frame`,
                        {
                            method: "POST",
                            headers,
                            body: formData
                        }
                    );

                    if (!response.ok) {
                        throw new Error(
                            `Frame upload failed (HTTP ${response.status}).`
                        );
                    }

                    const result = await response.json();

                    console.log(
                        "Enrollment frame:",
                        attempt + 1,
                        result.status,
                        result.captures
                    );

                    if (stopScanning.current) break;

                    switch (result.status) {
                        case "enrolled":
                            completed = true;
                            stopScanning.current = true;

                            setStatusMessage(
                                "Enrollment complete"
                            );

                            router.replace("/login");
                            return;

                        case "collecting":
                            setStatusMessage(
                                "Scanning face..."
                            );
                            break;

                        case "duplicate_frame":
                            setStatusMessage(
                                "Turn your head slightly"
                            );
                            break;

                        case "low_quality":
                            setStatusMessage(
                                "Improve lighting and hold steady"
                            );
                            break;

                        case "invalid_face_count":
                        case "no_face_detected":
                            setStatusMessage(
                                "Keep one face inside the guide"
                            );
                            break;

                        case "embedding_failed":
                        case "invalid_embedding":
                        case "invalid_frame":
                            setStatusMessage(
                                "Adjust your face and try again"
                            );
                            break;

                        case "inconsistent_embeddings":
                        case "session_not_started":
                        case "session_expired":
                        case "enrollment_error":
                            throw new Error(
                                result.message ??
                                "Enrollment session failed."
                            );

                        default:
                            setStatusMessage(
                                result.message ?? "Scanning face..."
                            );
                    }

                } finally {
                    if (photoFile) {
                        try {
                            if (photoFile.exists) {
                                photoFile.delete();
                            }
                        } catch (error) {
                            console.log(
                                "Temporary photo cleanup failed:",
                                error
                            );
                        }
                    }
                }
            }

            if (!stopScanning.current) {
                setStatusMessage(
                    "Scan incomplete. Go back and try again."
                );
            }

        } catch (error) {
            console.log("Enrollment scan error:", error);

            if (!stopScanning.current) {
                setStatusMessage(
                    error instanceof Error
                        ? error.message
                        : "Unable to scan face"
                );
            }

        } finally {
            if (sessionStarted && !completed && token) {
                try {
                    await expoFetch(
                        `${API_BASE}/enroll/cancel`,
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${token}`
                            }
                        }
                    );
                } catch (error) {
                    console.log(
                        "Enrollment session cleanup failed:",
                        error
                    );
                }
            }

            isCapturing.current = false;
        }
    }

    useEffect(() => {
        if (
            permission &&
            !permission.granted &&
            permission.canAskAgain
        ) {
            void requestPermission();
        }
    }, [
        permission?.granted,
        permission?.canAskAgain
    ]);

    useEffect(() => {
        if (
            !cameraReady ||
            !permission?.granted ||
            !userId
        ) {
            return;
        }

        stopScanning.current = false;

        void captureFaceScan();

        return () => {
            stopScanning.current = true;
        };
    }, [
        cameraReady,
        permission?.granted,
        userId
    ]);

    function handleBack() {
        stopScanning.current = true;
        router.back();
    }

    if (!permission) {
        return (
            <View style={styles.container}>
                <Text>Loading camera permission...</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>
                    Camera permission is required for face enrollment.
                </Text>

                <Pressable
                    style={styles.permissionButton}
                    onPress={requestPermission}
                >
                    <Text style={styles.permissionButtonText}>
                        Allow Camera
                    </Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable
                    onPress={handleBack}
                    style={styles.backButton}
                >
                    <Text style={styles.backButtonText}>
                        {"⬅"}
                    </Text>
                </Pressable>

                <Text style={styles.headerTitle}>
                    Face Enrollment
                </Text>

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.headerLogo}
                />
            </View>

            <View style={styles.content}>
                <View style={styles.cameraBox}>
                    <CameraView
                        ref={cameraRef}
                        style={styles.cameraPreview}
                        facing="front"
                        mode="picture"
                        animateShutter={false}
                        onCameraReady={() => {
                            console.log("Camera ready");
                            setCameraReady(true);
                        }}
                        onMountError={(error) => {
                            console.log(
                                "Camera mount error:",
                                error
                            );
                            setStatusMessage(
                                "Camera unavailable"
                            );
                        }}
                    />

                    <View
                        pointerEvents="none"
                        style={styles.faceGuide}
                    />
                </View>

                <Text style={styles.instructionText}>
                    {statusMessage}
                </Text>

                <View style={styles.scanIndicator}>
                    <ActivityIndicator size="small" color="#0a3a00" />
                    <Text style={styles.scanLabel}>
                        Secure face scan
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1
    },

    backgroundImage: {
        transform: [
            {
                scale: 1.3
            }
        ]
    },

    container: {
        flex: 1
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
        marginBottom: 30,
        backgroundColor: "#000",
        position: "relative"
    },

    cameraPreview: {
        flex: 1
    },

    faceGuide: {
        position: "absolute",
        width: 220,
        height: 280,
        top: 55,
        alignSelf: "center",
        borderWidth: 4,
        borderColor: "white",
        borderRadius: 120
    },

    instructionText: {
        color: "#0a3a00",
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 20,
        textAlign: "center"
    },

    scanIndicator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        minHeight: 40
    },

    scanLabel: {
        color: "#0a3a00",
        fontSize: 18,
        fontWeight: "600"
    },

    permissionContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 30
    },

    permissionText: {
        fontSize: 18,
        textAlign: "center",
        marginBottom: 25
    },

    permissionButton: {
        backgroundColor: "#0f5c00",
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 10
    },

    permissionButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold"
    }
});

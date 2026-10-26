import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
    ActivityIndicator
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import { API_BASE } from "../constants/api";

const MAX_ATTEMPTS = 35;

type GuideState =
    | "idle"
    | "valid"
    | "invalid";

export default function FaceEnrollScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const userId = params.userId?.toString();

    const [permission, requestPermission] = useCameraPermissions();
    const [cameraReady, setCameraReady] = useState(false);

    const [statusMessage, setStatusMessage] = useState(
        "Position your face inside the frame"
    );
    const [guideState, setGuideState] = useState<GuideState>("idle");
    const [isScanning, setIsScanning] = useState(false);
    const [scanLabel, setScanLabel] = useState("Secure face scan");

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
            setGuideState("invalid");
            setStatusMessage("User information missing");
            return;
        }

        isCapturing.current = true;
        setIsScanning(true);

        let sessionStarted = false;
        let completed = false;
        let token: string | null = null;

        try {
            setGuideState("idle");
            setStatusMessage("Preparing face scan...");
            setScanLabel("Starting enrollment");

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
            setScanLabel("Collecting secure samples");

            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
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
                            setGuideState("valid");
                            setStatusMessage("Enrollment complete");
                            setScanLabel("Face enrollment successful");
                            router.replace("/login");
                            return;

                        case "collecting":
                            setGuideState("valid");
                            setStatusMessage("Scanning face...");
                            setScanLabel("Hold steady while we scan");
                            break;

                        case "duplicate_frame":
                            setGuideState("invalid");
                            setStatusMessage("Turn your head slightly");
                            setScanLabel("Need a slightly different angle");
                            break;

                        case "low_quality":
                            setGuideState("invalid");
                            setStatusMessage("Improve lighting and hold steady");
                            setScanLabel("Image quality too low");
                            break;

                        case "invalid_face_count":
                        case "no_face_detected":
                            setGuideState("invalid");
                            setStatusMessage("Keep one face inside the guide");
                            setScanLabel("Only one face should be visible");
                            break;

                        case "embedding_failed":
                        case "invalid_embedding":
                        case "invalid_frame":
                            setGuideState("invalid");
                            setStatusMessage("Adjust your face and try again");
                            setScanLabel("Unable to capture a usable frame");
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
                            setGuideState("idle");
                            setStatusMessage(
                                result.message ?? "Scanning face..."
                            );
                            setScanLabel("Processing enrollment");
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
                setGuideState("invalid");
                setStatusMessage(
                    "Scan incomplete. Go back and try again."
                );
                setScanLabel("Enrollment timed out");
            }
        } catch (error) {
            console.log("Enrollment scan error:", error);

            if (!stopScanning.current) {
                setGuideState("invalid");
                setStatusMessage(
                    error instanceof Error
                        ? error.message
                        : "Unable to scan face"
                );
                setScanLabel("Enrollment failed");
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
            setIsScanning(false);
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
                <Text style={styles.pageTitle}>
                    Secure Enrollment
                </Text>

                <Text style={styles.pageSubtitle}>
                    Hold your face inside the guide while we scan.
                </Text>

                <View style={styles.cameraShell}>
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
                                setStatusMessage(
                                    "Position your face inside the frame"
                                );
                                setScanLabel("Camera ready");
                            }}
                            onMountError={(error) => {
                                console.log(
                                    "Camera mount error:",
                                    error
                                );
                                setGuideState("invalid");
                                setStatusMessage(
                                    "Camera unavailable"
                                );
                                setScanLabel("Camera error");
                            }}
                        />

                        <View
                            pointerEvents="none"
                            style={[
                                styles.faceGuide,
                                guideState === "valid" &&
                                    styles.faceGuideValid,
                                guideState === "invalid" &&
                                    styles.faceGuideInvalid
                            ]}
                        />

                        <View style={styles.topStatusPill}>
                            <Text style={styles.topStatusText}>
                                Live Scan
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.statusCard}>
                    <Text style={styles.statusTitle}>
                        {statusMessage}
                    </Text>

                    <Text style={styles.statusSubtext}>
                        {scanLabel}
                    </Text>

                    <View style={styles.scanIndicator}>
                        <ActivityIndicator
                            size="small"
                            color="#0a3a00"
                        />
                        <Text style={styles.scanLabel}>
                            {isScanning
                                ? "Scanning securely..."
                                : "Waiting to scan"}
                        </Text>
                    </View>
                </View>

                <View style={styles.tipCard}>
                    <Text style={styles.tipTitle}>
                        Tips
                    </Text>

                    <Text style={styles.tipText}>
                        • Keep only one face visible{"\n"}
                        • Look at the camera{"\n"}
                        • Make small head movements{"\n"}
                        • Use good lighting
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
        flex: 1,
        backgroundColor: "#f6f7f9"
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
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 24
    },

    pageTitle: {
        fontSize: 28,
        fontWeight: "800",
        color: "#0a3a00",
        marginBottom: 8
    },

    pageSubtitle: {
        fontSize: 15,
        color: "#5f6d63",
        textAlign: "center",
        marginBottom: 22
    },

    cameraShell: {
        width: "100%",
        maxWidth: 390,
        padding: 8,
        borderRadius: 28,
        backgroundColor: "#e9f2eb",
        marginBottom: 18
    },

    cameraBox: {
        width: "100%",
        height: 410,
        borderRadius: 24,
        overflow: "hidden",
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
        top: 60,
        alignSelf: "center",
        borderWidth: 4,
        borderColor: "white",
        borderRadius: 120,
        backgroundColor: "transparent"
    },

    faceGuideValid: {
        borderColor: "#22a447"
    },

    faceGuideInvalid: {
        borderColor: "#d83a34"
    },

    topStatusPill: {
        position: "absolute",
        top: 18,
        alignSelf: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999
    },

    topStatusText: {
        color: "white",
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 0.3
    },

    statusCard: {
        width: "100%",
        maxWidth: 390,
        backgroundColor: "white",
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#e4e8e4"
    },

    statusTitle: {
        color: "#0a3a00",
        fontSize: 18,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 6
    },

    statusSubtext: {
        color: "#6a766d",
        fontSize: 14,
        textAlign: "center",
        marginBottom: 14
    },

    scanIndicator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        minHeight: 36
    },

    scanLabel: {
        color: "#0a3a00",
        fontSize: 16,
        fontWeight: "600"
    },

    tipCard: {
        width: "100%",
        maxWidth: 390,
        backgroundColor: "#ffffff",
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 18,
        borderWidth: 1,
        borderColor: "#e4e8e4"
    },

    tipTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0a3a00",
        marginBottom: 10
    },

    tipText: {
        color: "#5f6d63",
        fontSize: 14,
        lineHeight: 22
    },

    permissionContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 30,
        backgroundColor: "#f6f7f9"
    },

    permissionText: {
        fontSize: 18,
        textAlign: "center",
        marginBottom: 25,
        color: "#0a3a00"
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
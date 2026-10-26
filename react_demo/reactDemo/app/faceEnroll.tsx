
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
    ActivityIndicator,
    ScrollView
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE } from "../constants/api";
import { Colors, Radius, Spacing } from "../constants/theme";

const MAX_ATTEMPTS = 35;

type GuideState = "idle" | "valid" | "invalid";

export default function FaceEnrollScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const userId = params.userId?.toString();

    const [permission, requestPermission] = useCameraPermissions();
    const [cameraReady, setCameraReady] = useState(false);

    const [statusMessage, setStatusMessage] = useState(
        "Position your face inside the frame"
    );

    const [guideState, setGuideState] = useState<GuideState>("idle");
    const [isScanning, setIsScanning] = useState(false);
    const [scanLabel, setScanLabel] = useState(
        "Camera initializing"
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
            setGuideState("invalid");
            setStatusMessage("User information missing");
            setScanLabel("Enrollment unavailable");
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
            setScanLabel("Connecting securely");

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
                    startResult.message ??
                    "Enrollment could not start."
                );
            }

            sessionStarted = true;

            if (stopScanning.current) return;

            setStatusMessage("Scanning your face...");
            setScanLabel("Collecting secure face samples");

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

                            setGuideState("valid");
                            setStatusMessage("Enrollment complete");
                            setScanLabel("Face enrolled successfully");

                            router.replace("/login");
                            return;

                        case "collecting":
                            setGuideState("valid");
                            setStatusMessage("Face detected");
                            setScanLabel(
                                "Hold steady while we complete your scan"
                            );
                            break;

                        case "duplicate_frame":
                            setGuideState("valid");
                            setStatusMessage(
                                "Turn your head slightly"
                            );
                            setScanLabel(
                                "Capturing a different face angle"
                            );
                            break;

                        case "low_quality":
                            setGuideState("invalid");
                            setStatusMessage(
                                "Improve lighting and hold steady"
                            );
                            setScanLabel(
                                "A clearer image is needed"
                            );
                            break;

                        case "no_face_detected":
                            setGuideState("invalid");
                            setStatusMessage(
                                "No face detected"
                            );
                            setScanLabel(
                                "Move your face inside the oval"
                            );
                            break;

                        case "multiple_faces_detected":
                        case "invalid_face_count":
                            setGuideState("invalid");
                            setStatusMessage(
                                "Only one face should be visible"
                            );
                            setScanLabel(
                                "Make sure nobody else is in view"
                            );
                            break;

                        case "embedding_failed":
                        case "invalid_embedding":
                        case "invalid_frame":
                            setGuideState("invalid");
                            setStatusMessage(
                                "Adjust your face and try again"
                            );
                            setScanLabel(
                                "Unable to process this frame"
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
                            setGuideState("idle");
                            setStatusMessage(
                                result.message ??
                                "Scanning your face..."
                            );
                            setScanLabel(
                                "Processing face scan"
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
                setGuideState("invalid");
                setStatusMessage(
                    "Scan incomplete. Go back and try again."
                );
                setScanLabel(
                    "Unable to collect enough samples"
                );
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
                setScanLabel("Enrollment unsuccessful");
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
            <View style={styles.centerContainer}>
                <ActivityIndicator
                    size="large"
                    color={Colors.primary}
                />
                <Text style={styles.loadingText}>
                    Loading camera permission...
                </Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <View style={styles.permissionIcon}>
                    <Ionicons
                        name="camera-outline"
                        size={42}
                        color={Colors.primary}
                    />
                </View>

                <Text style={styles.permissionTitle}>
                    Camera Access Required
                </Text>

                <Text style={styles.permissionText}>
                    Camera permission is required to securely
                    enroll your face for attendance verification.
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
            <View
                style={[
                    styles.header,
                    { paddingTop: insets.top }
                ]}
            >
                <Pressable
                    onPress={handleBack}
                    style={styles.backButton}
                    hitSlop={12}
                >
                    <Ionicons
                        name="arrow-back"
                        size={26}
                        color={Colors.textPrimary}
                    />
                </Pressable>

                <Text style={styles.headerTitle}>
                    Face Enrollment
                </Text>

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.headerLogo}
                    resizeMode="contain"
                />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                <View style={styles.introSection}>
                    <Text style={styles.pageTitle}>
                        Secure Face Enrollment
                    </Text>

                    <Text style={styles.pageSubtitle}>
                        Look at your camera while we securely
                        scan your face for future attendance.
                    </Text>
                </View>

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

                        <View
                            pointerEvents="none"
                            style={styles.liveIndicator}
                        >
                            <View style={styles.liveDot} />

                            <Text style={styles.liveText}>
                                LIVE SCAN
                            </Text>
                        </View>

                        <View
                            pointerEvents="none"
                            style={styles.cameraBottomLabel}
                        >
                            <MaterialCommunityIcons
                                name="face-recognition"
                                size={18}
                                color="#FFFFFF"
                            />

                            <Text style={styles.cameraBottomText}>
                                {guideState === "valid"
                                    ? "Face detected"
                                    : guideState === "invalid"
                                        ? "Adjust your position"
                                        : "Align your face"}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <View
                            style={[
                                styles.statusIcon,
                                guideState === "valid" &&
                                    styles.successIcon,
                                guideState === "invalid" &&
                                    styles.errorIcon
                            ]}
                        >
                            <Ionicons
                                name={
                                    guideState === "valid"
                                        ? "checkmark-circle"
                                        : guideState === "invalid"
                                            ? "alert-circle"
                                            : "scan-outline"
                                }
                                size={25}
                                color={
                                    guideState === "valid"
                                        ? Colors.success
                                        : guideState === "invalid"
                                            ? Colors.danger
                                            : Colors.primary
                                }
                            />
                        </View>

                        <View style={styles.statusTextContainer}>
                            <Text style={styles.statusTitle}>
                                {statusMessage}
                            </Text>

                            <Text style={styles.statusSubtext}>
                                {scanLabel}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statusDivider} />

                    <View style={styles.scanIndicator}>
                        {isScanning ? (
                            <ActivityIndicator
                                size="small"
                                color={Colors.primary}
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name="shield-check-outline"
                                size={21}
                                color={Colors.primary}
                            />
                        )}

                        <Text style={styles.scanLabel}>
                            {isScanning
                                ? "Scanning securely..."
                                : "Secure face enrollment"}
                        </Text>
                    </View>
                </View>

                <View style={styles.tipCard}>
                    <View style={styles.tipHeader}>
                        <Ionicons
                            name="information-circle-outline"
                            size={23}
                            color={Colors.primary}
                        />

                        <Text style={styles.tipTitle}>
                            Tips for a successful scan
                        </Text>
                    </View>

                    <View style={styles.tipRow}>
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={19}
                            color={Colors.success}
                        />
                        <Text style={styles.tipText}>
                            Keep only one face visible.
                        </Text>
                    </View>

                    <View style={styles.tipRow}>
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={19}
                            color={Colors.success}
                        />
                        <Text style={styles.tipText}>
                            Look directly at the camera.
                        </Text>
                    </View>

                    <View style={styles.tipRow}>
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={19}
                            color={Colors.success}
                        />
                        <Text style={styles.tipText}>
                            Make small head movements when prompted.
                        </Text>
                    </View>

                    <View style={styles.tipRow}>
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={19}
                            color={Colors.success}
                        />
                        <Text style={styles.tipText}>
                            Use bright, even lighting.
                        </Text>
                    </View>

                    <View style={styles.tipRow}>
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={19}
                            color={Colors.success}
                        />
                        <Text style={styles.tipText}>
                            Remove glasses and hats during enrollment.
                        </Text>
                    </View>
                </View>

                <View style={styles.privacySection}>
                    <MaterialCommunityIcons
                        name="shield-lock-outline"
                        size={22}
                        color={Colors.textSecondary}
                    />

                    <Text style={styles.privacyText}>
                        Your face is processed for secure
                        biometric enrollment.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background
    },

    centerContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.background
    },

    loadingText: {
        marginTop: 14,
        fontSize: 16,
        color: Colors.textSecondary
    },

    header: {
        minHeight: 94,
        backgroundColor: Colors.surface,
        paddingHorizontal: Spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight
    },

    backButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center"
    },

    headerTitle: {
        flex: 1,
        color: Colors.textPrimary,
        fontSize: 22,
        fontWeight: "800",
        textAlign: "center"
    },

    headerLogo: {
        width: 48,
        height: 48
    },

    scrollView: {
        flex: 1
    },

    scrollContent: {
        flexGrow: 1,
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 26,
        paddingBottom: 55
    },

    introSection: {
        width: "100%",
        maxWidth: 420,
        marginBottom: 22,
        alignItems: "center"
    },

    pageTitle: {
        color: Colors.textPrimary,
        fontSize: 27,
        fontWeight: "800",
        textAlign: "center"
    },

    pageSubtitle: {
        color: Colors.textSecondary,
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
        marginTop: 9,
        paddingHorizontal: 8
    },

    cameraShell: {
        width: "100%",
        maxWidth: 390,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        padding: 7,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        marginBottom: 18
    },

    cameraBox: {
        width: "100%",
        aspectRatio: 0.94,
        maxHeight: 405,
        borderRadius: Radius.md,
        overflow: "hidden",
        backgroundColor: "#101510",
        position: "relative"
    },

    cameraPreview: {
        flex: 1
    },

    faceGuide: {
        position: "absolute",
        width: "62%",
        height: "69%",
        top: "15%",
        alignSelf: "center",
        borderWidth: 3,
        borderColor: "#FFFFFF",
        borderRadius: 150
    },

    faceGuideValid: {
        borderColor: Colors.success
    },

    faceGuideInvalid: {
        borderColor: Colors.danger
    },

    liveIndicator: {
        position: "absolute",
        top: 15,
        left: 15,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.55)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: Radius.pill,
        gap: 7
    },

    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#37DA69"
    },

    liveText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1
    },

    cameraBottomLabel: {
        position: "absolute",
        bottom: 16,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "rgba(0,0,0,0.55)",
        paddingHorizontal: 15,
        paddingVertical: 9,
        borderRadius: Radius.pill
    },

    cameraBottomText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600"
    },

    statusCard: {
        width: "100%",
        maxWidth: 390,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        borderRadius: Radius.lg,
        padding: 18,
        marginBottom: 16
    },

    statusHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },

    statusIcon: {
        width: 48,
        height: 48,
        borderRadius: Radius.pill,
        backgroundColor: Colors.featureIconBackground,
        alignItems: "center",
        justifyContent: "center"
    },

    successIcon: {
        backgroundColor: Colors.successSoft
    },

    errorIcon: {
        backgroundColor: Colors.dangerSoft
    },

    statusTextContainer: {
        flex: 1
    },

    statusTitle: {
        color: Colors.textPrimary,
        fontSize: 17,
        fontWeight: "800",
        marginBottom: 4
    },

    statusSubtext: {
        color: Colors.textSecondary,
        fontSize: 14,
        lineHeight: 19
    },

    statusDivider: {
        height: 1,
        backgroundColor: Colors.borderLight,
        marginVertical: 15
    },

    scanIndicator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        minHeight: 28
    },

    scanLabel: {
        color: Colors.primary,
        fontSize: 15,
        fontWeight: "700"
    },

    tipCard: {
        width: "100%",
        maxWidth: 390,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        borderRadius: Radius.lg,
        padding: 18,
        marginBottom: 16
    },

    tipHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        marginBottom: 14
    },

    tipTitle: {
        color: Colors.textPrimary,
        fontSize: 17,
        fontWeight: "800",
        flex: 1
    },

    tipRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 11
    },

    tipText: {
        flex: 1,
        color: Colors.textSecondary,
        fontSize: 14,
        lineHeight: 20
    },

    privacySection: {
        width: "100%",
        maxWidth: 390,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingHorizontal: 15,
        marginTop: 4
    },

    privacyText: {
        flex: 1,
        color: Colors.textSecondary,
        fontSize: 13,
        lineHeight: 19,
        textAlign: "center"
    },

    permissionContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 30,
        backgroundColor: Colors.background
    },

    permissionIcon: {
        width: 84,
        height: 84,
        borderRadius: Radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.featureIconBackground,
        marginBottom: 18
    },

    permissionTitle: {
        fontSize: 24,
        fontWeight: "800",
        color: Colors.textPrimary,
        textAlign: "center"
    },

    permissionText: {
        fontSize: 16,
        lineHeight: 23,
        color: Colors.textSecondary,
        textAlign: "center",
        marginTop: 12,
        marginBottom: 25
    },

    permissionButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        paddingHorizontal: 30,
        borderRadius: Radius.md
    },

    permissionButtonText: {
        color: Colors.surface,
        fontSize: 16,
        fontWeight: "800"
    }
});

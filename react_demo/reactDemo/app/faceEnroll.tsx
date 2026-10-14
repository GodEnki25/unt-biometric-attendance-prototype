import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image
} from "react-native";

import {
    CameraView,
    useCameraPermissions
} from "expo-camera";

import { useLocalSearchParams, useRouter } from "expo-router";

import {
    useEffect,
    useRef,
    useState
} from "react";
import { File } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE } from "../constants/api";
import { Colors, Radius, Spacing } from "../constants/theme";

export default function FaceEnrollScreen() {

    const router = useRouter();
    const insets = useSafeAreaInsets();

    const params = useLocalSearchParams();

    const userId = params.userId?.toString();


    const [permission, requestPermission] =
        useCameraPermissions();


    const [cameraReady, setCameraReady] =
        useState(false);


    const [captureCount, setCaptureCount] =
        useState(0);


    const [statusMessage, setStatusMessage] =
        useState(
            "Position your face inside the frame"
        );


    const cameraRef =
        useRef<CameraView | null>(null);


    const isCapturing =
        useRef(false);


    const stopScanning =
        useRef(false);


    async function captureFaceScan() {

        if (stopScanning.current) {
            return;
        }


        if (isCapturing.current) {
            return;
        }


        if (!cameraReady) {
            return;
        }


        const camera =
            cameraRef.current;


        if (!camera) {
            return;
        }


        if (!userId) {

            setStatusMessage(
                "User information missing"
            );

            return;
        }


        isCapturing.current = true;


        try {

            setCaptureCount(0);

            setStatusMessage(
                "Scanning face..."
            );


            console.log(
                "Starting enrollment video scan"
            );


            /*
             * Start ONE continuous video.
             *
             * We are no longer taking:
             *
             * photo 1
             * photo 2
             * photo 3
             * ...
             *
             * The backend will later extract
             * multiple frames from this video.
             */
            const videoPromise =
                camera.recordAsync();


            /*
             * Allow the camera to collect
             * approximately two seconds of
             * continuous face movement.
             */
            setTimeout(() => {

                if (
                    cameraRef.current &&
                    !stopScanning.current
                ) {

                    cameraRef.current
                        .stopRecording();
                }

            }, 2000);


            /*
             * recordAsync finishes when
             * stopRecording() is called.
             */
            const video =
                await videoPromise;


            if (!video?.uri) {

                setStatusMessage(
                    "Unable to capture face scan"
                );

                return;
            }


            console.log(
                "Enrollment video:",
                video.uri
            );

            setStatusMessage(
                "Processing face scan..."
            );


            // Get authentication token
            const token =
                await SecureStore.getItemAsync(
                    "access_token"
                );


            if (!token) {

                setStatusMessage(
                    "Authentication required. Please log in again."
                );

                stopScanning.current = true;

                return;
            }


            // Convert recorded video into uploadable file
            const videoFile =
                new File(video.uri);


            // Create multipart form
            const formData =
                new FormData();


            formData.append(
                "file",
                videoFile
            );


            // Send ONE video to Python backend
            const response =
                await fetch(
                    `${API_BASE}/enroll`,
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },

                        body: formData
                    }
                );


            const result =
                await response.json();


            console.log(
                "Enrollment response:",
                result
            );


            // SUCCESS
            if (
                result.status ===
                "enrolled"
            ) {

                stopScanning.current = true;

                setCaptureCount(
                    result.captures ?? 7
                );

                setStatusMessage(
                    "Enrollment complete"
                );


                setTimeout(() => {

                    router.replace(
                        "/login"
                    );

                }, 700);


                return;
            }


            // NOT ENOUGH GOOD FACE FRAMES
            if (
                result.status ===
                "insufficient_embeddings"
            ) {

                setCaptureCount(
                    result.captures ?? 0
                );

                setStatusMessage(
                    "Not enough face data. Please scan again."
                );

                return;
            }


            // VIDEO COULD NOT BE READ
            if (
                result.status ===
                "invalid_video"
            ) {

                setStatusMessage(
                    "Unable to process face scan"
                );

                return;
            }


            // NO VALID FACE
            if (
                result.status ===
                "invalid_face_count"
            ) {

                setStatusMessage(
                    "Keep only one face visible"
                );

                return;
            }


            // OTHER BACKEND ERROR
            setStatusMessage(
                result.message ??
                "Face enrollment failed"
            );

        }

        catch (error) {

            console.log(
                "Enrollment scan error:",
                error
            );


            setStatusMessage(
                "Unable to scan face"
            );

        }

        finally {

            isCapturing.current =
                false;

        }
    }



    /*
     * Ask for camera permission.
     */
    useEffect(() => {

        if (!permission) {
            return;
        }


        if (!permission.granted) {

            requestPermission();

        }

    }, [permission]);



    /*
     * Automatically begin ONE enrollment
     * scan when the camera becomes ready.
     *
     * No setInterval.
     * No repeated JPEG captures.
     */
    useEffect(() => {

        if (!cameraReady) {
            return;
        }


        if (!permission?.granted) {
            return;
        }


        if (!userId) {
            return;
        }


        stopScanning.current =
            false;


        captureFaceScan();


        return () => {

            stopScanning.current =
                true;


            if (cameraRef.current) {

                try {

                    cameraRef.current
                        .stopRecording();

                }

                catch (error) {

                    console.log(
                        "Stop recording:",
                        error
                    );

                }
            }

        };

    }, [
        cameraReady,
        permission?.granted,
        userId
    ]);



    function handleBack() {

        stopScanning.current =
            true;


        if (cameraRef.current) {

            try {

                cameraRef.current
                    .stopRecording();

            }

            catch (error) {

                console.log(
                    "Stop recording:",
                    error
                );

            }
        }


        router.back();

    }



    if (!permission) {

        return (

            <View style={styles.container}>

                <Text>
                    Loading camera permission...
                </Text>

            </View>

        );
    }



    // ============================================================
    // CAMERA PERMISSION STATES
    // ============================================================

    if (!permission) {

        return (

            <View
                style={[
                    styles.permissionContainer,
                    {
                        paddingTop: insets.top,
                        paddingBottom: insets.bottom
                    }
                ]}
            >

                <View style={styles.permissionIconCircle}>

                    <Ionicons
                        name="camera-outline"
                        size={44}
                        color={Colors.primary}
                    />

                </View>


                <Text style={styles.permissionTitle}>
                    Preparing Camera
                </Text>


                <Text style={styles.permissionText}>
                    Loading camera permission...
                </Text>

            </View>

        );
    }

    if (!permission.granted) {

        return (

            <View
                style={[
                    styles.permissionContainer,
                    {
                        paddingTop: insets.top,
                        paddingBottom: insets.bottom
                    }
                ]}
            >

                <View style={styles.permissionIconCircle}>

                    <Ionicons
                        name="camera-outline"
                        size={44}
                        color={Colors.primary}
                    />

                </View>


                <Text style={styles.permissionTitle}>
                    Camera Required
                </Text>


                <Text style={styles.permissionText}>
                    Camera permission is required
                    for face enrollment.
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


            {/* =====================================================
                HEADER
            ====================================================== */}

            <View
                style={[
                    styles.header,
                    {
                        paddingTop: insets.top
                    }
                ]}
            >

                <Pressable
                    onPress={handleBack}
                    style={styles.headerIconButton}
                    hitSlop={10}
                >

                    <Ionicons
                        name="chevron-back"
                        size={30}
                        color={Colors.textSecondary}
                    />

                </Pressable>


                <Text style={styles.headerTitle}>
                    Face Enrollment
                </Text>


                <View style={styles.headerIconButton}>

                    <Image
                        source={require("../assets/logo.png")}
                        style={styles.headerLogo}
                        resizeMode="contain"
                    />

                </View>

            </View>


            {/* =====================================================
                CAMERA CONTENT
            ====================================================== */}

            <View style={styles.content}>


                {/* Enrollment Instructions */}

                <View style={styles.introSection}>

                    <Text style={styles.title}>
                        Verify Your Face
                    </Text>


                    <Text style={styles.subtitle}>
                        Keep your face centered and look directly
                        at the camera while your biometric profile
                        is created.
                    </Text>

                </View>


                {/* Live Camera */}

                <View style={styles.cameraCard}>

                    <View style={styles.cameraBox}>

                        <CameraView
                            ref={cameraRef}
                            style={styles.cameraPreview}
                            facing="front"
                            mode="video"
                            onCameraReady={() => {

                                console.log(
                                    "Camera ready"
                                );

                                setCameraReady(true);

                            }}
                        />


                        {/* Face Alignment Guide */}

                        <View
                            pointerEvents="none"
                            style={styles.faceGuide}
                        />

                    </View>

                </View>


                {/* =================================================
                    SCAN STATUS
                ================================================== */}

                <View style={styles.statusSection}>

                    <View style={styles.statusRow}>

                        <View style={styles.statusIconCircle}>

                            <Ionicons
                                name={
                                    statusMessage === "Enrollment complete"
                                        ? "checkmark"
                                        : "scan-outline"
                                }
                                size={22}
                                color={Colors.primary}
                            />

                        </View>


                        <View style={styles.statusTextGroup}>

                            <Text style={styles.instructionText}>
                                {statusMessage}
                            </Text>


                            <Text style={styles.progressText}>
                                Face data captured: {captureCount} / 7
                            </Text>

                        </View>

                    </View>

                </View>


                {/* Privacy Note */}

                <View style={styles.privacyRow}>

                    <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color={Colors.textSecondary}
                    />


                    <Text style={styles.privacyText}>
                        Your camera is used only during biometric enrollment.
                    </Text>

                </View>

            </View>

        </View>

    );
}



const styles =
    StyleSheet.create({


        // ============================================================
        // PAGE
        // ============================================================

        container: {
            flex: 1,
            backgroundColor: Colors.background
        },


        // ============================================================
        // HEADER
        // ============================================================

        header: {
            minHeight: 82,

            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",

            backgroundColor: Colors.surface,

            paddingHorizontal: 20,

            borderBottomWidth: 1,
            borderBottomColor: Colors.borderLight
        },


        headerIconButton: {
            width: 44,
            height: 44,

            alignItems: "center",
            justifyContent: "center"
        },

        headerLogo: {
            width: 34,
            height: 34
        },


        headerTitle: {
            color: Colors.textPrimary,

            fontSize: 24,
            fontWeight: "800",

            textAlign: "center"
        },


        // ============================================================
        // CAMERA CONTENT
        // ============================================================

        content: {
            flex: 1,

            alignItems: "center",

            paddingHorizontal: 24,
            paddingTop: 30,
            paddingBottom: 26
        },


        introSection: {
            width: "100%",
            maxWidth: 390,

            alignItems: "center",

            marginBottom: 24
        },


        title: {
            color: Colors.textPrimary,

            fontSize: 30,
            fontWeight: "800",

            textAlign: "center"
        },


        subtitle: {
            color: Colors.textSecondary,

            fontSize: 16,
            lineHeight: 22,

            textAlign: "center",

            maxWidth: 340,

            marginTop: 8
        },


        // ============================================================
        // LIVE CAMERA
        // ============================================================

        cameraCard: {
            width: "100%",
            maxWidth: 390,

            backgroundColor: Colors.surface,

            borderWidth: 1,
            borderColor: Colors.borderLight,
            borderRadius: Radius.lg,

            padding: 10,

            shadowColor: Colors.textPrimary,
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: {
                width: 0,
                height: 5
            },

            elevation: 3
        },


        cameraBox: {
            width: "100%",
            height: 400,

            overflow: "hidden",

            backgroundColor: Colors.textPrimary,

            borderRadius: Radius.md,

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

            borderWidth: 3,
            borderColor: Colors.surface,
            borderRadius: 120
        },


        // ============================================================
        // SCAN STATUS
        // ============================================================

        statusSection: {
            width: "100%",
            maxWidth: 390,

            marginTop: 20
        },


        statusRow: {
            width: "100%",

            flexDirection: "row",
            alignItems: "center",

            gap: Spacing.md,

            backgroundColor: Colors.surface,

            borderWidth: 1,
            borderColor: Colors.borderLight,
            borderRadius: Radius.md,

            paddingHorizontal: 16,
            paddingVertical: 14
        },


        statusIconCircle: {
            width: 42,
            height: 42,

            borderRadius: Radius.pill,

            alignItems: "center",
            justifyContent: "center",

            backgroundColor: Colors.featureIconBackground
        },


        statusTextGroup: {
            flex: 1
        },


        instructionText: {
            color: Colors.textPrimary,

            fontSize: 16,
            lineHeight: 21,

            fontWeight: "700"
        },


        progressText: {
            color: Colors.textSecondary,

            fontSize: 14,

            marginTop: 3
        },


        // ============================================================
        // PRIVACY NOTE
        // ============================================================

        privacyRow: {
            width: "100%",
            maxWidth: 390,

            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",

            gap: 8,

            marginTop: 18
        },


        privacyText: {
            color: Colors.textSecondary,

            fontSize: 13,
            lineHeight: 18,

            textAlign: "center"
        },


        // ============================================================
        // CAMERA PERMISSION STATES
        // ============================================================

        permissionContainer: {
            flex: 1,

            alignItems: "center",
            justifyContent: "center",

            backgroundColor: Colors.background,

            paddingHorizontal: 30
        },


        permissionIconCircle: {
            width: 92,
            height: 92,

            borderRadius: Radius.pill,

            alignItems: "center",
            justifyContent: "center",

            backgroundColor: Colors.featureIconBackground,

            marginBottom: 20
        },


        permissionTitle: {
            color: Colors.textPrimary,

            fontSize: 28,
            fontWeight: "800",

            textAlign: "center",

            marginBottom: 10
        },


        permissionText: {
            color: Colors.textSecondary,

            fontSize: 17,
            lineHeight: 23,

            textAlign: "center",

            maxWidth: 320,

            marginBottom: 24
        },


        permissionButton: {
            minHeight: 54,

            backgroundColor: Colors.primary,

            borderRadius: Radius.md,

            alignItems: "center",
            justifyContent: "center",

            paddingHorizontal: 28
        },


        permissionButtonText: {
            color: Colors.surface,

            fontSize: 17,
            fontWeight: "800"
        }

    });
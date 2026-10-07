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

import { API_BASE } from "../constants/api";

export default function FaceEnrollScreen() {

    const router = useRouter();

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



    if (!permission.granted) {

        return (

            <View
                style={
                    styles.permissionContainer
                }
            >

                <Text
                    style={
                        styles.permissionText
                    }
                >
                    Camera permission is required
                    for face enrollment.
                </Text>


                <Pressable
                    style={
                        styles.permissionButton
                    }
                    onPress={
                        requestPermission
                    }
                >

                    <Text
                        style={
                            styles.permissionButtonText
                        }
                    >
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

                    <Text
                        style={
                            styles.backButtonText
                        }
                    >
                        {"⬅"}
                    </Text>

                </Pressable>


                <Text
                    style={styles.headerTitle}
                >
                    Face Enrollment
                </Text>


                <Image
                    source={require(
                        "../assets/logo.png"
                    )}
                    style={styles.headerLogo}
                />

            </View>



            <View style={styles.content}>

                <View style={styles.cameraBox}>

                    <CameraView
                        ref={cameraRef}
                        style={
                            styles.cameraPreview
                        }
                        facing="front"
                        mode="video"
                        onCameraReady={() => {

                            console.log(
                                "Camera ready"
                            );

                            setCameraReady(true);

                        }}
                    />


                    <View
                        pointerEvents="none"
                        style={
                            styles.faceGuide
                        }
                    />

                </View>


                <Text
                    style={
                        styles.instructionText
                    }
                >
                    {statusMessage}
                </Text>


                <Text
                    style={
                        styles.capturedImageCount
                    }
                >
                    Scanning Face:{" "}
                    {captureCount} / 7
                </Text>

            </View>

        </View>

    );
}



const styles =
    StyleSheet.create({

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


        capturedImageCount: {

            color: "#0a3a00",

            fontSize: 32,

            fontWeight: "bold",

            textAlign: "center"

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
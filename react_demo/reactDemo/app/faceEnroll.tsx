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

import { File } from "expo-file-system";
import { fetch } from "expo/fetch";

import {
    useLocalSearchParams,
    useRouter
} from "expo-router";

import {
    useEffect,
    useRef,
    useState
} from "react";


const API_BASE = "http://192.168.1.229:8000";


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


    async function captureFrame() {

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

            const photo =
                await camera.takePictureAsync({
                    quality: 0.7,
                    skipProcessing: true
                });


            if (!photo?.uri) {

                setStatusMessage(
                    "Unable to capture camera frame"
                );

                return;
            }


            const formData =
                new FormData();


            formData.append(
                "user_id",
                userId
            );


            const imageFile =
                new File(photo.uri);


            formData.append(
                "file",
                imageFile
            );


            const response =
                await fetch(
                    `${API_BASE}/enroll`,
                    {
                        method: "POST",
                        body: formData
                    }
                );


            const result =
                await response.json();


            console.log(
                "Enrollment response:",
                result
            );


            if (
                result.status ===
                "invalid_face_count"
            ) {

                setStatusMessage(
                    "Keep only one face visible"
                );

                return;
            }


            if (
                result.status ===
                "face_outside_frame"
            ) {

                setStatusMessage(
                    "Keep your face inside the guide"
                );

                return;
            }


            if (
                result.status ===
                "move_closer"
            ) {

                setStatusMessage(
                    "Move closer to the camera"
                );

                return;
            }


            if (
                result.status ===
                "center_face"
            ) {

                setStatusMessage(
                    "Center your face"
                );

                return;
            }


            if (
                result.status ===
                "embedding_failed"
            ) {

                setStatusMessage(
                    "Face scan failed. Hold still."
                );

                return;
            }


            if (
                result.status ===
                "collecting"
            ) {

                setCaptureCount(
                    result.captures
                );


                setStatusMessage(
                    "Scanning..."
                );

                return;
            }


            if (
                result.status ===
                "enrolled"
            ) {

                stopScanning.current =
                    true;


                setCaptureCount(10);


                setStatusMessage(
                    "Enrollment complete"
                );


                setTimeout(() => {

                    router.replace(
                        "/login"
                    );

                }, 700);
            }

        }

        catch (error) {

            console.log(
                "Enrollment error:",
                error
            );


            setStatusMessage(
                "Unable to connect to biometric server"
            );
        }

        finally {

            isCapturing.current =
                false;
        }
    }


    useEffect(() => {

        if (!permission) {
            return;
        }


        if (!permission.granted) {

            requestPermission();
        }

    }, [permission]);


    useEffect(() => {

        if (!cameraReady) {
            return;
        }


        if (!permission?.granted) {
            return;
        }


        stopScanning.current =
            false;


        const interval =
            setInterval(() => {

                captureFrame();

            }, 1200);


        return () => {

            stopScanning.current =
                true;

            clearInterval(interval);
        };

    }, [
        cameraReady,
        permission?.granted,
        userId
    ]);


    function handleBack() {

        stopScanning.current =
            true;

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

            <View style={styles.permissionContainer}>

                <Text style={styles.permissionText}>
                    Camera permission is required
                    for face enrollment.
                </Text>


                <Pressable
                    style={styles.permissionButton}
                    onPress={requestPermission}
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
                        onCameraReady={() => {

                            console.log(
                                "Camera ready"
                            );

                            setCameraReady(true);
                        }}
                    />


                    <View
                        pointerEvents="none"
                        style={styles.faceGuide}
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
                    Scanning Face:
                    {" "}
                    {captureCount} / 10
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

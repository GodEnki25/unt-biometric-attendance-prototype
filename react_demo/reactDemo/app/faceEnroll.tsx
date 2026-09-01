import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image
} from "react-native";

import { useRouter } from "expo-router";
import { useState, useRef } from "react";
import { CameraView } from "expo-camera";


export default function FaceEnrollScreen() {

    const router = useRouter();

    // Keeps track of how many valid captures
    // the backend has accepted
    const [captureCount, setCaptureCount] = useState(0);

    // Gives us direct access to the CameraView
    const cameraRef = useRef<CameraView | null>(null);


    async function handleCapture() {

        // Get the current camera instance
        const camera = cameraRef.current;

        // Stop if camera is not ready
        if (!camera) {
            return;
        }


        try {

            // Capture an actual image from the front camera
            const photo = await camera.takePictureAsync({
                quality: 0.8
            });

            // Stop if image capture failed
            if (!photo) {
                return;
            }


            // Create FormData because FastAPI expects:
            // user_id + image file
            const formData = new FormData();


            // TEMPORARY USER ID
            // Later replace this with the actual user ID
            // returned after signup/login
            formData.append(
                "user_id",
                "1"
            );


            // Add captured image to the request
            formData.append(
                "file",
                {
                    uri: photo.uri,
                    name: "face.jpg",
                    type: "image/jpeg"
                } as any
            );


            // Send image to FastAPI enrollment route
            const response = await fetch(
                "http://YOUR_PC_IP:8000/enroll",
                {
                    method: "POST",
                    body: formData
                }
            );


            // Convert FastAPI JSON response
            // into a JavaScript object
            const result = await response.json();


            // Useful while testing
            console.log("Enrollment response:", result);


            // Backend successfully accepted the frame
            // but still needs more captures
            if (result.status === "collecting") {

                setCaptureCount(
                    result.captures
                );
            }


            // Enrollment finished successfully
            if (result.status === "enrolled") {

                setCaptureCount(5);

                // Move user to login screen
                router.push("/login");
            }


            // Backend detected no valid single face
            if (result.status === "invalid_face_count") {

                console.log(
                    "Please make sure only one face is visible."
                );
            }


            // Backend could not decode the image
            if (result.status === "invalid_frame") {

                console.log(
                    "Invalid camera frame."
                );
            }

        }

        catch (error) {

            // Happens if React cannot reach FastAPI
            // or another request error occurs
            console.log(
                "Enrollment error:",
                error
            );
        }
    }


    return (

        <View style={styles.container}>

            <View style={styles.header}>

                <Pressable
                    onPress={() => router.back()}
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
                    />

                </View>


                <Pressable
                    style={styles.captureButton}
                    onPress={handleCapture}
                >

                    <Text style={styles.captureButtonText}>
                        Capture
                    </Text>

                </Pressable>


                <Text style={styles.capturedImageCount}>

                    Image Captured: {captureCount} / 5

                </Text>

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

        marginBottom: 90,

        backgroundColor: "#000"
    },


    cameraPreview: {
        flex: 1
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

import { View, Text, StyleSheet, Pressable, Image, ImageBackground } from "react-native";
import { useRouter } from "expo-router";

export default function FirstTimeEnrollScreen()
{
    const router = useRouter();

    return (
        <ImageBackground
            source={require("../assets/background.png")}
            style={styles.background}
            imageStyle={styles.backgroundImage}
        >
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{"<"}</Text>
                </Pressable>

                <Text style={styles.headerTitle}>Consent Form</Text>

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.headerLogo}
                />
            </View>

            {/* Permission Box */}
            <View style={styles.content}>
                <View style={styles.permissionBox}>
                    <Text style={styles.title}>Camera Permission</Text>
                    <Text style={styles.message}>
                        This app needs permission to use your camera.
                    </Text>

                    <View style={styles.buttonRow}>
                        <Pressable style={styles.acceptButton} onPress={() => router.push("/faceEnroll")}>
                            <Text style={styles.buttonText}>Accept</Text>
                        </Pressable>

                        <Pressable style={styles.declineButton}  onPress={() => router.push("/login")}>
                            <Text style={styles.buttonText}>Decline</Text>
                        </Pressable>
                    </View>
                </View>
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
        backgroundColor: "#f2f2f2"
    },
    header: {
        height: 90,
        backgroundColor: "#0f5c00",
        paddingHorizontal: 20,
        paddingTop: 40,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd"
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
    permissionBox: {
        width: "100%",
        maxWidth: 350,
        padding: 25,
        borderRadius: 12,
        backgroundColor: "white",
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 10,
        textAlign: "center"
    },
    message: {
        fontSize: 16,
        textAlign: "center",
        marginBottom: 20
    },
    buttonRow: {
        flexDirection: "row",
        justifyContent: "space-between"
    },
    acceptButton: {
        flex: 1,
        marginRight: 10,
        backgroundColor: "green",
        padding: 12,
        borderRadius: 8,
        alignItems: "center"
    },
    declineButton: {
        flex: 1,
        marginLeft: 10,
        backgroundColor: "red",
        padding: 12,
        borderRadius: 8,
        alignItems: "center"
    },
    buttonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold"
    }
});
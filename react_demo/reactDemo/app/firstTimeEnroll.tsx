
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";

export default function FirstTimeEnrollScreen()
{
    const router = useRouter();

    return (
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
                        <Pressable style={styles.acceptButton}>
                            <Text style={styles.buttonText}>Accept</Text>
                        </Pressable>

                        <Pressable style={styles.declineButton}>
                            <Text style={styles.buttonText}>Decline</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f2f2f2"
    },
    header: {
        height: 90,
        backgroundColor: "white",
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
        fontWeight: "bold"
    },
    headerTitle: {
        flex: 1,
        fontSize: 22,
        fontWeight: "bold",
        textAlign: "center"
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
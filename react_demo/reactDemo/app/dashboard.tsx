
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function DashboardScreen()
{
    const router = useRouter();

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{"<"}</Text>
                </Pressable>

                <Text style={styles.headerTitle}>Student Dashboard</Text>

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.headerLogo}
                />
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                <View style={styles.infoBox}>
                    <View style={styles.infoTextArea}>
                        <Text style={styles.infoTitle}>Student Info</Text>
                        <Text style={styles.infoText}>Name: Placeholder</Text>
                        <Text style={styles.infoText}>Status: Active</Text>
                    </View>

                    <Pressable
                        style={styles.checkInButton}
                        onPress={() => router.push("/checkIn")}
                    >
                        <Text style={styles.checkInButtonText}>Check In</Text>
                    </Pressable>
                </View>
            </View>

            {/* Bottom Left Button */}
            <Pressable
                style={styles.attendanceButton}
                onPress={() => router.push("/attendanceHistory")}
            >
                <Text style={styles.attendanceButtonText}>Attendance History</Text>
            </Pressable>
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
        padding: 20
    },
    infoBox: {
        backgroundColor: "white",
        padding: 20,
        borderRadius: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4
    },
    infoTextArea: {
        flex: 1,
        marginRight: 15
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 10
    },
    infoText: {
        fontSize: 15,
        marginBottom: 4
    },
    checkInButton: {
        backgroundColor: "blue",
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 10
    },
    checkInButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold"
    },
    attendanceButton: {
        position: "absolute",
        bottom: 25,
        left: 20,
        backgroundColor: "black",
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 10
    },
    attendanceButtonText: {
        color: "white",
        fontSize: 15,
        fontWeight: "bold"
    }
});
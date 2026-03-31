
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function CheckInScreen()
{
    const router = useRouter();

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{"<"}</Text>
                </Pressable>

                <Text style={styles.headerTitle}>Check In</Text>

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.headerLogo}
                />
            </View>

            <View style={styles.content}>
                <Text style={styles.text}>Check In</Text>
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
        alignItems: "center"
    },
    text: {
        fontSize: 28,
        fontWeight: "bold"
    }
});
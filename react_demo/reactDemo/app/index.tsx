import {
    View,
    Text,
    Pressable,
    StyleSheet
} from "react-native";

import { useRouter } from "expo-router";


export default function IndexScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>

            <Text style={styles.title}>
                UNT Biometric Attendance
            </Text>


            <Pressable
                style={styles.button}
                onPress={() =>
                    router.push("/login")
                }
            >
                <Text style={styles.buttonText}>
                    Student
                </Text>
            </Pressable>


            <Pressable
                style={styles.button}
                onPress={() =>
                    router.push("/loginInstructor")
                }
            >
                <Text style={styles.buttonText}>
                    Instructor
                </Text>
            </Pressable>

        </View>
    );
}


const styles = StyleSheet.create({

    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f2f2f2",
        padding: 24
    },

    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#0b7d3b",
        marginBottom: 40,
        textAlign: "center"
    },

    button: {
        width: 240,
        backgroundColor: "#0b7d3b",
        paddingVertical: 16,
        borderRadius: 12,
        marginVertical: 10,
        alignItems: "center"
    },

    buttonText: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold"
    }

});
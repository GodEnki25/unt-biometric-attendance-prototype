
import { View, Text, TextInput, Button, StyleSheet, Image, Pressable, ImageBackground } from "react-native";
import { useRouter } from "expo-router";

export default function LoginScreen()
{
    const router = useRouter();

    return (

        <View style={styles.container}>

            <View style={styles.header}>
                <Text style={styles.headerTitle}>UNT Instructor Login</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image source={require("../assets/logo.png")} style={styles.logo} />
                </View>

                <View style={styles.formContainer}>
                    <TextInput style={styles.input} placeholder="Username" />
                    <TextInput style={styles.input} placeholder="Password" secureTextEntry={true} />

                    <Pressable style={styles.loginButton} onPress={() => router.push("/dashboardInstructor")}>
                        <Text style={styles.loginButtonText}>Sign In</Text>
                    </Pressable>
                </View>

            </View>
            
        </View>
    );
}

const styles = StyleSheet.create({
    

    container: {
        flex: 1,
        backgroundColor: "#e7ffe7"
    },
    header: {
        height: 90,
        backgroundColor: "#0f5c00",
        paddingHorizontal: 20,
        paddingTop: 50,
        alignItems: "flex-start",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd"
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: "bold",
        textAlign: "center",
        color: "white"
    },
    content: {
        flex: 1,
        flexDirection: "row",
        padding: 20
    },
    logoContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingRight: 20
    },
    formContainer: {
        flex: 1,
        justifyContent: "center",
        paddingLeft: 20
    },
    logo: {
        width: 500,
        height: 500,
        borderRadius: 10
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 20,
        textAlign: "center"
    },
    input: {
        borderWidth: 1,
        borderColor: "green",
        padding: 10,
        marginBottom: 30,
        borderRadius: 5,
        backgroundColor: "white",
        fontSize: 50
    },
    loginButton: {
        backgroundColor: "#00853E",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 5,
        alignItems: "center",
        marginBottom: 15,
        marginTop: 40
    },
    loginButtonText: {
        color: "white",
        fontSize: 50,
        fontWeight: "bold"
    },
    enrollLink: {
        marginTop: 15,
        textAlign: "center",
        color: "green",
        textDecorationLine: "underline",
        fontSize: 16
    }
});

import { View, Text, TextInput, Button, StyleSheet, Image, Pressable, ImageBackground } from "react-native";
import { useRouter } from "expo-router";

export default function LoginScreen()
{
    const router = useRouter();

    return (

        <View style={styles.container}>

            <View style={styles.header}>
                <Text style={styles.headerTitle}>UNT Student Login</Text>
            </View>

            <View style={styles.content}>
                <Image source={require("../assets/logo.png")} style={styles.logo} />
                

                <TextInput style={styles.input} placeholder="Username" />
                <TextInput style={styles.input} placeholder="Password" secureTextEntry={true} />

                <Pressable style={styles.loginButton} onPress={() => router.push("/dashboard")}>
                    <Text style={styles.loginButtonText}>Login</Text>
                </Pressable>

                <Pressable onPress={() => router.push("/firstTimeEnroll")}>
                    <Text style={styles.enrollLink}>Enroll Face</Text>
                </Pressable>
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
        alignItems: "center",
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
        justifyContent: "center",
        padding: 20
    },
    logo: {
        width: 150,
        height: 150,
        alignSelf: "center",
        marginBottom: 20,
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
        marginBottom: 15,
        borderRadius: 5,
        backgroundColor: "white"
    },
    loginButton: {
        backgroundColor: "#00853E",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 5,
        alignItems: "center",
        marginBottom: 15
    },
    loginButtonText: {
        color: "white",
        fontSize: 16,
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
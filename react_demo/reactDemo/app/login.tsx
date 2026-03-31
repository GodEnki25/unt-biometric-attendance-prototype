
import { View, Text, TextInput, Button, StyleSheet, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function LoginScreen()
{
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Image source={require("../assets/logo.png")} style={styles.logo} />

            <Text style={styles.title}>Login</Text>

            <TextInput style={styles.input} placeholder="Username" />
            <TextInput style={styles.input} placeholder="Password" secureTextEntry={true} />

            <Button
                title="Login"
                onPress={() => router.push("/dashboard")}
            />

            <Pressable onPress={() => router.push("/firstTimeEnroll")}>
                <Text style={styles.enrollLink}>Enroll Face</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
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
        borderColor: "#999",
        padding: 10,
        marginBottom: 15,
        borderRadius: 5
    },
    enrollLink: {
        marginTop: 15,
        textAlign: "center",
        color: "blue",
        textDecorationLine: "underline",
        fontSize: 16
    }
});
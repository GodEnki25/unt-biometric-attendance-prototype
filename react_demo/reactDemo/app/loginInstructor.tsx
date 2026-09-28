
import { View, Text, TextInput, Button, StyleSheet, Image, Pressable, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { API_BASE } from "@/constants/api";

export default function LoginScreen()
{
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async () => {
    setError("");

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password,
            }),
        });

        const data = await response.json();

        if (!data.success) {
            setError(data.message || "Login failed.");
            return;
        }

        if (
            data.user.role !== "instructor" &&
            data.user.role !== "admin"
        ) {
            setError("Instructor account required.");
            return;
        }

        localStorage.setItem(
            "access_token",
            data.access_token
        );

        localStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );

        router.push("/dashboardInstructor");
    }
    catch (error) {
        console.error("Instructor login error:", error);
        setError("Unable to connect to server.");
    }
};

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
                    <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
                    <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={true} />

                    {error ? (
                        <Text style={{ color: "red" }}>
                            {error}
                        </Text>
                    ) : null}

                    <Pressable style={styles.loginButton} onPress={handleLogin}>
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
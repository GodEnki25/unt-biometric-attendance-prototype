import { View, Text, TextInput, StyleSheet, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { API_BASE } from "@/constants/api";

export default function AdminLoginScreen() {
    const router = useRouter();
    // So in this file we should store the admin stuff so no idea how we are normally gonna do this so.
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

            if (data.user.role !== "admin") {
                setError("Admin account required.");
                return;
            }

            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));
            router.push("/adminDashboard");
        } catch (error) {
            console.error("Admin login error:", error);
            setError("Unable to connect to server.");
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>UNT Admin Login</Text>
                <Pressable
                    style={styles.backButton}
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/loginInstructor");
                        }
                    }}
                >
                    <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
            </View>

            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image source={require("../assets/logo.png")} style={styles.logo} />
                </View>

                <View style={styles.formContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="rgba(255, 255, 255, 0.75)"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="rgba(255, 255, 255, 0.75)"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    <Pressable style={styles.loginButton} onPress={() => router.push("/adminDashboard")}>
                {/*<Pressable style={styles.loginButton} onPress={handleLogin}>
                10/5/2026
                    This comment is here to remove because I don't know how to access the admin parts.
                    also possibly make a admin account
                    */} 
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
        backgroundColor: "#e7ffe7",
    },
    header: {
        height: 90,
        backgroundColor: "#0f5c00",
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
    },
    backButton: {
        backgroundColor: "white",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 4,
    },
    backButtonText: {
        color: "#0f5c00",
        fontSize: 14,
        fontWeight: "bold",
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: "bold",
        textAlign: "center",
        color: "white",
    },
    content: {
        flex: 1,
        flexDirection: "row",
        padding: 20,
    },
    logoContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingRight: 20,
    },
    formContainer: {
        flex: 1,
        justifyContent: "center",
        paddingLeft: 20,
    },
    logo: {
        width: 500,
        height: 500,
        borderRadius: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: "green",
        padding: 10,
        marginBottom: 30,
        borderRadius: 5,
        backgroundColor: "white",
        fontSize: 50,
    },
    loginButton: {
        backgroundColor: "#00853E",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 5,
        alignItems: "center",
        marginBottom: 15,
        marginTop: 40,
    },
    loginButtonText: {
        color: "white",
        fontSize: 50,
        fontWeight: "bold",
    },
    errorText: {
        color: "red",
    },
});

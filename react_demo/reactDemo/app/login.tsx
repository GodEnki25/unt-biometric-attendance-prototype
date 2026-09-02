import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Image,
    Pressable,
    Platform
} from "react-native";

import { useRouter } from "expo-router";
import { useState } from "react";


const API_BASE =
    Platform.OS === "web"
        ? "http://127.0.0.1:8000"
        : "http://192.168.1.213:8000";


export default function LoginScreen()
{
    const router = useRouter();

    // Stores what the user types
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Used to display login errors
    const [error, setError] = useState("");

    // Prevents multiple login requests at once
    const [isLoggingIn, setIsLoggingIn] = useState(false);


    async function handleLogin()
    {
        // Basic check before sending request
        if (!email || !password)
        {
            setError("Please enter your email and password.");
            return;
        }

        try
        {
            setIsLoggingIn(true);
            setError("");


            // Send email + password to backend/routes/auth_routes.py
            const response = await fetch(`${API_BASE}/login`, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    email: email,
                    password: password,
                }),
            });


            // Convert backend JSON response into JavaScript object
            const data = await response.json();


            // Your backend returns success: false
            // when credentials are incorrect
            if (!data.success)
            {
                setError(data.message || "Login failed.");
                return;
            }


            /*
                Backend gives us:

                {
                    success: true,
                    user: {
                        id: ...,
                        name: ...,
                        role: ...
                    }
                }

                We take the database user_id from data.user.id
                and send it to dashboard.
            */

            const userId = data.user.id;


            router.push({
                pathname: "/dashboard",

                params: {
                    userId: userId.toString()
                }
            });
        }

        catch (err)
        {
            console.log("Login error:", err);

            setError("Could not connect to the server.");
        }

        finally
        {
            setIsLoggingIn(false);
        }
    }


    return (
        <View style={styles.container}>

            <View style={styles.header}>
                <Text style={styles.headerTitle}>
                    UNT Student Login
                </Text>
            </View>


            <View style={styles.content}>

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.logo}
                />


                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                />


                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={true}
                />


                {error ? (
                    <Text style={styles.errorText}>
                        {error}
                    </Text>
                ) : null}


                <Pressable
                    style={[
                        styles.loginButton,
                        isLoggingIn && styles.disabledButton
                    ]}
                    onPress={handleLogin}
                    disabled={isLoggingIn}
                >

                    <Text style={styles.loginButtonText}>

                        {isLoggingIn
                            ? "Logging in..."
                            : "Login"}

                    </Text>

                </Pressable>


                <Pressable
                    onPress={() => router.push("/firstTimeEnroll")}
                >

                    <Text style={styles.enrollLink}>
                        Enroll Face
                    </Text>

                </Pressable>

            </View>

        </View>
    );
}


const styles = StyleSheet.create({

    container: {
        flex: 1,
        justifyContent: "center",
        padding: 20
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

    enrollLink: {
        marginTop: 15,
        textAlign: "center",
        color: "green",
        textDecorationLine: "underline",
        fontSize: 16
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

    errorText: {
        color: "red",
        textAlign: "center",
        marginBottom: 15
    },

    disabledButton: {
        opacity: 0.5
    }

});
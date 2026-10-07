import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Image,
    Pressable,
    Platform
} from "react-native";

import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useState } from "react";


import { API_BASE } from "../constants/api";


export default function LoginScreen()
{
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");

    const [isLoggingIn, setIsLoggingIn] = useState(false);


    async function handleLogin()
    {
        if (!email || !password)
        {
            setError("Please enter your email and password.");
            return;
        }

        try
        {
            setIsLoggingIn(true);
            setError("");


            const response = await fetch(`${API_BASE}/login`, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password: password,
                }),
            });


            const data = await response.json();


            if (!data.success)
            {
                setError(
                    data.message || "Login failed."
                );

                return;
            }

            //Save the JWT returned by FastAPI
            await SecureStore.setItem("access_token", data.access_token);

            //Save user information
            await SecureStore.setItem("user", JSON.stringify(data.user));   

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
            console.log(
                "Login error:",
                err
            );

            setError(
                "Could not connect to the server."
            );
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
                <Pressable
                    style={styles.adminButton}
                    onPress={() => router.push("/adminlogin")}
                >
                    <Text style={styles.adminButtonText}>Admin</Text>
                </Pressable>
            </View>


            <View style={styles.content}>

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.logo}
                />


                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="rgba(0, 0, 0, 0.65)"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />


                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="rgba(0, 0, 0, 0.65)"
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
                        isLoggingIn &&
                        styles.disabledButton
                    ]}
                    onPress={handleLogin}
                    disabled={isLoggingIn}
                >

                    <Text style={styles.loginButtonText}>

                        {
                            isLoggingIn
                                ? "Logging in..."
                                : "Login"
                        }

                    </Text>

                </Pressable>


                <Pressable
                    onPress={() =>
                        router.push("/enrollSignup")
                    }
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
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd"
    },

    adminButton: {
        backgroundColor: "white",
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 4,
        zIndex: 1
    },

    adminButtonText: {
        color: "#0f5c00",
        fontSize: 12,
        fontWeight: "bold"
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

import { View, Text, TextInput, StyleSheet, Image, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useState } from "react";

import { Ionicons, MaterialCommunityIcons  } from "@expo/vector-icons";

import { API_BASE } from "../constants/api";
import { Colors, Radius, Spacing } from "../constants/theme";


export default function LoginScreen()
{
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");

    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [showPassword, setShowPassword] = useState(false);


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

            // Save the JWT returned by FastAPI
            await SecureStore.setItem(
                "access_token",
                data.access_token
            );

            // Save user information
            await SecureStore.setItem(
                "user",
                JSON.stringify(data.user)
            );

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

        <KeyboardAvoidingView
            style={styles.container}
            behavior={
                Platform.OS === "ios"
                    ? "padding"
                    : undefined
            }
        >

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >


                {/* =====================================================
                    BRANDING
                ====================================================== */}

                <View style={styles.brandSection}>

                    <Image 
                        source={require("../assets/wave-bg.png")}
                        style={styles.waveBackground}
                        resizeMode="contain"
                    />

                    <Image
                        source={require("../assets/logo.png")}
                        style={styles.logo}
                        resizeMode="contain"
                    />


                    <Text style={styles.title}>
                        Student Sign In
                    </Text>


                    <Text style={styles.subtitle}>
                        Use your UNT credentials to access
                        biometric attendance.
                    </Text>

                </View>


                {/* =====================================================
                    LOGIN FORM
                ====================================================== */}

                <View style={styles.form}>


                    {/* Email */}

                    <View style={styles.inputWrapper}>

                        <Ionicons
                            name="mail-outline"
                            size={28}
                            color={Colors.textSecondary}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={Colors.textSecondary}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            autoCorrect={false}
                        />

                    </View>


                    {/* Password */}

                    <View style={styles.inputWrapper}>

                        <Ionicons
                            name="lock-closed-outline"
                            size={28}
                            color={Colors.textSecondary}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor={Colors.textSecondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />

                        <Pressable
                            onPress={() =>
                                setShowPassword(!showPassword)
                            }
                            hitSlop={10}
                        >

                            <Ionicons
                                name={
                                    showPassword
                                        ? "eye-outline"
                                        : "eye-off-outline"
                                }
                                size={28}
                                color={Colors.textSecondary}
                            />

                        </Pressable>

                    </View>


                    {/* Error */}

                    {error ? (

                        <Text style={styles.errorText}>
                            {error}
                        </Text>

                    ) : null}


                    {/* Login Button */}

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


                    {/* Enroll Face */}

                    <Pressable
                        style={styles.enrollButton}
                        onPress={() =>
                            router.push("/enrollSignup")
                        }
                    >

                        <Text style={styles.enrollLink}>
                            Enroll Face
                        </Text>

                    </Pressable>

                </View>


                {/* =====================================================
                    SECURITY FOOTER
                ====================================================== */}

                <View style={styles.securitySection}>

                    <View style={styles.securityDivider}>

                        <View style={styles.dividerLine} />

                        <View style={styles.securityIconCircle}>

                            <MaterialCommunityIcons 
                                name="shield-lock-outline"
                                size={30}
                                color={Colors.textSecondary}
                            />

                        </View>

                        <View style={styles.dividerLine} />

                    </View>


                    <Text style={styles.securityText}>
                        Use your UNT credentials to access
                        biometric attendance.
                    </Text>

                </View>


            </ScrollView>

        </KeyboardAvoidingView>
    );
}


const styles = StyleSheet.create({


    // ============================================================
    // PAGE
    // ============================================================

    container: {
        flex: 1,
        backgroundColor: Colors.background
    },


    scrollContent: {
        flexGrow: 1,

        paddingHorizontal: 32,
        paddingTop: 42,
        paddingBottom: 30,

        alignItems: "center"
    },


    // ============================================================
    // BRANDING
    // ============================================================

    brandSection: {
        width: "100%",
        alignItems: "center",
        position: "relative"
    },

    waveBackground: {
        position: "absolute",

        left: -125,

        width: 620,
        height: 320,

        opacity: 1,

        zIndex: 0
    },


    logo: {
        width: 220,
        height: 220,

        marginTop: 50,
        marginBottom: 60,

        zIndex: 1
    },


    title: {
        color: Colors.textPrimary,

        fontSize: 32,
        fontWeight: "800",

        textAlign: "center"
    },


    subtitle: {
        color: Colors.textSecondary,

        fontSize: 18,
        lineHeight: 24,

        textAlign: "center",

        maxWidth: 320,

        marginTop: 10,
        marginBottom: 28,

        zIndex: 1
    },


    // ============================================================
    // FORM
    // ============================================================

    form: {
        width: "100%",
        maxWidth: 370
    },


    inputWrapper: {
        minHeight: 64,

        flexDirection: "row",
        alignItems: "center",

        gap: Spacing.md,

        backgroundColor: Colors.surface,

        borderWidth: 1,
        borderColor: Colors.borderLight,
        borderRadius: Radius.lg,

        paddingHorizontal: 18,

        marginBottom: 14,

        shadowColor: Colors.textPrimary,
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: {
            width: 0,
            height: 4
        },

        elevation: 2
    },


    input: {
        flex: 1,

        color: Colors.textPrimary,

        fontSize: 18,

        outlineStyle: "none"
    } as any,


    errorText: {
        color: Colors.danger,

        textAlign: "center",

        fontSize: 14,

        marginBottom: 12
    },


    // ============================================================
    // LOGIN BUTTON
    // ============================================================

    loginButton: {
        minHeight: 62,

        backgroundColor: Colors.primary,

        borderRadius: Radius.lg,

        alignItems: "center",
        justifyContent: "center",

        marginTop: 4
    },


    loginButtonText: {
        color: Colors.surface,

        fontSize: 20,
        fontWeight: "800"
    },


    disabledButton: {
        opacity: 0.6
    },


    // ============================================================
    // ENROLL FACE
    // ============================================================

    enrollButton: {
        alignSelf: "center",

        marginTop: 22
    },


    enrollLink: {
        color: Colors.primary,

        fontSize: 19,
        fontWeight: "700",

        textDecorationLine: "underline"
    },


    // ============================================================
    // SECURITY FOOTER
    // ============================================================

    securitySection: {
        width: "100%",
        maxWidth: 420,

        marginTop: 34,

        alignItems: "center"
    },


    securityDivider: {
        width: "100%",

        flexDirection: "row",
        alignItems: "center",

        gap: 14
    },


    dividerLine: {
        flex: 1,

        height: 1,

        backgroundColor: Colors.border
    },


    securityIconCircle: {
        width: 44,
        height: 44,

        alignItems: "center",
        justifyContent: "center"
    },


    securityText: {
        color: Colors.textSecondary,

        fontSize: 16,
        lineHeight: 22,

        textAlign: "center",

        maxWidth: 320,

        marginTop: 10
    }

});
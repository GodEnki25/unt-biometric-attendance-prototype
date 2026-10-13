import { View, Text, TextInput, StyleSheet, Image, Pressable, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { API_BASE } from "@/constants/api";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Spacing, Radius } from "@/constants/theme";


export default function AdminLoginScreen()
{
    const router = useRouter();

    const {height} = useWindowDimensions();

    const shortViewport = height < 830;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);


    // ============================================================
    // ADMIN LOGIN
    // ============================================================

    const handleLogin = async () => {

        if (!email.trim() || !password) {
            setError("Please enter your email and password.");
            return;
        }

        setError("");
        setIsLoggingIn(true);

        try {

            const response = await fetch(`${API_BASE}/login`, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password
                })
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


            localStorage.setItem(
                "access_token",
                data.access_token
            );


            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );


            router.push("/adminDashboard");
        }

        catch (error) {

            console.error(
                "Admin login error:",
                error
            );

            setError(
                "Unable to connect to server."
            );
        }

        finally {
            setIsLoggingIn(false);
        }
    };


    return (

        <View style={styles.container}>


            {/* =====================================================
                TOP HEADER
            ====================================================== */}

            <View style={styles.topHeader}>

                <View style={styles.brandBox}>

                    <Image
                        source={require("../assets/logo.png")}
                        style={styles.logoBox}
                        resizeMode="contain"
                    />

                    <View style={styles.brandDivider} />

                    <Text style={styles.brandText}>
                        Attendance
                    </Text>

                </View>

            </View>


            {/* =====================================================
                MAIN CONTENT
            ====================================================== */}

            <View style={styles.content}>


                {/* =================================================
                    LEFT SIDE
                ================================================== */}

                <View style={styles.leftPanel}>

                    <Image
                        source={require("../assets/person-bg.png")}
                        style={styles.personBackground}
                        resizeMode="contain"
                    />


                    <View style={styles.leftAccent} />


                    <Text style={styles.heroTitle}>
                        Admin Access
                    </Text>


                    <Text style={styles.heroSubtitle}>
                        Administrative access to the Biometric
                        Attendance system.
                    </Text>


                    {/* Feature Row */}

                    <View style={styles.featureRow}>


                        {/* System Management */}

                        <View style={styles.featureItem}>

                            <View style={styles.featureIconCircle}>

                                <MaterialCommunityIcons
                                    name="cog-outline"
                                    size={36}
                                    color={Colors.primary}
                                />

                            </View>


                            <Text style={styles.featureTitle}>
                                System Management
                            </Text>


                            <Text style={styles.featureText}>
                                Manage users, courses, and settings.
                            </Text>

                        </View>


                        {/* System Monitoring */}

                        <View style={styles.featureItem}>

                            <View style={styles.featureIconCircle}>

                                <MaterialCommunityIcons
                                    name="database-outline"
                                    size={36}
                                    color={Colors.primary}
                                />

                            </View>


                            <Text style={styles.featureTitle}>
                                System Monitoring
                            </Text>


                            <Text style={styles.featureText}>
                                View logs and system status.
                            </Text>

                        </View>


                        {/* Secure Access */}

                        <View style={styles.featureItem}>

                            <View style={styles.featureIconCircle}>

                                <MaterialCommunityIcons
                                    name="shield-check-outline"
                                    size={36}
                                    color={Colors.primary}
                                />

                            </View>


                            <Text style={styles.featureTitle}>
                                Secure Access
                            </Text>


                            <Text style={styles.featureText}>
                                Restricted to authorized administrators only.
                            </Text>

                        </View>

                    </View>

                </View>


                {/* =================================================
                    LOGIN CARD
                ================================================== */}

                <View style={[styles.loginCard, shortViewport && styles.loginCardShort]}>


                    <Text style={styles.loginTitle}>
                        Admin Sign In
                    </Text>


                    <Text style={styles.loginSubtitle}>
                        Administrator access to the Biometric Attendance system.
                    </Text>


                    {/* Email */}

                    <Text style={styles.inputLabel}>
                        Email
                    </Text>


                    <View style={styles.inputWrapper}>

                        <Ionicons
                            name="mail-outline"
                            size={22}
                            color={Colors.textSecondary}
                        />


                        <TextInput
                            style={styles.input}
                            placeholder="name@unt.edu"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            placeholderTextColor={Colors.disabled}
                        />

                    </View>


                    {/* Password */}

                    <Text style={styles.inputLabel}>
                        Password
                    </Text>


                    <View style={styles.inputWrapper}>

                        <Ionicons
                            name="lock-closed-outline"
                            size={22}
                            color={Colors.textSecondary}
                        />


                        <TextInput
                            style={styles.input}
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={true}
                            placeholderTextColor={Colors.disabled}
                        />


                        <Ionicons
                            name="eye-off-outline"
                            size={22}
                            color={Colors.textSecondary}
                        />

                    </View>


                    {/* Forgot Password */}

                    <Pressable>

                        <Text style={styles.forgotPassword}>
                            Forgot password?
                        </Text>

                    </Pressable>


                    {/* Error */}

                    {error ? (

                        <Text style={styles.errorText}>
                            {error}
                        </Text>

                    ) : null}


                    {/* Sign In */}

                    <Pressable
                        style={[
                            styles.loginButton,
                            isLoggingIn &&
                            styles.loginButtonDisabled
                        ]}
                        onPress={handleLogin}
                        disabled={isLoggingIn}
                    >

                        <Text style={styles.loginButtonText}>
                            {isLoggingIn
                                ? "Signing In..."
                                : "Sign in"}
                        </Text>

                    </Pressable>


                    {/* Divider */}

                    <View style={styles.orRow}>

                        <View style={styles.orLine} />

                        <Text style={styles.orText}>
                            or
                        </Text>

                        <View style={styles.orLine} />

                    </View>


                    <Text style={styles.adminOnlyText}>
                        This area is restricted to authorized administrators.
                    </Text>


                    {/* Instructor Sign In */}

                    <Pressable
                        style={styles.instructorLinkRow}
                        onPress={() =>
                            router.replace("/loginInstructor")
                        }
                    >

                        <Ionicons
                            name="person-outline"
                            size={20}
                            color={Colors.primary}
                        />


                        <Text style={styles.instructorLinkText}>
                            Instructor? Sign in here
                        </Text>

                    </Pressable>

                </View>

            </View>

        </View>
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


    // ============================================================
    // HEADER
    // ============================================================

    topHeader: {
        minHeight: 86,

        backgroundColor: Colors.surface,

        flexDirection: "row",
        alignItems: "center",

        paddingHorizontal: 48,

        borderTopWidth: 10,
        borderTopColor: Colors.primary,

        borderBottomWidth: 1,
        borderBottomColor: Colors.tableBorder
    },


    brandBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md
    },


    logoBox: {
        width: 72,
        height: 72
    },


    brandDivider: {
        width: 2,
        height: 32,
        backgroundColor: Colors.border
    },


    brandText: {
        color: Colors.textPrimary,
        fontSize: 22,
        fontWeight: "700"
    },

    // ============================================================
    // MAIN CONTENT
    // ============================================================

    content: {
        flex: 1,

        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",

        paddingHorizontal: 64,
        paddingTop: 10,
        paddingBottom: 60,

        gap: 70
    },


    // ============================================================
    // LEFT PANEL
    // ============================================================

    leftPanel: {
        flex: 1,
        maxWidth: 650,

        paddingLeft: 70,
        paddingBottom: 70,

        position: "relative",
        overflow: "visible",

        transform: [{translateY: 10}]
    },


    personBackground: {
        position: "absolute",

        left: -275,
        bottom: -275,

        width: 560,
        height: 560,

        opacity: 0.50,

        zIndex: 0
    },


    leftAccent: {
        width: 76,
        height: 6,

        backgroundColor: Colors.primary,

        borderRadius: Radius.pill,

        marginBottom: 24
    },


    heroTitle: {
        color: Colors.textPrimary,

        fontSize: 53,
        lineHeight: 60,

        fontWeight: "800"
    },


    heroSubtitle: {
        color: Colors.textSecondary,

        fontSize: 30,
        lineHeight: 34,

        maxWidth: 600,

        marginTop: 16
    },


    // ============================================================
    // FEATURE ROW
    // ============================================================

    featureRow: {
        flexDirection: "row",

        gap: 36,

        marginTop: 30,
        marginLeft: 28,

        zIndex: 1
    },


    featureItem: {
        flex: 1
    },


    featureIconCircle: {
        width: 72,
        height: 72,

        borderRadius: Radius.pill,

        backgroundColor: Colors.featureIconBackground,

        alignItems: "center",
        justifyContent: "center",

        marginBottom: 14
    },


    featureTitle: {
        color: Colors.textPrimary,

        fontSize: 19,
        fontWeight: "700",

        marginBottom: 6
    },


    featureText: {
        color: Colors.textSecondary,

        fontSize: 16,
        lineHeight: 21
    },


    // ============================================================
    // LOGIN CARD
    // ============================================================

     rightPanel: {
        width: 520,
        alignItems: "flex-end",
        justifyContent: "center",
        marginLeft: 40,
        marginRight: 24,
    },

    loginCard: {
        width: "100%",
        maxWidth: 540,
        minHeight: 610,

        backgroundColor: Colors.surface,

        borderWidth: 2,
        borderColor: Colors.tableBorder,
        borderRadius: Radius.md,

        paddingHorizontal: 42,
        paddingVertical: 42,

        marginLeft: 10,
        marginTop: -45
    },

    loginCardShort: {
        alignSelf: "flex-start",
        marginTop: 24
    },


    loginTitle: {
        color: Colors.textPrimary,

        fontSize: 34,
        fontWeight: "800"
    },


    loginSubtitle: {
        color: Colors.textSecondary,

        fontSize: 20,
        lineHeight: 25,

        marginTop: 8,
        marginBottom: 28
    },


    // ============================================================
    // INPUTS
    // ============================================================

    inputLabel: {
        color: Colors.textPrimary,

        fontSize: 18,
        fontWeight: "700",

        marginBottom: 8,
        marginTop: 14
    },


    inputWrapper: {
        height: 56,

        flexDirection: "row",
        alignItems: "center",

        gap: 12,

        backgroundColor: Colors.surface,

        borderWidth: 2,
        borderColor: Colors.border,
        borderRadius: Radius.sm,

        paddingHorizontal: 16
    },


    input: {
        flex: 1,

        color: Colors.textPrimary,

        fontSize: 16,

        outlineStyle: "none"
    } as any,


    // ============================================================
    // FORGOT PASSWORD
    // ============================================================

    forgotPassword: {
        color: Colors.primary,

        fontSize: 15,
        fontWeight: "600",

        textAlign: "right",

        marginTop: 12
    },


    // ============================================================
    // ERROR
    // ============================================================

    errorText: {
        color: Colors.danger,

        fontSize: 14,

        marginTop: 12
    },


    // ============================================================
    // LOGIN BUTTON
    // ============================================================

    loginButton: {
        minHeight: 58,

        backgroundColor: Colors.primary,

        borderRadius: Radius.sm,

        alignItems: "center",
        justifyContent: "center",

        marginTop: 28
    },


    loginButtonDisabled: {
        opacity: 0.6
    },


    loginButtonText: {
        color: Colors.surface,

        fontSize: 18,
        fontWeight: "800"
    },


    // ============================================================
    // OR DIVIDER
    // ============================================================

    orRow: {
        flexDirection: "row",
        alignItems: "center",

        gap: 14,

        marginVertical: 24
    },


    orLine: {
        flex: 1,

        height: 2,

        backgroundColor: Colors.tableBorder
    },


    orText: {
        color: Colors.textSecondary,
        fontSize: 15
    },


    // ============================================================
    // INSTRUCTOR LINK
    // ============================================================

    adminOnlyText: {
        color: Colors.textSecondary,

        fontSize: 14,

        textAlign: "center"
    },


    instructorLinkRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",

        gap: 8,

        marginTop: 22
    },


    instructorLinkText: {
        color: Colors.primary,

        fontSize: 15,
        fontWeight: "600",

        textDecorationLine: "underline"
    }

});
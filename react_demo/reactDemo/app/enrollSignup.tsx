import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Image,
    Pressable,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from "react-native";

import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useState } from "react";

import { Ionicons } from "@expo/vector-icons";


import { API_BASE } from "../constants/api";
import { Colors, Radius, Spacing } from "../constants/theme";


export default function EnrollSignup() {

    const router = useRouter();

    const [fullName, setFullName] = useState("");
    const [studentId, setStudentId] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showPassword, setShowPassword] = useState(false);


    async function handleSignup() {

        if (
            !fullName.trim() ||
            !studentId.trim() ||
            !email.trim() ||
            !password.trim()
        ) {

            Alert.alert(
                "Missing Information",
                "Please fill in all fields."
            );

            return;
        }


        if (isSubmitting) {
            return;
        }


        setIsSubmitting(true);


        try {

            const response = await fetch(
                `${API_BASE}/signup`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        full_name: fullName.trim(),

                        student_id: studentId.trim(),

                        email: email.trim().toLowerCase(),

                        password: password,

                    })
                }
            );


            const result = await response.json();


            console.log(
                "Signup response:",
                result
            );


            if (!response.ok) {

                Alert.alert(
                    "Signup Failed",
                    result.detail ||
                    result.message ||
                    "Unable to create account."
                );

                return;
            }


            if (!result.user_id) {

                console.log(
                    "No user_id returned from backend"
                );


                Alert.alert(
                    "Signup Error",
                    "Account was created but no user ID was returned."
                );

                return;
            }

            await SecureStore.setItem("access_token", result.access_token);
            
            await SecureStore.setItem("user", JSON.stringify(result.user));


            console.log(
                "Signup user ID:",
                result.user_id
            );


            router.push({
                pathname: "/firstTimeEnroll",

                params: {
                    userId: result.user_id.toString()
                }
            });

        }

        catch (error) {

            console.log(
                "Signup error:",
                error
            );


            Alert.alert(
                "Connection Error",
                "Unable to connect to the backend."
            );
        }

        finally {

            setIsSubmitting(false);
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
                    source={require("../assets/logo.png")}
                    style={styles.logo}
                    resizeMode="contain"
                />


                <Text style={styles.title}>
                    Student Sign Up
                </Text>


                <Text style={styles.subtitle}>
                    Create your student account to continue
                    to biometric enrollment.
                </Text>

            </View>


            {/* =====================================================
                SIGNUP FORM
            ====================================================== */}

            <View style={styles.form}>


                {/* Full Name */}

                <View style={styles.inputWrapper}>

                    <Ionicons
                        name="person-outline"
                        size={28}
                        color={Colors.textSecondary}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        placeholderTextColor={Colors.textSecondary}
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                    />

                </View>


                {/* Student ID */}

                <View style={styles.inputWrapper}>

                    <Ionicons
                        name="card-outline"
                        size={28}
                        color={Colors.textSecondary}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Student ID"
                        placeholderTextColor={Colors.textSecondary}
                        value={studentId}
                        onChangeText={setStudentId}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                </View>


                {/* UNT Email */}

                <View style={styles.inputWrapper}>

                    <Ionicons
                        name="mail-outline"
                        size={28}
                        color={Colors.textSecondary}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="UNT Email"
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


                    {/* Show / Hide Password */}

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


                {/* Sign Up Button */}

                <Pressable
                    style={[
                        styles.signupButton,
                        isSubmitting &&
                        styles.disabledButton
                    ]}
                    onPress={handleSignup}
                    disabled={isSubmitting}
                >

                    <Text style={styles.signupButtonText}>
                        {
                            isSubmitting
                                ? "Creating Account..."
                                : "Sign Up"
                        }
                    </Text>

                </Pressable>


                {/* Back to Login */}

                <Pressable
                    style={styles.backButton}
                    onPress={() =>
                        router.push("/login")
                    }
                >

                    <Text style={styles.backLink}>
                        Back to login
                    </Text>

                </Pressable>

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
        alignItems: "center"
    },


    logo: {
        width: 220,
        height: 220,

        marginTop: 50,
        marginBottom: 45,

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

        maxWidth: 330,

        marginTop: 10,
        marginBottom: 28
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


    // ============================================================
    // SIGN UP BUTTON
    // ============================================================

    signupButton: {
        minHeight: 62,

        backgroundColor: Colors.primary,

        borderRadius: Radius.lg,

        alignItems: "center",
        justifyContent: "center",

        marginTop: 4
    },


    signupButtonText: {
        color: Colors.surface,

        fontSize: 20,
        fontWeight: "800"
    },


    disabledButton: {
        opacity: 0.6
    },


    // ============================================================
    // BACK TO LOGIN
    // ============================================================

    backButton: {
        alignSelf: "center",

        marginTop: 22
    },


    backLink: {
        color: Colors.primary,

        fontSize: 18,
        fontWeight: "700",

        textDecorationLine: "underline"
    }

});

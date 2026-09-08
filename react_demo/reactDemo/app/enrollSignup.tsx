import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Image,
    Pressable,
    Alert
} from "react-native";

import { useRouter } from "expo-router";
import { useState } from "react";


const API_BASE = "http://192.168.1.229:8000";


export default function EnrollSignup() {

    const router = useRouter();

    const [fullName, setFullName] = useState("");
    const [studentId, setStudentId] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);


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

                        role: "student"
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

        <View style={styles.container}>

            <View style={styles.header}>

                <Text style={styles.headerTitle}>
                    UNT Student Signup
                </Text>

            </View>


            <View style={styles.content}>

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.logo}
                />


                <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                />


                <TextInput
                    style={styles.input}
                    placeholder="Student ID"
                    value={studentId}
                    onChangeText={setStudentId}
                    autoCapitalize="none"
                />


                <TextInput
                    style={styles.input}
                    placeholder="UNT Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />


                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={true}
                />


                <Pressable
                    style={[
                        styles.loginButton,
                        isSubmitting && styles.disabledButton
                    ]}
                    onPress={handleSignup}
                    disabled={isSubmitting}
                >

                    <Text style={styles.loginButtonText}>

                        {
                            isSubmitting
                                ? "Creating Account..."
                                : "Signup"
                        }

                    </Text>

                </Pressable>


                <Pressable
                    onPress={() =>
                        router.push("/login")
                    }
                >

                    <Text style={styles.enrollLink}>
                        Back to login
                    </Text>

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


    disabledButton: {
        opacity: 0.6
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
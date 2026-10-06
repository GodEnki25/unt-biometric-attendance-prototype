import { View, Text, TextInput, StyleSheet, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { API_BASE } from "@/constants/api";
export default function AdminDashboardScreen() {
    const router = useRouter();
    const handlePasswords = () => console.log("handlePasswords pressed");
    const handleDB = () => console.log("handleDB pressed");
    const handleButton3 = () => console.log("Button 3 pressed");
    const handleButton4 = () => console.log("Button 4 pressed");
    const handleButton5 = () => console.log("Button 5 pressed");
    const handleButton6 = () => console.log("Button 6 pressed");
    const handleButton7 = () => console.log("Button 7 pressed");

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>UNT Admin Dashboard</Text>
                <Pressable
                                    style={styles.backButton}
                                    onPress={() => {
                                        if (router.canGoBack()) {
                                            router.back();
                                        } else {
                                            router.replace("/login");
                                        }
                                    }}
                                >

                
                <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
            </View>
                {/*
                10/5/2026 \
                So basically these buttons should go to the different sections that would handle the admin settings
                I don't exactly know how to handle the settings so here's the screen at least so that we can add things later. */}
            <View style={styles.content}>
                {/* Temporary placeholder buttons for the admin dashboard. These will be replaced later with real admin features. */}
                <View style={styles.buttonGrid}>
                    <Pressable style={styles.button} onPress={handlePasswords}>
                        <Text style={styles.buttonText}>Password Issues</Text>
                    </Pressable>
                    <Pressable style={styles.button} onPress={handleDB}>
                        <Text style={styles.buttonText}>Database Issues</Text>
                    </Pressable>
                    <Pressable style={styles.button} onPress={handleButton3}>
                        <Text style={styles.buttonText}>Button 3</Text>
                    </Pressable>
                    <Pressable style={styles.button} onPress={handleButton4}>
                        <Text style={styles.buttonText}>Button 4</Text>
                    </Pressable>
                    <Pressable style={styles.button} onPress={handleButton5}>
                        <Text style={styles.buttonText}>Button 5</Text>
                    </Pressable>
                    <Pressable style={styles.button} onPress={handleButton6}>
                        <Text style={styles.buttonText}>Button 6</Text>
                    </Pressable>
                    <Pressable style={styles.button} onPress={handleButton7}>
                        <Text style={styles.buttonText}>Button 7</Text>
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
    headerTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "white",
    },
    content: {
        flex: 1,
        padding: 20,
    },
    backButtonText: {
        color: "#0f5c00",
        fontSize: 14,
        fontWeight: "bold",
    },
    buttonGrid: {
        flexDirection: "column",
        alignContent: 'center',
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 12,
    },
    backButton: {
        backgroundColor: "white",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 4,
    },
    button: {
        width: "30%",
        backgroundColor: "#0f5c00",
        paddingVertical: 18,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 12,
    },
    buttonText: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
    },
});


import { View, Text, StyleSheet, Image, Pressable, ImageBackground, ScrollView, TouchableOpacity, } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
export default function InstructorDashboard()
{
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const students = [
        { name: "Sorel A.", time: "9:01am", status: "Present" },
        { name: "Andrew K", time: "9:05am", status: "Present" },
        { name: "Andres M.", time: "-", status: "Absent" },
        { name: "Shayan K.", time: "9:58am", status: "Late" }
    ];

    const getStatusStyle = (status: string) =>
    {
        if (status === "Present")
        {
            return styles.presentText;
        }
        if (status === "Absent")
        {
            return styles.absentText;
        }
        if (status === "Late")
        {
            return styles.lateText;
        }

        return styles.defaultStatusText;
    };

    return (
        <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.container}>
                {/* Top Header */}
                <View style={styles.topHeader}>
                    <Image
                        source={require("../assets/logo.png")}
                        style={styles.logoBox}
                    />

                    <Text style={styles.dashboardTitle}>Instructor Dashboard</Text>

                    <View style={styles.profileBox}>
                        <Text style={styles.profileText}>Professor Emptynow</Text>
                        <Image
                            source={require("../assets/empty.png")}
                            style={styles.profileIcon}
                        />
                    </View>
                </View>

                {/* Course / Room / Date Bar */}
                <View style={styles.infoBar}>
                    <Text style={styles.infoText}>
                        <Text style={styles.bold}>Course:</Text> CSCE 4901
                    </Text>

                    <Text style={styles.infoText}>
                        <Text style={styles.bold}>Room:</Text> 266
                    </Text>

                    <Text style={styles.infoText}>
                        <Text style={styles.bold}>Date:</Text> 03/06/26
                    </Text>
                </View>

                {/* Main Content */}
                <ScrollView contentContainerStyle={styles.mainContent}>
                    {/* Start / End Buttons */}
                    <View style={styles.sessionButtonsRow}>
                        <TouchableOpacity style={styles.startButton}>
                            <Text style={styles.sessionButtonText}>Start Session</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.endButton}>
                            <Text style={styles.sessionButtonText}>End Session</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Student Table */}
                    <View style={styles.tableContainer}>
                        <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderText, styles.colStudent]}>
                                Student
                            </Text>

                            <Text style={[styles.tableHeaderText, styles.colTime]}>
                                Entry Time
                            </Text>

                            <Text style={[styles.tableHeaderText, styles.colStatus]}>
                                Status
                            </Text>
                        </View>

                        {students.map((student, index) =>
                        {
                            return (
                                <View key={index} style={styles.tableRow}>
                                    <Text style={[styles.tableCellText, styles.colStudent]}>
                                        {student.name}
                                    </Text>

                                    <Text style={[styles.tableCellText, styles.colTime]}>
                                        {student.time}
                                    </Text>

                                    <Text
                                        style={[
                                            styles.tableCellText,
                                            styles.colStatus,
                                            getStatusStyle(student.status)
                                        ]}
                                    >
                                        V {student.status}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    {/* Bottom Buttons */}
                    <View style={styles.bottomButtonsRow}>
                        <TouchableOpacity style={styles.smallButton}>
                            <Text style={styles.smallButtonText}>Export CSV</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.smallButton}>
                            <Text style={styles.smallButtonText}>Refresh</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.smallButton}>
                            <Text style={styles.smallButtonText}>Override</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#f2f2f2"
    },

    container: {
        flex: 1
    },

    topHeader: {
        height: 90,
        backgroundColor: "#0b7d3b",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        justifyContent: "space-between"
    },

    logoBox: {
        width: 90,
        height: 90,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center"
    },

    logoText: {
        color: "white",
        fontSize: 20,
        fontWeight: "bold"
    },

    logoSubText: {
        color: "white",
        fontSize: 8,
        marginTop: 2,
        textAlign: "center"
    },

    dashboardTitle: {
        color: "white",
        fontSize: 22,
        fontWeight: "bold"
    },

    profileBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },

    profileText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold"
    },

    profileIcon: {
        width: 45,
        height: 45,
        backgroundColor: "white",
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center"
    },

    profileIconText: {
        fontSize: 22
    },

    infoBar: {
        backgroundColor: "#0b7d3b",
        marginHorizontal: 10,
        marginTop: 10,
        borderRadius: 15,
        paddingVertical: 12,
        paddingHorizontal: 20,
        flexDirection: "row",
        justifyContent: "space-between"
    },

    infoText: {
        color: "white",
        fontSize: 15
    },

    bold: {
        fontWeight: "bold"
    },

    mainContent: {
        paddingVertical: 20,
        paddingHorizontal: 10
    },

    sessionButtonsRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
        marginBottom: 25
    },

    startButton: {
        backgroundColor: "#0b7d3b",
        paddingVertical: 15,
        paddingHorizontal: 35,
        borderRadius: 40
    },

    endButton: {
        backgroundColor: "#ff2c2c",
        paddingVertical: 15,
        paddingHorizontal: 35,
        borderRadius: 40
    },

    sessionButtonText: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold"
    },

    tableContainer: {
        backgroundColor: "#f9fff9",
        borderRadius: 20,
        borderWidth: 2,
        borderColor: "#b6d7b6",
        padding: 15,
        marginHorizontal: 30
    },

    tableHeaderRow: {
        flexDirection: "row",
        marginBottom: 10
    },

    tableHeaderText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#0b7d3b"
    },

    tableRow: {
        flexDirection: "row",
        paddingVertical: 10
    },

    tableCellText: {
        fontSize: 15,
        color: "#222"
    },

    colStudent: {
        flex: 1.2
    },

    colTime: {
        flex: 1
    },

    colStatus: {
        flex: 1
    },

    presentText: {
        color: "#0b7d3b",
        fontWeight: "bold"
    },

    absentText: {
        color: "#ff2c2c",
        fontWeight: "bold"
    },

    lateText: {
        color: "#d7a300",
        fontWeight: "bold"
    },

    defaultStatusText: {
        color: "#222"
    },

    bottomButtonsRow: {
        flexDirection: "row",
        justifyContent: "space-evenly",
        marginTop: 25
    },

    smallButton: {
        backgroundColor: "#0b7d3b",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25
    },

    smallButtonText: {
        color: "white",
        fontWeight: "bold",
        fontSize: 14
    }
});
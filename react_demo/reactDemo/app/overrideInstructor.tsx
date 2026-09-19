
import { View, Text, StyleSheet, Image, Pressable, ImageBackground, ScrollView, TouchableOpacity, Platform, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState, useEffect } from "react";


import { API_BASE } from "../constants/api";

// 9/15/26
// Andrew added First Entry Time as the first time they 
// entered class so that the attendance status can be done
// Andrew thinks you might need to make some adjustments to the table later
// also added the time total for total time in class
// basically needs an equation that takes 
// (first entry time - first exit time) + if there is (entry time if there is one - next exit time or 
// whenever the session ends) however many times they have changes
//not sure if these changes break the override but thats the stuff.
// Next commit will probably be the actual override process which involves the auditInstructor file 
// being the audit thing on the wireframes thing. will probably have the status clickable and take
// you to the audit screen.
// Probably take the student ID as info and pass it through to the audit list and use that but
// i dont know how to change the actual information so Sorrel will probably have to implement
// the database changes here since I can't access it probably.
// Sorry for the inconvenience 
type CheckinRecord = {
    attendance_id: number;
    session_id: number;
    student_id: number;
    student_name: string;
    first_check_in_time: string; // 9/15/26 changes here
    total_time: string; // 9/15/26 changes here
    check_in_time: string;
    face_verified: number;
    location_verified: number;
    status: string;
};

type StudentRow = {
    name: string;
    firstentrytime: string; // 9/15/26 changes here
    entrytime: string;
    exittime: string;
    totaltime: string; // 9/15/26 changes here
    status: string;
};



export default function InstructorOverride()
{
    const [popupVisible, setPopupVisible] = useState<boolean>(false)
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const { course, room, date } = useLocalSearchParams<{
        course?: string;
        room?: string;
        date?: string;
    }>();
    const [students, setStudents] = useState<StudentRow[]>([]);

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

    const refreshPage = () => {
        window.location.reload();
    };

    const togglePopup = () => {
        setPopupVisible((prev) => !prev);
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

                    <Text style={styles.dashboardTitle}>Override Dashboard</Text>
                    {/* This is just a note for later but we should add the name for this here.
                    probably get the username of the stuff and put it here. */}
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
                    <View style={styles.infoField}>
                        <Text style={styles.infoText}>
                            <Text style={styles.bold}>Course: </Text>
                            {!course || course === "Choose Course"
                                ? "Not selected"
                                : course}
                        </Text>
                    </View>

                    <View style={styles.infoField}>
                        <Text style={styles.infoText}>
                            <Text style={styles.bold}>Room: </Text>
                            {!room || room === "Room Number"
                                ? "Not selected"
                                : room}
                        </Text>
                    </View>

                    <View style={styles.infoField}>
                        <Text style={styles.infoText}>
                            <Text style={styles.bold}>Date: </Text>
                            {!date || date === "Date"
                                ? "Not selected"
                                : date}
                        </Text>
                    </View>
                </View>

                {/* Main Content */}
                <ScrollView contentContainerStyle={styles.mainContent}>

                    {/* Student Table */}
                    {course === "Choose Course" || room === "Room Number" || date === "Date" ? (
                        <View style={styles.invalidInputBox}>
                            <Text style={styles.invalidInputText}>
                                Missing Course, Room, or Date input. Please select valid Options.
                            </Text>
                        </View>
                    ) : (
                    <View
                        style={styles.tableContainer}
                    >

                        <View
                            style={
                                styles.tableHeaderRow
                            }
                        >
                            <Text
                                style={[
                                    styles.tableHeaderText,
                                    styles.colStudent
                                ]} 
                            >
                                Student
                            </Text>
                            {/* 9/15/26 changes here for First Entry Time */}
                            <Text
                                style={[
                                    styles.tableHeaderText,
                                    styles.colTime
                                ]}
                            >
                                First Entry Time
                            </Text>

                            <Text
                                style={[
                                    styles.tableHeaderText,
                                    styles.colTime
                                ]}
                            >
                                Latest Entry Time
                            </Text>

                            <Text
                                style={[
                                    styles.tableHeaderText,
                                    styles.colTime
                                ]}
                            >
                                Latest Exit Time
                            </Text>
                            {/* 9/15/26 changes here for First Entry Time */}
                            <Text
                                style={[
                                    styles.tableHeaderText,
                                    styles.colTime
                                ]}
                            >
                            Total Time in Class
                            </Text>
                            <Text
                                style={[
                                    styles.tableHeaderText,
                                    styles.colStatus
                                ]}
                            >
                                Status
                            </Text>
                        </View>


                        {loading ? (
                            <Text
                                style={
                                    styles.loadingText
                                }
                            >
                                Loading attendance...
                            </Text>

                        ) : students.length === 0 ? (

                            <Text
                                style={
                                    styles.loadingText
                                }
                            >
                                No attendance records found.
                            </Text>

                        ) : (

                            students.map(
                                (
                                    student,
                                    index
                                ) => (
                                    <View
                                        key={index}
                                        style={
                                            styles.tableRow
                                        }
                                    >{/* 9/15/26 made this a popup so that there's a way to view 
                                    the students information like everytime they clocked in and clocked out.
                                    Probably something like
                                    a small table inside there.*/}
                                        <Pressable onPress={togglePopup}>
                                        <Text
                                            style={[
                                                styles.tableCellText,
                                                styles.colStudent,
                                                styles.linkText
                                            ]}
                                        >
                                            {
                                                student.name
                                            }
                                        </Text></Pressable>
                                        {popupVisible && ( <View style={styles.popupBox}>
                                    <Text style={styles.popupText}>Clicking Student opens this popup.</Text>
                                    <TouchableOpacity onPress={togglePopup}>
                                        <Text style={styles.popupClose}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                                            {/* 9/15/26 changes here for First Entry Time */}
                                        <Text
                                            style={[
                                                styles.tableCellText,
                                                styles.colTime
                                            ]}
                                        >
                                            {
                                                student.firstentrytime
                                            }
                                        </Text>
                                        <Text
                                            style={[
                                                styles.tableCellText,
                                                styles.colTime
                                            ]}
                                        >
                                            {
                                                student.entrytime
                                            }
                                        </Text>

                                        <Text
                                            style={[
                                                styles.tableCellText,
                                                styles.colTime
                                            ]}
                                        >
                                            {
                                                student.exittime
                                            }
                                        </Text>
                                            {/* 9/15/26 changes here for total time */}
                                        <Text
                                            style={[
                                                styles.tableCellText,
                                                styles.colTime
                                            ]}
                                        >
                                            {
                                                student.totaltime
                                            }
                                        </Text>
                                        {/* 9/15/26 Probably make this clickable to go to the audit screen. */}
                                        <Text
                                            style={[
                                                styles.tableCellText,
                                                styles.colStatus,
                                                getStatusStyle(
                                                    student.status
                                                )
                                            ]}
                                        >
                                            {
                                                student.status
                                            }
                                        </Text>
                                    </View>
                                )
                            )

                        )}

                    </View>)}


                    {/* Bottom Buttons */}
                    <View style={styles.bottomButtonsRow}>
                        <TouchableOpacity style={styles.smallButton} onPress={() => router.push("/dashboardInstructor")}>
                            <Text style={styles.smallButtonText}>Back to Dashboard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.smallButton} onPress={refreshPage}>
                            <Text style={styles.smallButtonText}>Refresh</Text>
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

    infoField: {
        flex: 1,
        paddingHorizontal: 10
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

    invalidInputBox: {
        height: 250,
        marginHorizontal: 30,
        borderWidth: 2,
        borderColor: "#b6d7b6",
        backgroundColor: "#f9fff9",
        justifyContent: "center",
        alignItems: "center"
    },

    invalidInputText: {
        color: "#000000",
        fontSize: 20,
        fontWeight: "bold"
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

    linkText: {
        color: "#0b7d3b",
        textDecorationLine: "underline",
        fontWeight: "bold"
    },

    popupBox: {
        position: "absolute",
        top: 30,
        left: 0,
        width: 190,
        backgroundColor: "#ffffff",
        borderColor: "#cfe4d1",
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10
    },

    popupText: {
        color: "#222",
        fontSize: 13,
        marginBottom: 6
    },

    popupClose: {
        color: "#0b7d3b",
        fontWeight: "bold",
        fontSize: 12,
        textAlign: "right"
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
    },

    dropdownButton: {
        height: 50,
        borderWidth: 1,
        borderColor: '#999',
        borderRadius: 8,
        paddingHorizontal: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
    },

    buttonText: {
        color: "#0b7d3b",
        fontSize: 16,
    },

    arrow: {
        color: "#0b7d3b",
        fontSize: 14,
    },
    dropdownMenu: {
        
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#999',
        borderRadius: 8,
        backgroundColor: 'white',
        overflow: 'hidden',
        color: "#0b7d3b"
    },  
    dropdownItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },

    itemText: {
        fontSize: 16,
    },
    
    loadingText: {
        paddingVertical: 20,
        textAlign: "center",
        color: "#666"
    }
});
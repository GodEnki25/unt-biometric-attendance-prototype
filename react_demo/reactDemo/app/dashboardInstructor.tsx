import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    TouchableOpacity,
    Platform,
    Alert
} from "react-native";

import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";


const API_BASE =
    Platform.OS === "web"
        ? "http://127.0.0.1:8000"
        : "http://192.168.1.213:8000";


type CheckinRecord = {
    attendance_id: number;
    session_id: number;
    student_id: number;
    student_name: string;
    check_in_time: string;
    face_verified: number;
    location_verified: number;
    status: string;
};


type StudentRow = {
    name: string;
    entrytime: string;
    exittime: string;
    status: string;
};


export default function InstructorDashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loading, setLoading] = useState(false);

    const [openDropdown, setOpenDropdown] =
        useState<number | null>(null);

    const [selectedItem1, setSelectedItem1] =
        useState("Choose Course");

    const [selectedItem2, setSelectedItem2] =
        useState("Room Number");

    const [selectedItem3, setSelectedItem3] =
        useState("Date");


    const allowed_courses = [
        "CSCE 4901.501",
        "CSCE 4902.501",
        "CSCE 4902.502"
    ];

    const allowed_rooms = [
        "266",
        "267",
        "420",
        "67"
    ];

    const allowed_dates = [
        "09/01/26",
        "08/31/26",
        "08/28/26"
    ];


    const getStatusStyle = (status: string) => {
        if (status === "Present") {
            return styles.presentText;
        }

        if (status === "Absent") {
            return styles.absentText;
        }

        if (status === "Late") {
            return styles.lateText;
        }

        return styles.defaultStatusText;
    };


const formatTime = (dateTime: string) => {
    if (!dateTime) {
        return "-";
    }

    const parts = dateTime.split(" ");

    if (parts.length < 2) {
        return "-";
    }

    const timeParts = parts[1].split(":");

    if (timeParts.length < 2) {
        return "-";
    }

    const hour = parseInt(timeParts[0], 10);
    const minute = timeParts[1];

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${period}`;
};


    const formatStatus = (status: string) => {
        if (!status) {
            return "Unknown";
        }

        return (
            status.charAt(0).toUpperCase() +
            status.slice(1)
        );
    };


    const loadCheckins = async () => {
        try {
            setLoading(true);

            const response = await fetch(
                `${API_BASE}/checkins`
            );

            if (!response.ok) {
                throw new Error(
                    `Server returned ${response.status}`
                );
            }

            const records: CheckinRecord[] =
                await response.json();

            /*
             * For now, show the latest attendance record
             * for each student.
             *
             * Later we can filter this by:
             * course
             * session
             * date
             */
            const latestByStudent =
                new Map<number, CheckinRecord>();

            records.forEach((record) => {
                const existing =
                    latestByStudent.get(
                        record.student_id
                    );

                if (
                    !existing ||
                    record.attendance_id >
                        existing.attendance_id
                ) {
                    latestByStudent.set(
                        record.student_id,
                        record
                    );
                }
            });


            const formattedStudents: StudentRow[] =
                Array.from(
                    latestByStudent.values()
                ).map((record) => ({
                    name:
                        record.student_name ??
                        `Student ${record.student_id}`,

                    entrytime: formatTime(
                        record.check_in_time
                    ),

                    exittime: "-",

                    status: formatStatus(
                        record.status
                    )
                }));


            setStudents(formattedStudents);

        } catch (error) {
            console.error(
                "Failed to load check-ins:",
                error
            );

            Alert.alert(
                "Unable to load attendance",
                "The dashboard could not reach the backend."
            );

        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        loadCheckins();
    }, []);


    const toggleDropdown = (
        dropdownNumber: number
    ) => {
        if (openDropdown === dropdownNumber) {
            setOpenDropdown(null);
        } else {
            setOpenDropdown(dropdownNumber);
        }
    };


    const downloadCSVFile = () => {
        if (Platform.OS !== "web") {
            Alert.alert(
                "Export CSV",
                "Mobile CSV export will be connected later."
            );
            return;
        }

        const header =
            "Student,Latest Entry Time,Latest Exit Time,Status\n";

        const rows = students
            .map(
                (student) =>
                    `"${student.name}","${student.entrytime}","${student.exittime}","${student.status}"`
            )
            .join("\n");

        const csv = header + rows;

        const blob = new Blob(
            [csv],
            {
                type: "text/csv"
            }
        );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            "attendance.csv";

        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    };


    return (
        <View
            style={[
                styles.safe,
                {
                    paddingTop: insets.top,
                    paddingBottom: insets.bottom
                }
            ]}
        >
            <View style={styles.container}>

                {/* Top Header */}
                <View style={styles.topHeader}>

                    <Image
                        source={require("../assets/logo.png")}
                        style={styles.logoBox}
                    />

                    <Text style={styles.dashboardTitle}>
                        Instructor Dashboard
                    </Text>

                    <View style={styles.profileBox}>

                        <Text style={styles.profileText}>
                            Professor Emptynow
                        </Text>

                        <Image
                            source={require("../assets/empty.png")}
                            style={styles.profileIcon}
                        />

                    </View>

                </View>


                {/* Course / Room / Date Bar */}
                <View style={styles.infoBar}>

                    {/* Course */}
                    <View style={styles.infoSection}>

                        <Text style={styles.infoLabel}>
                            Course:
                        </Text>

                        <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() =>
                                toggleDropdown(1)
                            }
                        >
                            <Text style={styles.buttonText}>
                                {selectedItem1}
                            </Text>

                            <Text style={styles.arrow}>
                                {openDropdown === 1
                                    ? "▲"
                                    : "▼"}
                            </Text>
                        </TouchableOpacity>

                        {openDropdown === 1 && (
                            <View
                                style={
                                    styles.dropdownMenu
                                }
                            >
                                {allowed_courses.map(
                                    (item) => (
                                        <TouchableOpacity
                                            key={item}
                                            style={
                                                styles.dropdownItem
                                            }
                                            onPress={() => {
                                                setSelectedItem1(
                                                    item
                                                );

                                                setOpenDropdown(
                                                    null
                                                );
                                            }}
                                        >
                                            <Text
                                                style={
                                                    styles.itemText
                                                }
                                            >
                                                {item}
                                            </Text>
                                        </TouchableOpacity>
                                    )
                                )}
                            </View>
                        )}

                    </View>


                    {/* Room */}
                    <View style={styles.infoSection}>

                        <Text style={styles.infoLabel}>
                            Room:
                        </Text>

                        <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() =>
                                toggleDropdown(2)
                            }
                        >
                            <Text style={styles.buttonText}>
                                {selectedItem2}
                            </Text>

                            <Text style={styles.arrow}>
                                {openDropdown === 2
                                    ? "▲"
                                    : "▼"}
                            </Text>
                        </TouchableOpacity>

                        {openDropdown === 2 && (
                            <View
                                style={
                                    styles.dropdownMenu
                                }
                            >
                                {allowed_rooms.map(
                                    (item) => (
                                        <TouchableOpacity
                                            key={item}
                                            style={
                                                styles.dropdownItem
                                            }
                                            onPress={() => {
                                                setSelectedItem2(
                                                    item
                                                );

                                                setOpenDropdown(
                                                    null
                                                );
                                            }}
                                        >
                                            <Text
                                                style={
                                                    styles.itemText
                                                }
                                            >
                                                {item}
                                            </Text>
                                        </TouchableOpacity>
                                    )
                                )}
                            </View>
                        )}

                    </View>


                    {/* Date */}
                    <View style={styles.infoSection}>

                        <Text style={styles.infoLabel}>
                            Date:
                        </Text>

                        <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() =>
                                toggleDropdown(3)
                            }
                        >
                            <Text style={styles.buttonText}>
                                {selectedItem3}
                            </Text>

                            <Text style={styles.arrow}>
                                {openDropdown === 3
                                    ? "▲"
                                    : "▼"}
                            </Text>
                        </TouchableOpacity>

                        {openDropdown === 3 && (
                            <View
                                style={
                                    styles.dropdownMenu
                                }
                            >
                                {allowed_dates.map(
                                    (item) => (
                                        <TouchableOpacity
                                            key={item}
                                            style={
                                                styles.dropdownItem
                                            }
                                            onPress={() => {
                                                setSelectedItem3(
                                                    item
                                                );

                                                setOpenDropdown(
                                                    null
                                                );
                                            }}
                                        >
                                            <Text
                                                style={
                                                    styles.itemText
                                                }
                                            >
                                                {item}
                                            </Text>
                                        </TouchableOpacity>
                                    )
                                )}
                            </View>
                        )}

                    </View>

                </View>


                {/* Main Content */}
                <ScrollView
                    contentContainerStyle={
                        styles.mainContent
                    }
                >

                    {/* Start / End Buttons */}
                    <View
                        style={
                            styles.sessionButtonsRow
                        }
                    >

                        <TouchableOpacity
                            style={styles.startButton}
                        >
                            <Text
                                style={
                                    styles.sessionButtonText
                                }
                            >
                                Start Session
                            </Text>
                        </TouchableOpacity>


                        <TouchableOpacity
                            style={styles.endButton}
                        >
                            <Text
                                style={
                                    styles.sessionButtonText
                                }
                            >
                                End Session
                            </Text>
                        </TouchableOpacity>

                    </View>


                    {/* Student Table */}
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
                                    >
                                        <Text
                                            style={[
                                                styles.tableCellText,
                                                styles.colStudent
                                            ]}
                                        >
                                            {
                                                student.name
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

                    </View>


                    {/* Bottom Buttons */}
                    <View
                        style={
                            styles.bottomButtonsRow
                        }
                    >

                        <TouchableOpacity
                            style={styles.smallButton}
                            onPress={() =>
                                router.push(
                                    "/overrideInstructor"
                                )
                            }
                        >
                            <Text
                                style={
                                    styles.smallButtonText
                                }
                            >
                                Override
                            </Text>
                        </TouchableOpacity>


                        <TouchableOpacity
                            style={styles.smallButton}
                            onPress={
                                downloadCSVFile
                            }
                        >
                            <Text
                                style={
                                    styles.smallButtonText
                                }
                            >
                                Export CSV
                            </Text>
                        </TouchableOpacity>


                        <TouchableOpacity
                            style={styles.smallButton}
                            onPress={loadCheckins}
                        >
                            <Text
                                style={
                                    styles.smallButtonText
                                }
                            >
                                Refresh
                            </Text>
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
        justifyContent: "space-between",
        gap: 10,
        zIndex: 10
    },

    infoSection: {
        flex: 1,
        position: "relative"
    },

    infoLabel: {
        color: "white",
        fontSize: 15,
        fontWeight: "bold",
        marginBottom: 5
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
    },

    dropdownButton: {
        height: 50,
        borderWidth: 1,
        borderColor: "#999",
        borderRadius: 8,
        paddingHorizontal: 15,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "white"
    },

    buttonText: {
        color: "#0b7d3b",
        fontSize: 16
    },

    arrow: {
        color: "#0b7d3b",
        fontSize: 14
    },

    dropdownMenu: {
        marginTop: 5,
        borderWidth: 1,
        borderColor: "#999",
        borderRadius: 8,
        backgroundColor: "white",
        overflow: "hidden"
    },

    dropdownItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: "#eee"
    },

    itemText: {
        fontSize: 16
    },

    loadingText: {
        paddingVertical: 20,
        textAlign: "center",
        color: "#666"
    }

});
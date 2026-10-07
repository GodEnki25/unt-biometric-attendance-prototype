
import { View, Text, StyleSheet, Image, Pressable, ImageBackground, ScrollView, TouchableOpacity, TextInput, Platform, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState } from "react";


const API_BASE =
    Platform.OS === "web"
        ? "http://127.0.0.1:8000"
        : "http://192.168.1.213:8000";

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

export default function AuditInstructor()
{
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const students = [
        { name: "Sorel A.", entrytime: "9:01am",  exittime: "-", status: "Present" },
        { name: "Andrew K", entrytime: "9:05am", exittime: "-", status: "Present" },
        { name: "Andres M.", entrytime: "-", exittime: "-", status: "Absent" },
        { name: "Shayan K.", entrytime: "9:58am", exittime: "-", status: "Late" }
    ];
     const { course, room, date, studentName, status } = useLocalSearchParams<{
            course?: string;
            room?: string;
            date?: string;
            studentName?: string;
            status?: string;

        }>();
    const statusOptions = ["Present", "Absent", "Late"];
    const [selectedStatus, setSelectedStatus] = useState(
        status && statusOptions.includes(status) ? status : "Present"
    );
    const [reason, setReason] = useState("");
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);

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
    const [openDropdown, setOpenDropdown] = useState<number | null>(null);
    const [selectedItem1, setSelectedItem1] = useState('Choose Course'); 
    const [selectedItem2, setSelectedItem2] = useState('Room Number');
    const [selectedItem3, setSelectedItem3] = useState('Date');//track selected item
    //most likely have multiple copies of this to choose classes and all the other stuff instead of just having select an item.
    const [isOpen, setIsOpen] = useState(false); //track if dropdown menu open
    const allowed_courses = ['CSCE 4901.501', 'CSCE 4902.501', 'CSCE 4902.502']; //example list of dropdown
    const allowed_rooms = ['266', '267', '420', '67'];
    const allowed_dates = ['09/01/26', '08/31/26', '08/28/26'];
    const toggleDropdown = (dropdownNumber: number) => {
        if (openDropdown === dropdownNumber) {
            setOpenDropdown(null);
        } else {
            setOpenDropdown(dropdownNumber);
        }
    };

    const refreshPage = () => {
        window.location.reload();
    };
    const downloadCSVFile = () => { // should be for downloading the csv file need update
        const text = 'apple'; // text for now. will need to update later
        const blob = new Blob([text], {
            type: 'text/plain',
        });
        const url = URL.createObjectURL(blob);// Create a temporary URL for the file
        const link = document.createElement('a'); // Create a temporary HTML download link
        link.href = url;// Set the link to the temporary file
        link.download = 'test.txt';// Set the filename
        document.body.appendChild(link);// Add the link to the webpage
        link.click();// Automatically click the link to start the download
        document.body.removeChild(link);// Remove the temporary link
        URL.revokeObjectURL(url); // Clean up the temporary URL
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

                    <Text style={styles.dashboardTitle}>Override</Text>

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
                    <View style={styles.tableContainer}>
                        <View style={styles.formLine}>
                            <Text style={styles.formLabel}>Student:</Text>
                            <Text style={styles.studentName}>
                                {typeof studentName === "string" ? studentName : "Unknown student"}
                            </Text>
                        </View>

                        <View style={styles.formLine}>
                            <Text style={styles.formLabel}>Status:</Text>
                            <View style={styles.statusField}>
                                <TouchableOpacity
                                    style={styles.statusDropdown}
                                    onPress={() => setStatusMenuOpen((open) => !open)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Status: ${selectedStatus}`}
                                >
                                    <Text style={[styles.statusDropdownText, getStatusStyle(selectedStatus)]}>
                                        {selectedStatus}
                                    </Text>
                                    <Text style={styles.dropdownArrow}>{statusMenuOpen ? "▲" : "▼"}</Text>
                                </TouchableOpacity>
                                {statusMenuOpen && (
                                    <View style={styles.statusMenu}>
                                        {statusOptions.map((option) => (
                                            <TouchableOpacity
                                                key={option}
                                                style={[
                                                    styles.statusOption,
                                                    option === selectedStatus && styles.selectedStatusOption
                                                ]}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: option === selectedStatus }}
                                                onPress={() => {
                                                    setSelectedStatus(option);
                                                    setStatusMenuOpen(false);
                                                }}
                                            >
                                                <Text style={[
                                                    styles.statusOptionText,
                                                    getStatusStyle(option),
                                                    option === selectedStatus && styles.selectedStatusOptionText
                                                ]}>
                                                    {option}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>

                        <Text
                            pointerEvents="none"
                            style={[styles.formLabel, styles.reasonLabel]}
                        >
                            Reason:
                        </Text>
                        <TextInput
                            style={styles.reasonInput}
                            value={reason}
                            onChangeText={setReason}
                            placeholder="Reason Given..."
                            placeholderTextColor="rgba(0, 0, 0, 0.65)"
                            multiline
                            textAlignVertical="top"
                        />

                        <View style={styles.formButtons}>
                            <TouchableOpacity
                                style={[styles.smallButton, styles.cancelButton]}
                                onPress={() => router.push("/overrideInstructor")}
                            >
                                <Text style={styles.smallButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.smallButton, styles.saveButton]}
                                onPress={() => router.push("/dashboardInstructor")}
                            >
                                <Text style={styles.smallButtonText}>Save Changes</Text>
                            </TouchableOpacity>
                        </View>
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
        flexGrow: 1,
        paddingVertical: 20,
        paddingHorizontal: 10,
        justifyContent: "flex-start",
        alignItems: "center"
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
        width: "100%",
        maxWidth: 560,
        backgroundColor: "#ffffff",
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#000000",
        padding: 24
    },

    formLine: {
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 12
    },

    formLabel: {
        color: "#222222",
        fontSize: 16,
        fontWeight: "bold"
    },

    studentName: {
        color: "#222222",
        fontSize: 16,
        flexShrink: 1
    },

    statusField: {
        flex: 1,
        position: "relative",
        zIndex: 20,
        elevation: 20
    },

    statusDropdown: {
        minHeight: 44,
        borderWidth: 1,
        borderColor: "#777777",
        borderRadius: 4,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#ffffff"
    },

    statusDropdownText: {
        color: "#222222",
        fontSize: 16
    },

    dropdownArrow: {
        color: "#222222",
        fontSize: 12
    },

    statusMenu: {
        position: "absolute",
        top: 46,
        left: 0,
        right: 0,
        backgroundColor: "#ffffff",
        borderColor: "#777777",
        borderWidth: 1,
        zIndex: 21,
        elevation: 21
    },

    statusOption: {
        minHeight: 42,
        justifyContent: "center",
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#eeeeee"
    },

    statusOptionText: {
        color: "#222222",
        fontSize: 16
    },

    selectedStatusOption: {
        backgroundColor: "#f0f4f0"
    },

    selectedStatusOptionText: {
        fontWeight: "bold"
    },

    reasonLabel: {
        alignSelf: "flex-start",
        lineHeight: 20,
        marginBottom: 8
    },

    reasonInput: {
        minHeight: 160,
        width: "100%",
        borderWidth: 1,
        borderColor: "#777777",
        borderRadius: 4,
        padding: 12,
        color: "#222222",
        fontSize: 16,
        backgroundColor: "#ffffff",
        marginBottom: 20
    },

    formButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12
    },

    cancelButton: {
        backgroundColor: "#666666"
    },

    saveButton: {
        backgroundColor: "#0b7d3b"
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
    infoField: {
        flex: 1,
        paddingHorizontal: 10
    }
});
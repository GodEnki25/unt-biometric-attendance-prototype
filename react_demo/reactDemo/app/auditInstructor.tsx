
import { View, Text, StyleSheet, Image, Pressable, ImageBackground, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState } from "react";
export default function InstructorOverride()
{
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const students = [
        { name: "Sorel A.", entrytime: "9:01am",  exittime: "-", status: "Present" },
        { name: "Andrew K", entrytime: "9:05am", exittime: "-", status: "Present" },
        { name: "Andres M.", entrytime: "-", exittime: "-", status: "Absent" },
        { name: "Shayan K.", entrytime: "9:58am", exittime: "-", status: "Late" }
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

                    <Text style={styles.dashboardTitle}>Override WORK IN PROGRESS</Text>

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
                        <Text style={styles.bold}>Course:</Text> 
                            <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => toggleDropdown(1)}
                        > {/* selectedItem1 is courses */}
                            <Text style={styles.buttonText}>{selectedItem1}</Text> 
                            {/* update list to choose the first item instead of this. place holder for now CSCE 4901*/}
                            <Text style={styles.arrow}>{openDropdown === 1 ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {openDropdown === 1 && (
                            <View style={styles.dropdownMenu}>
                                {allowed_courses.map((item) => (
                                    <TouchableOpacity
                                        key={item}
                                        style={styles.dropdownItem}
                                        onPress={() => {
                                            setSelectedItem1(item);
                                            setOpenDropdown(null);
                                        }}
                                        >
                                        <Text style={styles.itemText}>{item}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            )}
                    </Text>

                    <Text style={styles.infoText}>
                        <Text style={styles.bold}>Room:</Text>                             
                            <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => toggleDropdown(2)}
                        > {/* selectedItem2 is rooms */}
                            <Text style={styles.buttonText}>{selectedItem2}</Text> 
                            {/* update list to choose the first item instead of this. place holder for now CSCE 4901*/}
                            <Text style={styles.arrow}>{openDropdown === 2 ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {openDropdown === 2 && (
                            <View style={styles.dropdownMenu}>
                                {allowed_rooms.map((item) => (
                                    <TouchableOpacity
                                        key={item}
                                        style={styles.dropdownItem}
                                        onPress={() => {
                                            setSelectedItem2(item);
                                            setOpenDropdown(null);
                                        }}
                                        >
                                        <Text style={styles.itemText}>{item}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            )}
                    </Text>

                    <Text style={styles.infoText}>
                        <Text style={styles.bold}>Date:</Text> 
                            <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => toggleDropdown(3)} > {/* change when copied */} {/* selectedItem3 is dates */} 
                            <Text style={styles.buttonText}>{selectedItem3}</Text> {/* change when copied */}
                            {/* update list to choose the first item instead of this. place holder for now CSCE 4901*/}
                            <Text style={styles.arrow}>{openDropdown === 3 ? '▲' : '▼'}</Text> {/* change when copied */}
                        </TouchableOpacity>
                        {openDropdown === 3 && ( //change when copied
                            <View style={styles.dropdownMenu}>
                                {allowed_dates.map((item) => ( // change when copied
                                    <TouchableOpacity
                                        key={item}
                                        style={styles.dropdownItem}
                                        onPress={() => {
                                            setSelectedItem3(item); // change when copied
                                            setOpenDropdown(null);
                                        }}
                                        >
                                        <Text style={styles.itemText}>{item}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            )}
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
                                Latest Entry Time
                            </Text> {/* If exit time is greater then entry then exit is --*/}

                            <Text style={[styles.tableHeaderText, styles.colTime]}>
                                Latest Exit Time
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
                                        {student.entrytime}
                                    </Text>
                                    <Text style={[styles.tableCellText, styles.colTime]}>
                                        {student.exittime}
                                    </Text>

                                    <Text
                                        style={[
                                            styles.tableCellText,
                                            styles.colStatus,
                                            getStatusStyle(student.status)
                                        ]}
                                    >
                                        {student.status} {/* removed V and put it in override */}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    {/* Bottom Buttons */}
                    <View style={styles.bottomButtonsRow}>
                        <TouchableOpacity style={styles.smallButton}> {/* add this when ready
                        onPress={() => router.push("/overrideInstructor")}*/}
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
});
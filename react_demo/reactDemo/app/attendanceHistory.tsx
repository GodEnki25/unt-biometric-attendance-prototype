
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function AttendanceHistoryScreen()
{
    const router = useRouter();

    const attendanceData = [
        { date: "Date1", status: "Present", entry: "TimeEntry", exit: "TimeExit" },
        { date: "Date2", status: "Present", entry: "TimeEntry2", exit: "TimeExit2" },
        { date: "Date3", status: "Late", entry: "TimeEntry3", exit: "TimeExit3" },
        { date: "Date4", status: "Absent", entry: "---", exit: "---" }
    ];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{"<"}</Text>
                </Pressable>

                <Text style={styles.headerTitle}>Attendance History</Text>

                <Image
                    source={require("../assets/logo.png")}
                    style={styles.headerLogo}
                />
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.tableBox}>
                    {/* Table Header */}
                    <View style={[styles.row, styles.headerRow]}>
                        <Text style={[styles.cell, styles.headerCell]}>Date</Text>
                        <Text style={[styles.cell, styles.headerCell]}>Status</Text>
                        <Text style={[styles.cell, styles.headerCell]}>Entry</Text>
                        <Text style={[styles.cell, styles.headerCell]}>Exit</Text>
                    </View>

                    {/* Table Rows */}
                    {attendanceData.map((item, index) => (
                        <View key={index} style={styles.row}>
                            <Text style={styles.cell}>{item.date}</Text>
                            <Text style={styles.cell}>{item.status}</Text>
                            <Text style={styles.cell}>{item.entry}</Text>
                            <Text style={styles.cell}>{item.exit}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f2f2f2"
    },
    header: {
        height: 90,
        backgroundColor: "white",
        paddingHorizontal: 20,
        paddingTop: 40,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd"
    },
    backButton: {
        width: 40
    },
    backButtonText: {
        fontSize: 26,
        fontWeight: "bold"
    },
    headerTitle: {
        flex: 1,
        fontSize: 22,
        fontWeight: "bold",
        textAlign: "center"
    },
    headerLogo: {
        width: 45,
        height: 45,
        borderRadius: 8
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20
    },
    tableBox: {
        width: "100%",
        maxWidth: 380,
        backgroundColor: "white",
        borderRadius: 12,
        padding: 15,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4
    },
    row: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        paddingVertical: 10
    },
    headerRow: {
        borderBottomWidth: 2,
        borderBottomColor: "#000"
    },
    cell: {
        flex: 1,
        fontSize: 14,
        textAlign: "center"
    },
    headerCell: {
        fontWeight: "bold",
        fontSize: 15
    }
});
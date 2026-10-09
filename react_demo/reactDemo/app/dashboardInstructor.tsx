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

import { Color, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";


import { API_BASE } from "../constants/api";
import { Colors, Spacing, Radius } from "../constants/theme";

// 9/15/26
// Andrew added First Entry Time as the first time they 
// entered class so that the attendance status can be done
// Andrew thinks you might need to make some adjustments to the table later
// also added the time total for total time in class
// basically needs an equation that takes 
// (first entry time - first exit time) + if there is (entry time if there is one - next exit time or whenever the session ends) however many times they have changes
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

type GeofenceOption = {
    name: string;
    lat: number;
    lon: number;
};

type Course = {
    course_id: number;
    course_code: string;
    course_name: string;
    instructor_id: number | null;
};

export default function InstructorDashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const storedUser = Platform.OS === "web" ? localStorage.getItem("user") : null;
    const currentUser = storedUser ? JSON.parse(storedUser) : null;

    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loading, setLoading] = useState(false);

    const [openDropdown, setOpenDropdown] =
        useState<number | null>(null);

    const [courses, setCourses] =
        useState<Course[]>([]);

    const [selectedCourse, setSelectedCourse] =
        useState<Course | null>(null);

    const [selectedItem2, setSelectedItem2] =
        useState("Room Number");

    const getCurrentDate = () => {
        const now = new Date();

        return now.toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "2-digit",
        });
    };

    const [selectedItem3, setSelectedItem3] =
        useState(getCurrentDate());



    //const [selectedItem3, setSelectedItem3] =
    //useState("Date");

    const [sessionActive, setSessionActive] =
        useState(false);

    const [sessionStatus, setSessionStatus] =
        useState("No active session");

    const [selectedGeofence, setSelectedGeofence] =
        useState<GeofenceOption | null>(null);

    const [locationAccuracy, setLocationAccuracy] =
        useState<number | null>(null);

    const [locationStatus, setLocationStatus] =
        useState("Location not acquired");

    const [radiusM, setRadiusM] =
        useState(15);

    const allowed_rooms = [
        "266",
        "267",
        "420",
        "67"
    ];

    const allowed_dates = [
        getCurrentDate()


    ];

    const allowed_radii = Array.from({ length: 16 }, (_, index) => index + 10);

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

    const loadCourses = async () => {
        try {
            const token = localStorage.getItem("access_token");

            const response = await fetch(
                `${API_BASE}/courses`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                console.error(
                    `Failed to load courses: ${response.status}`
                );

                setCourses([]);
                return;
            }

            const data: Course[] = await response.json();

            setCourses(data);

        }

        catch (error) {
            console.error("Failed to load courses:", error);

            setCourses([]);
        }
    };


    const loadCheckins = async () => {
        try {
            setLoading(true);

            const token = localStorage.getItem("access_token");

            const response = await fetch(
                `${API_BASE}/checkins`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
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
                    // 9/15/26 changes here below
                    firstentrytime: formatTime(
                        record.first_check_in_time
                    ),

                    entrytime: formatTime(
                        record.check_in_time
                    ),

                    exittime: "-",
                    totaltime: "-", // 9/15/26 changes here
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

    const loadActiveSession = async () => {
        try {
            const token = localStorage.getItem("access_token");

            const response = await fetch(
                `${API_BASE}/geofence/session`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Server returned ${response.status}`
                );
            }

            const data = await response.json();

            setSessionActive(data.is_open === true);

            if (data.is_open) {
                setSessionStatus(
                    `Session ${data.id} active`
                );
            } else {
                setSessionStatus(
                    "No active session"
                );
            }

        } catch (error) {
            console.error(
                "Failed to load active session:",
                error
            );
        }
    };

    useEffect(() => {
        loadCheckins();
        loadCourses();
        loadActiveSession();
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

    /* 
    Acquire the instructor device location for the geofence
    Browswer-reported accuracy is displayed so the instructor can 
    account for poor GPS/location conditions before starting a session.
    */
    const getInstructorLocation = () => {
        if (Platform.OS !== "web") {
            Alert.alert("Location", "Instructor location setup is currently supported on web.");
            return;
        }

        if (!navigator.geolocation) {
            Alert.alert("Location Unavailable", "This browser does not support geoloaction.");
            return;
        }

        setLocationStatus("Acquiring location...");

        navigator.geolocation.getCurrentPosition((position) => {
            const {
                latitude,
                longitude,
                accuracy
            } = position.coords;

            setSelectedGeofence({
                name: "Instructor Current Locaiton",
                lat: latitude,
                lon: longitude
            });

            setLocationAccuracy(accuracy);

            setLocationStatus(`Location acquired ±${Math.round(accuracy)} m`);
        },

            (error) => {
                console.error("Failed to acquire instructor location:", error);

                setLocationStatus("Location unavailable");

                Alert.alert("Location Error", "Could not get the instructor's current location.");

            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };



    const startSession = async () => {

        if (!selectedGeofence) {
            Alert.alert("Location Required", "Acquire the instructor location before starting the session.");
            return;
        }

        if (!selectedCourse) {
            Alert.alert("Course Required", "Select a course before starting the session.");
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE}/geofence/session/start`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`
                    },
                    body: JSON.stringify({
                        course_id: selectedCourse.course_id,
                        center_lat: selectedGeofence.lat,
                        center_lon: selectedGeofence.lon,
                        radius_m: radiusM
                    })
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Server returned ${response.status}`
                );
            }

            const data = await response.json();

            console.log(
                "Geofence session started:",
                data
            );

            setSessionActive(true);
            setSessionStatus(
                `Session Active - ${selectedGeofence.name} (${radiusM}m)`
            );

        } catch (error) {
            console.error(
                "Failed to start geofence session:",
                error
            );

            Alert.alert(
                "Start Session Failed",
                "Could not start the geofence session."
            );
        }
    };


    const endSession = async () => {
        try {
            const response = await fetch(
                `${API_BASE}/geofence/session/end`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                    }
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Server returned ${response.status}`
                );
            }

            const data = await response.json();

            console.log(
                "Geofence session ended:",
                data
            );

            setSessionActive(false);
            setSessionStatus(
                "No active session"
            );

        } catch (error) {
            console.error(
                "Failed to end geofence session:",
                error
            );

            Alert.alert(
                "End Session Failed",
                "Could not end the geofence session."
            );
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
        // Andrew added First Entry Time as the first time they 
        // entered class so that the attendance status can be done
        // Andrew thinks you might need to make some adjustments to the table later
        // Sorry for the inconvenience 
        const header =
            "Student,First Entry Time, Latest Entry Time,Latest Exit Time,Status\n";

        const rows = students
            .map(
                (student) => // 9/15/26 changes in the next line here
                    `"${student.name}","${student.firstentrytime}","${student.entrytime}","${student.exittime}","${student.totaltime}","${student.status}"`
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


                <View style={styles.profileBox}>

                    <Text style={styles.profileText}>
                        {currentUser?.name || "Instructor"}
                    </Text>

                    <View style={styles.profileDivider} />

                    <Ionicons
                        name="person-outline"
                        size={23}
                        color={Colors.textSecondary}
                    />

                    <TouchableOpacity
                        onPress={() => {
                            localStorage.removeItem("access_token");
                            localStorage.removeItem("user");
                            router.replace("/loginInstructor");
                        }}
                    >
                        <Text style={styles.logoutText}>
                            Logout
                        </Text>
                    </TouchableOpacity>

                </View>

            </View>


            <ScrollView
                contentContainerStyle={styles.pageContent}
            >

                {/* =================================================
                    PAGE HEADING
                ================================================== */}
                <View style={styles.pageHeading}>

                    <Text style={styles.dashboardTitle}>
                        Instructor Dashboard
                    </Text>

                    <Text style={styles.dashboardSubtitle}>
                        Manage your class attendance.
                    </Text>

                </View>


                {/* =================================================
                    SESSION SETUP
                ================================================== */}
                <View style={styles.sessionSetupCard}>

                    <Text style={styles.sectionTitle}>
                        Session setup
                    </Text>


                    {/* Course / Room / Date / Radius */}
                    <View style={styles.setupFieldsRow}>

                        {/* Course */}
                        <View style={styles.infoSection}>

                            <Text style={styles.infoLabel}>
                                Course
                            </Text>

                            <TouchableOpacity
                                style={styles.dropdownButton}
                                onPress={() => toggleDropdown(1)}
                            >
                                <Text
                                    style={styles.buttonText}
                                    numberOfLines={1}
                                >
                                    {selectedCourse
                                        ? `${selectedCourse.course_code} - ${selectedCourse.course_name}`
                                        : "Choose Course"}
                                </Text>

                                <Ionicons
                                    name="chevron-down"
                                    size={17}
                                    color={Colors.textSecondary}
                                />
                            </TouchableOpacity>

                            {openDropdown === 1 && (
                                <View style={styles.dropdownMenu}>

                                    {courses.length === 0 ? (

                                        <View style={styles.dropdownItem}>
                                            <Text style={styles.itemText}>
                                                No courses available
                                            </Text>
                                        </View>

                                    ) : (

                                        courses.map((course) => (

                                            <TouchableOpacity
                                                key={course.course_id}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setSelectedCourse(course);
                                                    setOpenDropdown(null);
                                                }}
                                            >
                                                <Text style={styles.itemText}>
                                                    {course.course_code} - {course.course_name}
                                                </Text>
                                            </TouchableOpacity>

                                        ))

                                    )}

                                </View>
                            )}

                        </View>


                        {/* Room */}
                        <View style={styles.infoSection}>

                            <Text style={styles.infoLabel}>
                                Room
                            </Text>

                            <TouchableOpacity
                                style={styles.dropdownButton}
                                onPress={() => toggleDropdown(2)}
                            >
                                <Text
                                    style={styles.buttonText}
                                    numberOfLines={1}
                                >
                                    {selectedItem2}
                                </Text>

                                <Ionicons
                                    name="chevron-down"
                                    size={17}
                                    color={Colors.textSecondary}
                                />
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
                                            <Text style={styles.itemText}>
                                                {item}
                                            </Text>
                                        </TouchableOpacity>

                                    ))}

                                </View>
                            )}

                        </View>


                        {/* Date */}
                        <View style={styles.infoSection}>

                            <Text style={styles.infoLabel}>
                                Date
                            </Text>

                            <TouchableOpacity
                                style={styles.dropdownButton}
                                onPress={() => toggleDropdown(3)}
                            >
                                <Text
                                    style={styles.buttonText}
                                    numberOfLines={1}
                                >
                                    {selectedItem3}
                                </Text>

                                <Ionicons
                                    name="calendar-outline"
                                    size={19}
                                    color={Colors.textSecondary}
                                />
                            </TouchableOpacity>

                            {openDropdown === 3 && (
                                <View style={styles.dropdownMenu}>

                                    {allowed_dates.map((item) => (

                                        <TouchableOpacity
                                            key={item}
                                            style={styles.dropdownItem}
                                            onPress={() => {
                                                setSelectedItem3(item);
                                                setOpenDropdown(null);
                                            }}
                                        >
                                            <Text style={styles.itemText}>
                                                {item}
                                            </Text>
                                        </TouchableOpacity>

                                    ))}

                                </View>
                            )}

                        </View>


                        {/* Radius */}
                        <View style={styles.infoSection}>

                            <Text style={styles.infoLabel}>
                                Radius
                            </Text>

                            <TouchableOpacity
                                style={styles.dropdownButton}
                                onPress={() => toggleDropdown(5)}
                            >
                                <Text
                                    style={styles.buttonText}
                                    numberOfLines={1}
                                >
                                    {radiusM} m / {Math.round(radiusM * 3.28084)} ft
                                </Text>

                                <Ionicons
                                    name="chevron-down"
                                    size={17}
                                    color={Colors.textSecondary}
                                />
                            </TouchableOpacity>

                            {openDropdown === 5 && (
                                <View style={styles.dropdownMenu}>

                                    {allowed_radii.map((radius) => (

                                        <TouchableOpacity
                                            key={radius}
                                            style={styles.dropdownItem}
                                            onPress={() => {
                                                setRadiusM(radius);
                                                setOpenDropdown(null);
                                            }}
                                        >
                                            <Text style={styles.itemText}>
                                                {radius} m / {Math.round(radius * 3.28084)} ft
                                            </Text>
                                        </TouchableOpacity>

                                    ))}

                                </View>
                            )}

                        </View>

                    </View>


                    {/* =================================================
                        LOCATION
                    ================================================== */}
                    <View style={styles.locationRow}>

                        <View style={styles.locationInfoGroup}>

                            <Ionicons
                                name="location-outline"
                                size={30}
                                color={Colors.primary}
                            />

                            <View style={styles.locationDetails}>

                                <Text style={styles.locationTitle}>
                                    {selectedGeofence
                                        ? "Location acquired"
                                        : locationStatus}
                                </Text>

                                {selectedGeofence && (
                                    <Text style={styles.locationMeta}>
                                        Lat: {selectedGeofence.lat.toFixed(6)},{" "}
                                        {selectedGeofence.lon.toFixed(6)}
                                        {locationAccuracy !== null
                                            ? `  |  Accuracy ±${Math.round(locationAccuracy)} m`
                                            : ""}
                                    </Text>
                                )}

                            </View>

                        </View>


                        <TouchableOpacity
                            style={styles.locationButton}
                            onPress={getInstructorLocation}
                            disabled={sessionActive}
                        >
                            <Text style={styles.locationButtonText}>
                                Use current location
                            </Text>
                        </TouchableOpacity>


                        <View style={styles.locationDivider} />


                        <Text style={styles.geofenceDisclaimer}>
                            Adjust the radius to fit your classroom.
                        </Text>

                    </View>


                    {/* =================================================
                        SESSION CONTROLS
                    ================================================== */}
                    <View style={styles.sessionControlsRow}>

                        <TouchableOpacity
                            style={[
                                styles.startButton,
                                (
                                    sessionActive ||
                                    !selectedGeofence ||
                                    !selectedCourse
                                ) &&
                                styles.disabledButton
                            ]}
                            onPress={startSession}
                            disabled={
                                sessionActive ||
                                !selectedGeofence ||
                                !selectedCourse
                            }
                        >
                            <Text style={styles.sessionButtonText}>
                                Start session
                            </Text>
                        </TouchableOpacity>


                        <TouchableOpacity
                            style={[
                                styles.endButton,
                                !sessionActive &&
                                styles.disabledButton
                            ]}
                            onPress={endSession}
                            disabled={!sessionActive}
                        >
                            <Text style={styles.endSessionButtonText}>
                                End session
                            </Text>
                        </TouchableOpacity>


                        <View style={styles.sessionStatusBox}>

                            <View
                                style={[
                                    styles.sessionStatusDot,
                                    sessionActive &&
                                    styles.sessionStatusDotActive
                                ]}
                            />

                            <Text style={styles.sessionStatusText}>
                                {sessionStatus}
                            </Text>

                        </View>

                    </View>

                </View>


                {/* =================================================
                    ATTENDANCE
                ================================================== */}
                <View style={styles.attendanceHeader}>

                    <View>
                        <Text style={styles.attendanceTitle}>
                            Attendance
                        </Text>

                        <Text style={styles.attendanceCount}>
                            {students.length}{" "}
                            {students.length === 1
                                ? "student"
                                : "students"}
                        </Text>
                    </View>


                    <View style={styles.attendanceActions}>

                        <TouchableOpacity
                            style={styles.smallButton}
                            onPress={loadCheckins}
                        >
                            <Ionicons
                                name="refresh-outline"
                                size={18}
                                color={Colors.primary}
                            />

                            <Text style={styles.smallButtonText}>
                                Refresh
                            </Text>
                        </TouchableOpacity>


                        <TouchableOpacity
                            style={styles.smallButton}
                            onPress={downloadCSVFile}
                        >
                            <Ionicons
                                name="download-outline"
                                size={18}
                                color={Colors.primary}
                            />

                            <Text style={styles.smallButtonText}>
                                Export CSV
                            </Text>
                        </TouchableOpacity>

                    </View>

                </View>


                {/* =================================================
                    TABLE
                ================================================== */}
                <View style={styles.tableContainer}>

                    <View style={styles.tableHeaderRow}>

                        <Text
                            style={[
                                styles.tableHeaderText,
                                styles.colStudent
                            ]}
                        >
                            STUDENT
                        </Text>

                        <Text
                            style={[
                                styles.tableHeaderText,
                                styles.colTime
                            ]}
                        >
                            FIRST ENTRY TIME
                        </Text>

                        <Text
                            style={[
                                styles.tableHeaderText,
                                styles.colTime
                            ]}
                        >
                            LATEST ENTRY TIME
                        </Text>

                        <Text
                            style={[
                                styles.tableHeaderText,
                                styles.colTime
                            ]}
                        >
                            LATEST EXIT TIME
                        </Text>

                        <Text
                            style={[
                                styles.tableHeaderText,
                                styles.colTime
                            ]}
                        >
                            TOTAL TIME IN CLASS
                        </Text>

                        <Text
                            style={[
                                styles.tableHeaderText,
                                styles.colStatus
                            ]}
                        >
                            STATUS
                        </Text>

                        <Text
                            style={[
                                styles.tableHeaderText,
                                styles.colAction
                            ]}
                        >
                            ACTION
                        </Text>

                    </View>


                    {loading ? (

                        <Text style={styles.loadingText}>
                            Loading attendance...
                        </Text>

                    ) : students.length === 0 ? (

                        <Text style={styles.loadingText}>
                            No attendance records found.
                        </Text>

                    ) : (

                        students.map((student, index) => (

                            <View
                                key={index}
                                style={styles.tableRow}
                            >

                                <Text
                                    style={[
                                        styles.tableCellText,
                                        styles.colStudent,
                                        styles.studentNameText
                                    ]}
                                >
                                    {student.name}
                                </Text>

                                <Text
                                    style={[
                                        styles.tableCellText,
                                        styles.colTime,
                                        !student.firstentrytime && styles.placeholderText
                                    ]}
                                >
                                    {student.firstentrytime || "—"}
                                </Text>

                                <Text
                                    style={[
                                        styles.tableCellText,
                                        styles.colTime,
                                        !student.entrytime && styles.placeholderText
                                    ]}
                                >
                                    {student.entrytime || "—"}
                                </Text>

                                <Text
                                    style={[
                                        styles.tableCellText,
                                        styles.colTime,
                                        !student.exittime && styles.placeholderText
                                    ]}
                                >
                                    {student.exittime || "—"}
                                </Text>

                                <Text
                                    style={[
                                        styles.tableCellText,
                                        styles.colTime,
                                        !student.totaltime && styles.placeholderText
                                    ]}
                                >
                                    {student.totaltime || "—"}
                                </Text>

                                <View style={styles.colStatus}>

                                    <View
                                        style={[
                                            styles.statusBadge,
                                            student.status === "Present" &&
                                            styles.presentBadge,

                                            student.status === "Absent" &&
                                            styles.absentBadge,

                                            student.status === "Late" &&
                                            styles.lateBadge
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.statusBadgeText,
                                                getStatusStyle(student.status)
                                            ]}
                                        >
                                            {student.status}
                                        </Text>
                                    </View>

                                </View>


                                <View style={styles.colAction}>

                                    <TouchableOpacity
                                        onPress={() =>
                                            router.push({
                                                pathname: "/overrideInstructor",
                                                params: {
                                                    course: selectedCourse
                                                        ? selectedCourse.course_code
                                                        : "",
                                                    room: selectedItem2,
                                                    date: selectedItem3,
                                                    student: student.name
                                                }
                                            })
                                        }
                                    >
                                        <Text style={styles.overrideLink}>
                                            Override
                                        </Text>
                                    </TouchableOpacity>

                                </View>

                            </View>

                        ))

                    )}

                </View>


                {/* =================================================
                    FOOTER
                ================================================== */}
                <View style={styles.footer}>

                    <Text style={styles.footerText}>
                        University of North Texas
                    </Text>

                    <Text style={styles.footerDot}>
                        •
                    </Text>

                    <Text style={styles.footerText}>
                        Biometric Attendance
                    </Text>

                </View>

            </ScrollView>

        </View>
    </View>
);
}


const styles = StyleSheet.create({

    // ============================================================
    // PAGE
    // ============================================================

    safe: {
        flex: 1,
        backgroundColor: Colors.background
    },

    container: {
        flex: 1,
        backgroundColor: Colors.background
    },

    pageContent: {
        paddingHorizontal: 48,
        paddingTop: 32,
        paddingBottom: 20
    },


    // ============================================================
    // HEADER
    // ============================================================

    topHeader: {
        minHeight: 86,
        backgroundColor: Colors.surface,

        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",

        paddingHorizontal: 48,

        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight
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
        width: 1,
        height: 32,
        backgroundColor: Colors.border
    },

    brandText: {
        color: Colors.textPrimary,
        fontSize: 20,
        fontWeight: "700"
    },

    profileBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14
    },

    profileText: {
        color: Colors.textPrimary,
        fontSize: 14,
        fontWeight: "700"
    },

    profileDivider: {
        width: 1,
        height: 28,
        backgroundColor: Colors.border
    },

    logoutText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "700"
    },


    // ============================================================
    // PAGE TITLE
    // ============================================================

    pageHeading: {
        marginBottom: 26
    },

    dashboardTitle: {
        color: Colors.textPrimary,
        fontSize: 36,
        lineHeight: 42,
        fontWeight: "800"
    },

    titleAccentLine: {
        height: 4,
        width: "100%",
        backgroundColor: Colors.primary,
        marginTop: 10,
        marginBottom: 10
    },

    dashboardSubtitle: {
        color: Colors.textSecondary,
        fontSize: 18,
        fontWeight: "500"
    },


    // ============================================================
    // SESSION SETUP CARD
    // ============================================================

    sessionSetupCard: {
        backgroundColor: Colors.surface,

        borderWidth: 1,
        borderColor: Colors.borderLight,
        borderRadius: Radius.md,

        paddingHorizontal: 30,
        paddingTop: 24,
        paddingBottom: 22,

        marginBottom: 24,

        zIndex: 20
    },

    sectionTitle: {
        color: Colors.textPrimary,
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 18
    },

    setupFieldsRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 22,

        paddingBottom: 20,

        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,

        zIndex: 30
    },

    infoSection: {
        flex: 1,
        minWidth: 0,
        position: "relative"
    },

    infoLabel: {
        color: Colors.textPrimary,
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 7
    },


    // ============================================================
    // DROPDOWNS
    // ============================================================

    dropdownButton: {
        height: 48,

        backgroundColor: Colors.surface,

        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.sm,

        paddingHorizontal: 14,

        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },

    buttonText: {
        flex: 1,
        color: Colors.textPrimary,
        fontSize: 15,
        marginRight: Spacing.sm
    },

    dropdownMenu: {
        position: "absolute",

        top: 74,
        left: 0,
        right: 0,

        backgroundColor: Colors.surface,

        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.sm,

        overflow: "hidden",

        zIndex: 100
    },

    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 14,

        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight
    },

    itemText: {
        color: Colors.textPrimary,
        fontSize: 14
    },


    // ============================================================
    // LOCATION
    // ============================================================

    locationRow: {
        minHeight: 84,

        flexDirection: "row",
        alignItems: "center",

        gap: 20,

        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight
    },

    locationInfoGroup: {
        flex: 1.15,

        flexDirection: "row",
        alignItems: "center",

        gap: 14
    },

    locationDetails: {
        flex: 1
    },

    locationTitle: {
        color: Colors.textPrimary,
        fontSize: 15,
        fontWeight: "700"
    },

    locationMeta: {
        color: Colors.textSecondary,
        fontSize: 13,
        marginTop: 4
    },

    locationButton: {
        backgroundColor: Colors.surface,

        borderWidth: 1.5,
        borderColor: Colors.primary,
        borderRadius: Radius.sm,

        minHeight: 44,

        justifyContent: "center",
        alignItems: "center",

        paddingHorizontal: 24
    },

    locationButtonText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "700"
    },

    locationDivider: {
        width: 1,
        height: 40,
        backgroundColor: Colors.borderLight
    },

    geofenceDisclaimer: {
        flex: 1.5,

        color: Colors.textSecondary,
        fontSize: 13,
        fontWeight: "500"
    },


    // ============================================================
    // SESSION CONTROLS
    // ============================================================

    sessionControlsRow: {
        minHeight: 74,

        flexDirection: "row",
        alignItems: "center",

        gap: 14
    },

    startButton: {
        minWidth: 210,
        minHeight: 48,

        backgroundColor: Colors.primary,

        borderRadius: Radius.sm,

        justifyContent: "center",
        alignItems: "center"
    },

    endButton: {
        minWidth: 190,
        minHeight: 48,

        backgroundColor: Colors.disabledSurface,

        borderRadius: Radius.sm,

        justifyContent: "center",
        alignItems: "center"
    },

    sessionButtonText: {
        color: Colors.surface,
        fontSize: 15,
        fontWeight: "800"
    },

    endSessionButtonText: {
        color: Colors.textSecondary,
        fontSize: 15,
        fontWeight: "700"
    },

    disabledButton: {
        opacity: 0.55
    },

    sessionStatusBox: {
        flexDirection: "row",
        alignItems: "center",

        gap: 10,

        marginLeft: 14
    },

    sessionStatusDot: {
        width: 12,
        height: 12,

        borderRadius: Radius.pill,

        backgroundColor: Colors.disabled
    },

    sessionStatusDotActive: {
        backgroundColor: Colors.primary
    },

    sessionStatusText: {
        color: Colors.textSecondary,
        fontSize: 14,
        fontWeight: "500"
    },


    // ============================================================
    // ATTENDANCE HEADER
    // ============================================================

    attendanceHeader: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",

        marginBottom: 12
    },

    attendanceTitle: {
        color: Colors.textPrimary,
        fontSize: 28,
        fontWeight: "800"
    },

    attendanceCount: {
        color: Colors.textSecondary,
        fontSize: 14,
        marginTop: 4
    },

    attendanceActions: {
        flexDirection: "row",
        alignItems: "center",

        gap: 12
    },

    smallButton: {
        minHeight: 44,

        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",

        gap: 8,

        backgroundColor: Colors.surface,

        borderWidth: 1.5,
        borderColor: Colors.primary,
        borderRadius: Radius.sm,

        paddingHorizontal: 22
    },

    smallButtonText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "700"
    },


    // ============================================================
    // ATTENDANCE TABLE
    // ============================================================

    tableContainer: {
        backgroundColor: Colors.surface,

        borderWidth: 1,
        borderColor: Colors.tableBorder,
        borderRadius: Radius.sm,

        overflow: "hidden"
    },

    tableHeaderRow: {
        minHeight: 52,

        flexDirection: "row",
        alignItems: "stretch",

        backgroundColor: Colors.tableHeader,

        borderBottomWidth: 1,
        borderBottomColor: Colors.tableBorder
    },

    tableHeaderText: {
        color: Colors.textSecondary,
        fontSize: 12,
        fontWeight: "800",
        
        paddingHorizontal: 20,

        display: "flex",
        alignItems: "center"
    },

    tableRow: {
        minHeight: 62,

        flexDirection: "row",
        alignItems: "stretch",

        backgroundColor: Colors.surface
    },

    tableCellText:{
        color: Colors.textPrimary,
        fontSize: 14,

        paddingHorizontal: 20,

        display: "flex",
        alignItems: "center"
    },

    studentNameText: {
        fontWeight: "600"
    },

    placeholderText: {
        fontWeight: "700",
        fontSize: 18,
        color: Colors.textPrimary,
        lineHeight: 18
    },

    colStudent: {
        flex: 1.25,

        borderRightWidth: 1,
        borderRightColor: Colors.tableBorder
    },

    colTime:{
        flex: 1.1,

        borderRightWidth: 1,
        borderRightColor: Colors.tableBorder
    },

    colStatus:{
        flex: 0.85,

        justifyContent: "center",
        alignItems: "center",

        borderRightWidth: 1,
        borderRightColor: Colors.tableBorder,

        paddingHorizontal: 20
    },

    colAction: {
        flex: 0.75,

        justifyContent: "center",
        alignItems: "center",

        paddingHorizontal: 20
    },

    // ============================================================
    // STATUS BADGES
    // ============================================================

    statusBadge: {
        minWidth: 82,

        paddingVertical: 5,
        paddingHorizontal: 12,

        borderRadius: Radius.pill,

        alignItems: "center",
        alignSelf: "center"
    },

    presentBadge: {
        backgroundColor: Colors.successSoft
    },

    absentBadge: {
        backgroundColor: Colors.dangerSoft
    },

    lateBadge: {
        backgroundColor: Colors.warningSoft
    },

    statusBadgeText: {
        fontSize: 13,
        fontWeight: "700"
    },

    presentText: {
        color: Colors.success,
        fontWeight: "700"
    },

    absentText: {
        color: Colors.danger,
        fontWeight: "700"
    },

    lateText: {
        color: Colors.warning,
        fontWeight: "700"
    },

    defaultStatusText: {
        color: Colors.textPrimary
    },

    overrideLink: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "700"
    },

    loadingText: {
        paddingVertical: Spacing.xl,

        textAlign: "center",

        color: Colors.textSecondary,
        fontSize: 14
    },


    // ============================================================
    // FOOTER
    // ============================================================

    footer: {
        flexDirection: "row",
        alignItems: "center",

        gap: 8,

        marginTop: 26,
        paddingTop: 18,

        borderTopWidth: 1,
        borderTopColor: Colors.tableBorder
    },

    footerText: {
        color: Colors.textSecondary,
        fontSize: 12
    },

    footerDot: {
        color: Colors.textSecondary,
        fontSize: 12
    }

});
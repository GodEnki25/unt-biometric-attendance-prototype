import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    TouchableOpacity,
    Platform,
    Alert,
    ActivityIndicator,
} from "react-native";

import {
    useLocalSearchParams,
    useRouter,
} from "expo-router";

import {
    useSafeAreaInsets,
} from "react-native-safe-area-context";

import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Ionicons,
    Feather,
} from "@expo/vector-icons";

import {
    API_BASE,
} from "../constants/api";

import {
    Colors,
    Spacing,
    Radius,
} from "../constants/theme";


type SessionHistoryRow = {
    session_id: number;

    course_id: number;

    course_code: string;
    course_name: string;

    room: string | null;

    session_date: string;
    start_time: string | null;
    end_time: string | null;

    duration: string | null;

    attendance_count: number;
    enrolled_count: number;

    status:
        | "active"
        | "completed"
        | "incomplete";
};


type SessionStudent = {
    user_id: number;
    student_id: string | null;
    student_name: string;

    status: string;

    check_in_time: string | null;

    first_check_in_time: string | null;
    latest_entry_time: string | null;
    latest_exit_time: string | null;
    total_time: string | null;

    face_verified: boolean;
    location_verified: boolean;

    notes: string | null;
};


type SessionDetailsResponse = {
    success: boolean;

    message?: string;

    session?: {
        session_id: number;
        course_id: number;

        course_code: string;
        course_name: string;

        room: string | null;

        session_date: string;
        start_time: string | null;
        end_time: string | null;

        duration: string | null;
    };

    students?: SessionStudent[];
};


type CourseFilter = {
    course_id: number;
    label: string;
};


export default function AuditInstructor() {

    const router =
        useRouter();

    const insets =
        useSafeAreaInsets();

    const {
        course_id,
    } =
        useLocalSearchParams<{
            course_id?: string;
        }>();


    const storedUser =
        Platform.OS === "web" &&
        typeof window !== "undefined"
            ? sessionStorage.getItem(
                "user"
            )
            : null;


    const currentUser =
        storedUser
            ? JSON.parse(
                storedUser
            )
            : null;


    const [
        sessions,
        setSessions
    ] =
        useState<
            SessionHistoryRow[]
        >(
            []
        );


    const [
        loading,
        setLoading
    ] =
        useState(
            true
        );


    const [
        error,
        setError
    ] =
        useState(
            ""
        );


    const [
        selectedCourseId,
        setSelectedCourseId
    ] =
        useState<
            number | null
        >(
            course_id
                ? Number(course_id)
                : null
        );


    const [
        selectedStatus,
        setSelectedStatus
    ] =
        useState<
            "all"
            | "active"
            | "completed"
            | "incomplete"
        >(
            "all"
        );


    const [
        selectedRange,
        setSelectedRange
    ] =
        useState<
            "all"
            | "30"
            | "90"
        >(
            "all"
        );


    const [
        appliedCourseId,
        setAppliedCourseId
    ] =
        useState<
            number | null
        >(
            course_id
                ? Number(course_id)
                : null
        );


    const [
        appliedStatus,
        setAppliedStatus
    ] =
        useState<
            "all"
            | "active"
            | "completed"
            | "incomplete"
        >(
            "all"
        );


    const [
        appliedRange,
        setAppliedRange
    ] =
        useState<
            "all"
            | "30"
            | "90"
        >(
            "all"
        );


    const [
        openDropdown,
        setOpenDropdown
    ] =
        useState<
            "course"
            | "range"
            | "status"
            | null
        >(
            null
        );


    const loadSessions =
        async () => {

            setLoading(
                true
            );

            setError(
                ""
            );

            try {

                const token =
                    Platform.OS ===
                        "web"
                        ? sessionStorage.getItem(
                            "access_token"
                        )
                        : null;


                if (!token) {

                    throw new Error(
                        "Instructor is not logged in."
                    );

                }


                const response =
                    await fetch(
                        `${API_BASE}/attendance/session-history`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${token}`,
                            },
                        }
                    );


                const data =
                    await response.json();


                if (
                    !response.ok
                ) {

                    throw new Error(
                        data?.detail ||
                        data?.message ||
                        "Unable to load session history."
                    );

                }


                setSessions(
                    Array.isArray(data)
                        ? data
                        : []
                );

            }

            catch (
                error: any
            ) {

                console.error(
                    "Session history load failed:",
                    error
                );


                setError(
                    error.message ||
                    "Unable to load session history."
                );

            }

            finally {

                setLoading(
                    false
                );

            }

        };


    useEffect(
        () => {

            loadSessions();

        },
        []
    );


    const courses =
        useMemo<
            CourseFilter[]
        >(
            () => {

                const map =
                    new Map<
                        number,
                        CourseFilter
                    >();


                sessions.forEach(
                    (
                        session
                    ) => {

                        map.set(
                            session.course_id,
                            {
                                course_id:
                                    session.course_id,

                                label:
                                    `${session.course_code} — ${session.course_name}`,
                            }
                        );

                    }
                );


                return Array.from(
                    map.values()
                );

            },
            [
                sessions
            ]
        );


    const filteredSessions =
        useMemo(
            () => {

                return sessions.filter(
                    (
                        session
                    ) => {

                        if (
                            appliedCourseId !==
                                null &&
                            session.course_id !==
                                appliedCourseId
                        ) {

                            return false;

                        }


                        if (
                            appliedStatus !==
                                "all" &&
                            session.status !==
                                appliedStatus
                        ) {

                            return false;

                        }


                        if (
                            appliedRange !==
                            "all"
                        ) {

                            const days =
                                Number(
                                    appliedRange
                                );


                            const sessionDate =
                                new Date(
                                    `${session.session_date}T12:00:00`
                                );


                            const cutoff =
                                new Date();


                            cutoff.setDate(
                                cutoff.getDate() -
                                days
                            );


                            if (
                                sessionDate <
                                cutoff
                            ) {

                                return false;

                            }

                        }


                        return true;

                    }
                );

            },
            [
                sessions,
                appliedCourseId,
                appliedStatus,
                appliedRange,
            ]
        );


    const selectedCourseLabel =
        selectedCourseId ===
        null
            ? "All courses"
            : courses.find(
                (
                    course
                ) =>
                    course.course_id ===
                    selectedCourseId
            )?.label ??
            "All courses";


    const selectedRangeLabel =
        selectedRange ===
            "30"
            ? "Last 30 days"
            : selectedRange ===
                "90"
                ? "Last 90 days"
                : "All dates";


    const selectedStatusLabel =
        selectedStatus === "active"
            ? "Active sessions"
            : selectedStatus === "completed"
                ? "Completed sessions"
                : selectedStatus === "incomplete"
                    ? "Incomplete sessions"
                    : "All seesions";

    const formatDate =
        (
            value:
                string
        ) => {

            if (!value) {

                return "—";

            }


            const date =
                new Date(
                    `${value}T12:00:00`
                );


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return value;

            }


            return date
                .toLocaleDateString(
                    "en-US",
                    {
                        month:
                            "short",

                        day:
                            "numeric",

                        year:
                            "numeric",
                    }
                );

        };


    const formatTime =
        (
            value:
                string | null
        ) => {

            if (!value) {

                return "—";

            }


            const pieces =
                value.split(
                    ":"
                );


            if (
                pieces.length < 2
            ) {

                return value;

            }


            const hour =
                Number(
                    pieces[0]
                );


            const minute =
                pieces[1];


            const period =
                hour >= 12
                    ? "PM"
                    : "AM";


            const displayHour =
                hour % 12 || 12;


            return `${displayHour}:${minute} ${period}`;

        };


    const escapeCSV =
        (
            value:
                unknown
        ) => {

            const text =
                value ===
                    null ||
                value ===
                    undefined
                    ? ""
                    : String(
                        value
                    );


            return `"${text.replace(
                /"/g,
                '""'
            )}"`;

        };


    const downloadCSV =
        (
            filename:
                string,
            content:
                string
        ) => {

            if (
                Platform.OS !==
                "web"
            ) {

                Alert.alert(
                    "Export CSV",
                    "CSV export is currently available from the instructor web dashboard."
                );

                return;

            }


            const blob =
                new Blob(
                    [
                        content
                    ],
                    {
                        type:
                            "text/csv;charset=utf-8;",
                    }
                );


            const url =
                URL.createObjectURL(
                    blob
                );


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                url;


            link.download =
                filename;


            document.body
                .appendChild(
                    link
                );


            link.click();


            document.body
                .removeChild(
                    link
                );


            URL.revokeObjectURL(
                url
            );

        };


    const exportSummary =
        () => {

            const header =
                [
                    "Session ID",
                    "Course",
                    "Room",
                    "Date",
                    "Start Time",
                    "End Time",
                    "Duration",
                    "Attendance Count",
                    "Enrolled",
                    "Status",
                ]
                    .map(
                        escapeCSV
                    )
                    .join(
                        ","
                    );


            const rows =
                filteredSessions.map(
                    (
                        session
                    ) => {

                        return [
                            session.session_id,

                            `${session.course_code} — ${session.course_name}`,

                            session.room ??
                            "—",

                            session.session_date,

                            session.start_time ??
                            "",

                            session.end_time ??
                            "",

                            session.duration ??
                            "",

                            session.attendance_count,

                            session.enrolled_count,

                            session.status,
                        ]
                            .map(
                                escapeCSV
                            )
                            .join(
                                ","
                            );

                    }
                );


            downloadCSV(
                "geoface-session-summary.csv",
                [
                    header,
                    ...rows,
                ].join(
                    "\n"
                )
            );

        };


    const exportSession =
        async (
            session:
                SessionHistoryRow
        ) => {

            try {

                const token =
                    Platform.OS ===
                        "web"
                        ? sessionStorage.getItem(
                            "access_token"
                        )
                        : null;


                if (!token) {

                    throw new Error(
                        "Instructor is not logged in."
                    );

                }


                const response =
                    await fetch(
                        `${API_BASE}/attendance/session-history/${session.session_id}`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${token}`,
                            },
                        }
                    );


                const data:
                    SessionDetailsResponse =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success ||
                    !data.students
                ) {

                    throw new Error(
                        data.message ||
                        "Unable to export session."
                    );

                }


                const header =
                    [
                        "Student",
                        "Student ID",
                        "Status",
                        "First Entry",
                        "Latest Entry",
                        "Latest Exit",
                        "Total Time",
                        "Face Verified",
                        "Location Verified",
                        "Notes",
                    ]
                        .map(
                            escapeCSV
                        )
                        .join(
                            ","
                        );


                const rows =
                    data.students.map(
                        (
                            student
                        ) => {

                            return [
                                student.student_name,

                                student.student_id ??
                                "",

                                student.status,

                                student.first_check_in_time ??
                                "",

                                student.latest_entry_time ??
                                "",

                                student.latest_exit_time ??
                                "",

                                student.total_time ??
                                "",

                                student.face_verified
                                    ? "Yes"
                                    : "No",

                                student.location_verified
                                    ? "Yes"
                                    : "No",

                                student.notes ??
                                "",
                            ]
                                .map(
                                    escapeCSV
                                )
                                .join(
                                    ","
                                );

                        }
                    );


                downloadCSV(
                    `geoface-session-${session.session_id}.csv`,
                    [
                        header,
                        ...rows,
                    ].join(
                        "\n"
                    )
                );

            }

            catch (
                error: any
            ) {

                console.error(
                    "Session export failed:",
                    error
                );


                Alert.alert(
                    "Export Failed",
                    error.message ||
                    "Unable to export this session."
                );

            }

        };


    const applyFilters =
        () => {

            setAppliedCourseId(
                selectedCourseId
            );

            setAppliedStatus(
                selectedStatus
            );

            setAppliedRange(
                selectedRange
            );

            setOpenDropdown(
                null
            );

        };


    const clearFilters =
        () => {

            setSelectedCourseId(
                null
            );

            setSelectedStatus(
                "all"
            );

            setSelectedRange(
                "all"
            );

            setAppliedCourseId(
                null
            );

            setAppliedStatus(
                "all"
            );

            setAppliedRange(
                "all"
            );

            setOpenDropdown(
                null
            );

        };


    const logout =
        () => {

            if (
                Platform.OS ===
                "web"
            ) {

                sessionStorage.removeItem(
                    "access_token"
                );

                sessionStorage.removeItem(
                    "user"
                );

            }


            router.replace(
                "/loginInstructor"
            );

        };


    return (

        <View
            style={[
                styles.safe,
                {
                    paddingTop:
                        insets.top,

                    paddingBottom:
                        insets.bottom,
                },
            ]}
        >

            <View
                style={
                    styles.container
                }
            >

                <View
                    style={
                        styles.topHeader
                    }
                >

                    <View
                        style={
                            styles.brandBox
                        }
                    >

                        <Image
                            source={
                                require(
                                    "../assets/logo.png"
                                )
                            }
                            style={
                                styles.logoBox
                            }
                            resizeMode="contain"
                        />


                        <View
                            style={
                                styles.brandDivider
                            }
                        />


                        <Text
                            style={
                                styles.brandText
                            }
                        >
                            Attendance
                        </Text>

                    </View>


                    <View
                        style={
                            styles.profileBox
                        }
                    >

                        <Text
                            style={
                                styles.profileText
                            }
                        >
                            {
                                currentUser?.name ||
                                "Instructor"
                            }
                        </Text>


                        <View
                            style={
                                styles.profileDivider
                            }
                        />


                        <Ionicons
                            name="person-outline"
                            size={23}
                            color={
                                Colors.textSecondary
                            }
                        />


                        <TouchableOpacity
                            onPress={
                                logout
                            }
                        >

                            <Text
                                style={
                                    styles.logoutText
                                }
                            >
                                Logout
                            </Text>

                        </TouchableOpacity>

                    </View>

                </View>


                <ScrollView
                    contentContainerStyle={
                        styles.pageContent
                    }
                >

                    <TouchableOpacity
                        style={
                            styles.backLink
                        }
                        onPress={
                            () =>
                                router.replace(
                                    "/dashboardInstructor"
                                )
                        }
                    >

                        <Ionicons
                            name="arrow-back"
                            size={20}
                            color={
                                Colors.primary
                            }
                        />


                        <Text
                            style={
                                styles.backLinkText
                            }
                        >
                            Back to Instructor Dashboard
                        </Text>

                    </TouchableOpacity>


                    <View
                        style={
                            styles.pageHeading
                        }
                    >

                        <Text
                            style={
                                styles.pageTitle
                            }
                        >
                            Session History
                        </Text>


                        <Text
                            style={
                                styles.pageSubtitle
                            }
                        >
                            View and manage your past attendance sessions.
                        </Text>

                    </View>


                    <View
                        style={
                            styles.filterCard
                        }
                    >

                        <Text
                            style={
                                styles.sectionTitle
                            }
                        >
                            Filters
                        </Text>


                        <Text
                            style={
                                styles.sectionSubtitle
                            }
                        >
                            Narrow down your session history.
                        </Text>


                        <View
                            style={
                                styles.filterRow
                            }
                        >

                            <View
                                style={
                                    styles.filterField
                                }
                            >

                                <Text
                                    style={
                                        styles.fieldLabel
                                    }
                                >
                                    Course
                                </Text>


                                <TouchableOpacity
                                    style={
                                        styles.dropdownButton
                                    }
                                    onPress={
                                        () =>
                                            setOpenDropdown(
                                                openDropdown ===
                                                    "course"
                                                    ? null
                                                    : "course"
                                            )
                                    }
                                >

                                    <Text
                                        style={
                                            styles.dropdownText
                                        }
                                        numberOfLines={1}
                                    >
                                        {
                                            selectedCourseLabel
                                        }
                                    </Text>


                                    <Ionicons
                                        name="chevron-down"
                                        size={18}
                                        color={
                                            Colors.textSecondary
                                        }
                                    />

                                </TouchableOpacity>


                                {
                                    openDropdown ===
                                    "course" && (

                                        <View
                                            style={
                                                styles.dropdownMenu
                                            }
                                        >

                                            <TouchableOpacity
                                                style={
                                                    styles.dropdownItem
                                                }
                                                onPress={
                                                    () => {
                                                        setSelectedCourseId(
                                                            null
                                                        );

                                                        setOpenDropdown(
                                                            null
                                                        );
                                                    }
                                                }
                                            >

                                                <Text
                                                    style={
                                                        styles.dropdownItemText
                                                    }
                                                >
                                                    All courses
                                                </Text>

                                            </TouchableOpacity>


                                            {
                                                courses.map(
                                                    (
                                                        course
                                                    ) => (

                                                        <TouchableOpacity
                                                            key={
                                                                course.course_id
                                                            }
                                                            style={
                                                                styles.dropdownItem
                                                            }
                                                            onPress={
                                                                () => {
                                                                    setSelectedCourseId(
                                                                        course.course_id
                                                                    );

                                                                    setOpenDropdown(
                                                                        null
                                                                    );
                                                                }
                                                            }
                                                        >

                                                            <Text
                                                                style={
                                                                    styles.dropdownItemText
                                                                }
                                                            >
                                                                {
                                                                    course.label
                                                                }
                                                            </Text>

                                                        </TouchableOpacity>

                                                    )
                                                )
                                            }

                                        </View>

                                    )
                                }

                            </View>


                            <View
                                style={
                                    styles.filterField
                                }
                            >

                                <Text
                                    style={
                                        styles.fieldLabel
                                    }
                                >
                                    Date Range
                                </Text>


                                <TouchableOpacity
                                    style={
                                        styles.dropdownButton
                                    }
                                    onPress={
                                        () =>
                                            setOpenDropdown(
                                                openDropdown ===
                                                    "range"
                                                    ? null
                                                    : "range"
                                            )
                                    }
                                >

                                    <View
                                        style={
                                            styles.dropdownWithIcon
                                        }
                                    >

                                        <Ionicons
                                            name="calendar-outline"
                                            size={18}
                                            color={
                                                Colors.textSecondary
                                            }
                                        />


                                        <Text
                                            style={
                                                styles.dropdownText
                                            }
                                        >
                                            {
                                                selectedRangeLabel
                                            }
                                        </Text>

                                    </View>


                                    <Ionicons
                                        name="chevron-down"
                                        size={18}
                                        color={
                                            Colors.textSecondary
                                        }
                                    />

                                </TouchableOpacity>


                                {
                                    openDropdown ===
                                    "range" && (

                                        <View
                                            style={
                                                styles.dropdownMenu
                                            }
                                        >

                                            {
                                                [
                                                    {
                                                        value:
                                                            "all",

                                                        label:
                                                            "All dates",
                                                    },

                                                    {
                                                        value:
                                                            "30",

                                                        label:
                                                            "Last 30 days",
                                                    },

                                                    {
                                                        value:
                                                            "90",

                                                        label:
                                                            "Last 90 days",
                                                    },
                                                ].map(
                                                    (
                                                        option
                                                    ) => (

                                                        <TouchableOpacity
                                                            key={
                                                                option.value
                                                            }
                                                            style={
                                                                styles.dropdownItem
                                                            }
                                                            onPress={
                                                                () => {
                                                                    setSelectedRange(
                                                                        option.value as
                                                                            "all" |
                                                                            "30" |
                                                                            "90"
                                                                    );

                                                                    setOpenDropdown(
                                                                        null
                                                                    );
                                                                }
                                                            }
                                                        >

                                                            <Text
                                                                style={
                                                                    styles.dropdownItemText
                                                                }
                                                            >
                                                                {
                                                                    option.label
                                                                }
                                                            </Text>

                                                        </TouchableOpacity>

                                                    )
                                                )
                                            }

                                        </View>

                                    )
                                }

                            </View>


                            <View
                                style={
                                    styles.filterField
                                }
                            >

                                <Text
                                    style={
                                        styles.fieldLabel
                                    }
                                >
                                    Status
                                </Text>


                                <TouchableOpacity
                                    style={
                                        styles.dropdownButton
                                    }
                                    onPress={
                                        () =>
                                            setOpenDropdown(
                                                openDropdown ===
                                                    "status"
                                                    ? null
                                                    : "status"
                                            )
                                    }
                                >

                                    <Text
                                        style={
                                            styles.dropdownText
                                        }
                                    >
                                        {
                                            selectedStatusLabel
                                        }
                                    </Text>


                                    <Ionicons
                                        name="chevron-down"
                                        size={18}
                                        color={
                                            Colors.textSecondary
                                        }
                                    />

                                </TouchableOpacity>


                                {
                                    openDropdown ===
                                    "status" && (

                                        <View
                                            style={
                                                styles.dropdownMenu
                                            }
                                        >

                                            {
                                                [
                                                    {
                                                        value:
                                                            "all",

                                                        label:
                                                            "All sessions",
                                                    },

                                                    {
                                                        value:
                                                            "completed",

                                                        label:
                                                            "Completed sessions",
                                                    },

                                                    {
                                                        value:
                                                            "active",

                                                        label:
                                                            "Active sessions",
                                                    },

                                                    {
                                                        value:
                                                            "incomplete",
                                                        
                                                        label:
                                                            "Incomplete sessions",
                                                    },
                                                ].map(
                                                    (
                                                        option
                                                    ) => (

                                                        <TouchableOpacity
                                                            key={
                                                                option.value
                                                            }
                                                            style={
                                                                styles.dropdownItem
                                                            }
                                                            onPress={
                                                                () => {
                                                                    setSelectedStatus(
                                                                        option.value as
                                                                            "all" |
                                                                            "active" |
                                                                            "completed" |
                                                                            "incomplete"
                                                                    );

                                                                    setOpenDropdown(
                                                                        null
                                                                    );
                                                                }
                                                            }
                                                        >

                                                            <Text
                                                                style={
                                                                    styles.dropdownItemText
                                                                }
                                                            >
                                                                {
                                                                    option.label
                                                                }
                                                            </Text>

                                                        </TouchableOpacity>

                                                    )
                                                )
                                            }

                                        </View>

                                    )
                                }

                            </View>

                        </View>


                        <View
                            style={
                                styles.filterActions
                            }
                        >

                            <TouchableOpacity
                                style={
                                    styles.applyButton
                                }
                                onPress={
                                    applyFilters
                                }
                            >

                                <Text
                                    style={
                                        styles.applyButtonText
                                    }
                                >
                                    Apply Filters
                                </Text>

                            </TouchableOpacity>


                            <TouchableOpacity
                                style={
                                    styles.clearButton
                                }
                                onPress={
                                    clearFilters
                                }
                            >

                                <Text
                                    style={
                                        styles.clearButtonText
                                    }
                                >
                                    Clear Filters
                                </Text>

                            </TouchableOpacity>

                        </View>

                    </View>


                    <View
                        style={
                            styles.sessionsHeader
                        }
                    >

                        <View>

                            <Text
                                style={
                                    styles.sessionsTitle
                                }
                            >
                                Sessions
                            </Text>


                            <Text
                                style={
                                    styles.sessionsCount
                                }
                            >
                                {
                                    filteredSessions.length
                                }
                                {
                                    filteredSessions.length ===
                                        1
                                        ? " session"
                                        : " sessions"
                                }
                            </Text>

                        </View>


                        <TouchableOpacity
                            style={
                                styles.exportSummaryButton
                            }
                            onPress={
                                exportSummary
                            }
                        >

                            <Feather
                                name="download"
                                size={18}
                                color={
                                    Colors.primary
                                }
                            />


                            <Text
                                style={
                                    styles.exportSummaryText
                                }
                            >
                                Export Summary
                            </Text>

                        </TouchableOpacity>

                    </View>


                    {
                        loading ? (

                            <View
                                style={
                                    styles.messageCard
                                }
                            >

                                <ActivityIndicator
                                    size="large"
                                    color={
                                        Colors.primary
                                    }
                                />


                                <Text
                                    style={
                                        styles.messageText
                                    }
                                >
                                    Loading session history...
                                </Text>

                            </View>

                        ) :

                            error ? (

                                <View
                                    style={
                                        styles.messageCard
                                    }
                                >

                                    <Ionicons
                                        name="alert-circle-outline"
                                        size={34}
                                        color={
                                            Colors.danger
                                        }
                                    />


                                    <Text
                                        style={
                                            styles.errorText
                                        }
                                    >
                                        {
                                            error
                                        }
                                    </Text>


                                    <TouchableOpacity
                                        style={
                                            styles.retryButton
                                        }
                                        onPress={
                                            loadSessions
                                        }
                                    >

                                        <Text
                                            style={
                                                styles.retryButtonText
                                            }
                                        >
                                            Retry
                                        </Text>

                                    </TouchableOpacity>

                                </View>

                            ) :

                                filteredSessions.length ===
                                0 ? (

                                    <View
                                        style={
                                            styles.messageCard
                                        }
                                    >

                                        <Ionicons
                                            name="calendar-outline"
                                            size={42}
                                            color={
                                                Colors.disabled
                                            }
                                        />


                                        <Text
                                            style={
                                                styles.messageText
                                            }
                                        >
                                            No sessions found.
                                        </Text>

                                    </View>

                                ) : (

                                    <View
                                        style={
                                            styles.tableContainer
                                        }
                                    >

                                        <View
                                            style={
                                                styles.tableHeaderRow
                                            }
                                        >

                                            <Text
                                                style={[
                                                    styles.tableHeaderText,
                                                    styles.colCourse,
                                                ]}
                                            >
                                                COURSE
                                            </Text>


                                            <Text
                                                style={[
                                                    styles.tableHeaderText,
                                                    styles.colRoom,
                                                ]}
                                            >
                                                ROOM
                                            </Text>


                                            <Text
                                                style={[
                                                    styles.tableHeaderText,
                                                    styles.colDate,
                                                ]}
                                            >
                                                DATE
                                            </Text>


                                            <Text
                                                style={[
                                                    styles.tableHeaderText,
                                                    styles.colDuration,
                                                ]}
                                            >
                                                SESSION DURATION
                                            </Text>


                                            <Text
                                                style={[
                                                    styles.tableHeaderText,
                                                    styles.colAttendance,
                                                ]}
                                            >
                                                ATTENDANCE COUNT
                                            </Text>


                                            <Text
                                                style={[
                                                    styles.tableHeaderText,
                                                    styles.colExport,
                                                ]}
                                            >
                                                EXPORT
                                            </Text>

                                        </View>


                                        {
                                            filteredSessions.map(
                                                (
                                                    session
                                                ) => (

                                                    <View
                                                        key={
                                                            session.session_id
                                                        }
                                                        style={
                                                            styles.tableRow
                                                        }
                                                    >

                                                        <View
                                                            style={[
                                                                styles.tableCell,
                                                                styles.colCourse,
                                                            ]}
                                                        >

                                                            <Text
                                                                style={
                                                                    styles.primaryCellText
                                                                }
                                                            >
                                                                {
                                                                    session.course_code
                                                                }
                                                                {
                                                                    " — "
                                                                }
                                                                {
                                                                    session.course_name
                                                                }
                                                            </Text>

                                                        </View>


                                                        <View
                                                            style={[
                                                                styles.tableCell,
                                                                styles.colRoom,
                                                            ]}
                                                        >

                                                            <Text
                                                                style={
                                                                    styles.primaryCellText
                                                                }
                                                            >
                                                                {
                                                                    session.room ||
                                                                    "—"
                                                                }
                                                            </Text>

                                                        </View>


                                                        <View
                                                            style={[
                                                                styles.tableCell,
                                                                styles.colDate,
                                                            ]}
                                                        >

                                                            <Text
                                                                style={
                                                                    styles.primaryCellText
                                                                }
                                                            >
                                                                {
                                                                    formatDate(
                                                                        session.session_date
                                                                    )
                                                                }
                                                            </Text>


                                                            <Text
                                                                style={
                                                                    styles.secondaryCellText
                                                                }
                                                            >
                                                                {
                                                                    formatTime(
                                                                        session.start_time
                                                                    )
                                                                }
                                                            </Text>

                                                        </View>


                                                        <View
                                                            style={[
                                                                styles.tableCell,
                                                                styles.colDuration,
                                                            ]}
                                                        >

                                                            <Text
                                                                style={
                                                                    styles.primaryCellText
                                                                }
                                                            >
                                                                {
                                                                    session.duration ||
                                                                    (
                                                                        session.status ===
                                                                            "active"
                                                                            ? "In progress"
                                                                            : "—"
                                                                    )
                                                                }
                                                            </Text>

                                                        </View>


                                                        <View
                                                            style={[
                                                                styles.tableCell,
                                                                styles.colAttendance,
                                                            ]}
                                                        >

                                                            <Text
                                                                style={
                                                                    styles.primaryCellText
                                                                }
                                                            >
                                                                {
                                                                    session.attendance_count
                                                                }
                                                                {
                                                                    " / "
                                                                }
                                                                {
                                                                    session.enrolled_count
                                                                }
                                                            </Text>

                                                        </View>


                                                        <View
                                                            style={[
                                                                styles.tableCell,
                                                                styles.colExport,
                                                            ]}
                                                        >

                                                            <TouchableOpacity
                                                                style={
                                                                    styles.exportLink
                                                                }
                                                                onPress={
                                                                    () =>
                                                                        exportSession(
                                                                            session
                                                                        )
                                                                }
                                                            >

                                                                <Feather
                                                                    name="download"
                                                                    size={18}
                                                                    color={
                                                                        Colors.primary
                                                                    }
                                                                />


                                                                <Text
                                                                    style={
                                                                        styles.exportLinkText
                                                                    }
                                                                >
                                                                    Export CSV
                                                                </Text>

                                                            </TouchableOpacity>

                                                        </View>

                                                    </View>

                                                )
                                            )
                                        }

                                    </View>

                                )
                    }


                    <View
                        style={
                            styles.footer
                        }
                    >

                        <Text
                            style={
                                styles.footerText
                            }
                        >
                            University of North Texas
                        </Text>


                        <Text
                            style={
                                styles.footerDot
                            }
                        >
                            •
                        </Text>


                        <Text
                            style={
                                styles.footerText
                            }
                        >
                            GeoFace
                        </Text>

                    </View>

                </ScrollView>

            </View>

        </View>

    );

}


const styles =
    StyleSheet.create({

        safe: {
            flex: 1,
            backgroundColor:
                Colors.background,
        },


        container: {
            flex: 1,
            backgroundColor:
                Colors.background,
        },


        topHeader: {
            minHeight: 86,

            backgroundColor:
                Colors.surface,

            flexDirection:
                "row",

            alignItems:
                "center",

            justifyContent:
                "space-between",

            paddingHorizontal: 48,

            borderTopWidth: 10,

            borderTopColor:
                Colors.primary,

            borderBottomWidth: 4,

            borderBottomColor:
                Colors.tableBorder,
        },


        brandBox: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap:
                Spacing.md,
        },


        logoBox: {
            width: 72,
            height: 72,
        },


        brandDivider: {
            width: 2,

            height: 32,

            backgroundColor:
                Colors.border,
        },


        brandText: {
            color:
                Colors.textPrimary,

            fontSize: 22,

            fontWeight:
                "700",
        },


        profileBox: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 14,
        },


        profileText: {
            color:
                Colors.textPrimary,

            fontSize: 18,

            fontWeight:
                "700",
        },


        profileDivider: {
            width: 2,

            height: 28,

            backgroundColor:
                Colors.border,
        },


        logoutText: {
            color:
                Colors.primary,

            fontSize: 18,

            fontWeight:
                "700",
        },


        pageContent: {
            paddingHorizontal: 48,

            paddingTop: 24,

            paddingBottom: 24,
        },


        backLink: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 7,

            alignSelf:
                "flex-start",

            marginBottom: 18,
        },


        backLinkText: {
            color:
                Colors.primary,

            fontSize: 14,

            fontWeight:
                "700",
        },


        pageHeading: {
            marginBottom: 24,
        },


        pageTitle: {
            color:
                Colors.textPrimary,

            fontSize: 36,

            lineHeight: 42,

            fontWeight:
                "800",
        },


        pageSubtitle: {
            color:
                Colors.textSecondary,

            fontSize: 20,

            fontWeight:
                "500",

            marginTop: 4,
        },


        filterCard: {
            backgroundColor:
                Colors.surface,

            borderWidth: 1,

            borderColor:
                Colors.tableBorder,

            borderRadius:
                Radius.md,

            padding: 26,

            marginBottom: 28,

            zIndex: 100,
        },


        sectionTitle: {
            color:
                Colors.textPrimary,

            fontSize: 22,

            fontWeight:
                "800",
        },


        sectionSubtitle: {
            color:
                Colors.textSecondary,

            fontSize: 15,

            marginTop: 4,

            marginBottom: 18,
        },


        filterRow: {
            flexDirection:
                "row",

            alignItems:
                "flex-start",

            gap: 18,

            zIndex: 100,
        },


        filterField: {
            flex: 1,

            position:
                "relative",

            zIndex: 100,
        },


        fieldLabel: {
            color:
                Colors.textPrimary,

            fontSize: 14,

            fontWeight:
                "700",

            marginBottom: 7,
        },


        dropdownButton: {
            minHeight: 46,

            backgroundColor:
                Colors.surface,

            borderWidth: 1,

            borderColor:
                Colors.border,

            borderRadius:
                Radius.sm,

            paddingHorizontal: 14,

            flexDirection:
                "row",

            alignItems:
                "center",

            justifyContent:
                "space-between",
        },


        dropdownWithIcon: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 9,

            flex: 1,
        },


        dropdownText: {
            color:
                Colors.textPrimary,

            fontSize: 14,

            flexShrink: 1,
        },


        dropdownMenu: {
            position:
                "absolute",

            top: 73,

            left: 0,

            right: 0,

            backgroundColor:
                Colors.surface,

            borderWidth: 1,

            borderColor:
                Colors.border,

            borderRadius:
                Radius.sm,

            overflow:
                "hidden",

            zIndex: 200,
        },


        dropdownItem: {
            minHeight: 42,

            justifyContent:
                "center",

            paddingHorizontal: 14,

            borderBottomWidth: 1,

            borderBottomColor:
                Colors.borderLight,
        },


        dropdownItemText: {
            color:
                Colors.textPrimary,

            fontSize: 14,
        },


        filterActions: {
            flexDirection:
                "row",

            justifyContent:
                "flex-end",

            gap: 14,

            marginTop: 24,
        },


        applyButton: {
            minWidth: 260,

            minHeight: 46,

            backgroundColor:
                Colors.primary,

            borderRadius:
                Radius.sm,

            alignItems:
                "center",

            justifyContent:
                "center",
        },


        applyButtonText: {
            color:
                Colors.surface,

            fontSize: 14,

            fontWeight:
                "800",
        },


        clearButton: {
            minWidth: 190,

            minHeight: 46,

            backgroundColor:
                Colors.surface,

            borderWidth: 1.5,

            borderColor:
                Colors.primary,

            borderRadius:
                Radius.sm,

            alignItems:
                "center",

            justifyContent:
                "center",
        },


        clearButtonText: {
            color:
                Colors.primary,

            fontSize: 14,

            fontWeight:
                "800",
        },


        sessionsHeader: {
            flexDirection:
                "row",

            alignItems:
                "flex-end",

            justifyContent:
                "space-between",

            marginBottom: 14,
        },


        sessionsTitle: {
            color:
                Colors.textPrimary,

            fontSize: 28,

            fontWeight:
                "800",
        },


        sessionsCount: {
            color:
                Colors.textSecondary,

            fontSize: 14,

            marginTop: 4,
        },


        exportSummaryButton: {
            minHeight: 44,

            flexDirection:
                "row",

            alignItems:
                "center",

            justifyContent:
                "center",

            gap: 8,

            borderWidth: 1.5,

            borderColor:
                Colors.primary,

            borderRadius:
                Radius.sm,

            paddingHorizontal: 20,

            backgroundColor:
                Colors.surface,
        },


        exportSummaryText: {
            color:
                Colors.primary,

            fontSize: 14,

            fontWeight:
                "800",
        },


        tableContainer: {
            backgroundColor:
                Colors.surface,

            borderWidth: 1,

            borderColor:
                Colors.tableBorder,

            borderRadius:
                Radius.sm,

            overflow:
                "hidden",
        },


        tableHeaderRow: {
            minHeight: 50,

            flexDirection:
                "row",

            alignItems:
                "stretch",

            backgroundColor:
                Colors.tableHeader,

            borderBottomWidth: 1,

            borderBottomColor:
                Colors.tableBorder,
        },


        tableHeaderText: {
            color:
                Colors.textSecondary,

            fontSize: 12,

            fontWeight:
                "800",

            paddingHorizontal: 18,

            display:
                "flex",

            alignItems:
                "center",
        },


        tableRow: {
            minHeight: 64,

            flexDirection:
                "row",

            alignItems:
                "stretch",

            backgroundColor:
                Colors.surface,

            borderBottomWidth: 1,

            borderBottomColor:
                Colors.tableBorder,
        },


        tableCell: {
            paddingHorizontal: 18,

            justifyContent:
                "center",

            borderRightWidth: 1,

            borderRightColor:
                Colors.tableBorder,
        },


        primaryCellText: {
            color:
                Colors.textPrimary,

            fontSize: 14,

            fontWeight:
                "500",
        },


        secondaryCellText: {
            color:
                Colors.textSecondary,

            fontSize: 12,

            marginTop: 3,
        },


        colCourse: {
            flex: 1.4,
        },


        colRoom: {
            flex: 0.8,
        },


        colDate: {
            flex: 1.05,
        },


        colDuration: {
            flex: 1.05,
        },


        colAttendance: {
            flex: 1.05,
        },


        colExport: {
            flex: 1,
        },


        exportLink: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 8,
        },


        exportLinkText: {
            color:
                Colors.primary,

            fontSize: 14,

            fontWeight:
                "800",
        },


        messageCard: {
            minHeight: 220,

            backgroundColor:
                Colors.surface,

            borderWidth: 1,

            borderColor:
                Colors.tableBorder,

            borderRadius:
                Radius.md,

            alignItems:
                "center",

            justifyContent:
                "center",

            padding: 30,
        },


        messageText: {
            color:
                Colors.textSecondary,

            fontSize: 14,

            marginTop: 12,
        },


        errorText: {
            color:
                Colors.danger,

            fontSize: 14,

            marginTop: 10,

            textAlign:
                "center",
        },


        retryButton: {
            minWidth: 110,

            minHeight: 42,

            marginTop: 16,

            backgroundColor:
                Colors.primary,

            borderRadius:
                Radius.sm,

            alignItems:
                "center",

            justifyContent:
                "center",
        },


        retryButtonText: {
            color:
                Colors.surface,

            fontSize: 14,

            fontWeight:
                "800",
        },


        footer: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 8,

            marginTop: 26,

            paddingTop: 18,

            borderTopWidth: 1,

            borderTopColor:
                Colors.tableBorder,
        },


        footerText: {
            color:
                Colors.textSecondary,

            fontSize: 12,
        },


        footerDot: {
            color:
                Colors.textSecondary,

            fontSize: 12,
        },

    });
import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    TouchableOpacity,
    Platform,
    Alert,
    useWindowDimensions
} from "react-native";

import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, {
    useEffect,
    useState
} from "react";

import {
    Ionicons
} from "@expo/vector-icons";

import {
    API_BASE
} from "../constants/api";

import {
    Colors,
    Spacing,
    Radius
} from "../constants/theme";


// ============================================================
// TYPES
// ============================================================

type AdminTool = {
    id: string;
    title: string;
    description: string;
    buttonText: string;

    icon:
        | "key-outline"
        | "server-outline"
        | "people-outline"
        | "refresh-circle-outline"
        | "document-text-outline"
        | "clipboard-outline"
        | "settings-outline";

    action: () => void;
};


// ============================================================
// SCREEN
// ============================================================

export default function AdminDashboardScreen() {

    const router = useRouter();
    const insets = useSafeAreaInsets();

    const {
        width
    } = useWindowDimensions();


    // ============================================================
    // CURRENT ADMIN
    // ============================================================

    const storedUser =
        Platform.OS === "web"
            ? localStorage.getItem(
                "user"
            )
            : null;

    const currentUser =
        storedUser
            ? JSON.parse(
                storedUser
            )
            : null;


    // ============================================================
    // DASHBOARD STATE
    // ============================================================

    const [
        backendOnline,
        setBackendOnline
    ] = useState(false);

    const [
        checkingBackend,
        setCheckingBackend
    ] = useState(true);

    const [
        lastSync,
        setLastSync
    ] =
        useState<Date | null>(
            null
        );


    // ============================================================
    // RESPONSIVE LAYOUT
    // ============================================================

    const isDesktop =
        width >= 1000;

    const isTablet =
        width >= 700 &&
        width < 1000;

    const cardWidth =
        isDesktop
            ? "32%"
            : isTablet
            ? "48%"
            : "100%";


    // ============================================================
    // INITIAL LOAD
    // ============================================================

    useEffect(() => {

        checkBackendStatus();

    }, []);


    // ============================================================
    // BACKEND STATUS
    // ============================================================

    const checkBackendStatus =
        async () => {

        setCheckingBackend(
            true
        );

        try {

            const response =
                await fetch(
                    `${API_BASE}/openapi.json`
                );


            if (!response.ok) {

                throw new Error(
                    `Server returned ${response.status}`
                );

            }


            setBackendOnline(
                true
            );

            setLastSync(
                new Date()
            );

        }

        catch (error) {

            console.error(
                "Backend status check failed:",
                error
            );


            setBackendOnline(
                false
            );

        }

        finally {

            setCheckingBackend(
                false
            );

        }
    };


    // ============================================================
    // LOGOUT
    // ============================================================

    const handleLogout = () => {

        if (
            Platform.OS === "web"
        ) {

            localStorage.removeItem(
                "access_token"
            );

            localStorage.removeItem(
                "user"
            );

        }


        router.replace(
            "/adminlogin"
        );
    };


    // ============================================================
    // ADMIN TOOL HELPERS
    // ============================================================

    const showComingSoon = (
        title: string,
        message: string
    ) => {

        Alert.alert(
            title,
            message
        );

    };


    // ============================================================
    // PASSWORD ISSUES
    // ============================================================

    const handlePasswordIssues =
        () => {

        showComingSoon(
            "Password Issues",
            "Password reset and account unlock tools have not been implemented yet."
        );

    };


    // ============================================================
    // DATABASE ISSUES
    // ============================================================

    const handleDatabaseIssues =
        async () => {

        await checkBackendStatus();


        Alert.alert(
            "Database / Backend Status",
            backendOnline
                ? "The application backend is currently reachable. Dedicated database diagnostic tools have not been implemented yet."
                : "The application backend could not be reached."
        );

    };


    // ============================================================
    // USER MANAGEMENT
    // ============================================================

    const handleUserManagement =
        () => {

        showComingSoon(
            "User Management",
            "Administrative user and role management tools have not been implemented yet."
        );

    };


    // ============================================================
    // SESSION RECOVERY
    // ============================================================

    const handleSessionRecovery =
        () => {

        showComingSoon(
            "Session Recovery",
            "The backend currently restores unfinished attendance sessions automatically. Manual administrative recovery tools have not been implemented yet."
        );

    };


    // ============================================================
    // ATTENDANCE CORRECTIONS
    // ============================================================

    const handleAttendanceCorrections =
        () => {

        showComingSoon(
            "Attendance Corrections",
            "Administrative attendance correction tools have not been implemented yet."
        );

    };


    // ============================================================
    // SYSTEM LOGS
    // ============================================================

    const handleSystemLogs =
        () => {

        showComingSoon(
            "System Logs",
            "The prototype does not currently expose backend or audit logs through the administrator interface."
        );

    };


    // ============================================================
    // SETTINGS
    // ============================================================

    const handleSettings =
        () => {

        showComingSoon(
            "Settings",
            "Administrative application settings have not been implemented yet."
        );

    };


    // ============================================================
    // ADMIN TOOLS
    // ============================================================

    const adminTools:
        AdminTool[] = [

        {
            id:
                "passwords",

            title:
                "Password Issues",

            description:
                "Reset passwords, unlock accounts, and help with login issues.",

            buttonText:
                "Manage Password Issues",

            icon:
                "key-outline",

            action:
                handlePasswordIssues
        },

        {
            id:
                "database",

            title:
                "Database Issues",

            description:
                "View database status, run diagnostics, and resolve data issues.",

            buttonText:
                "Manage Database Issues",

            icon:
                "server-outline",

            action:
                handleDatabaseIssues
        },

        {
            id:
                "users",

            title:
                "User Management",

            description:
                "Manage user accounts, roles, and permissions.",

            buttonText:
                "Manage Users",

            icon:
                "people-outline",

            action:
                handleUserManagement
        },

        {
            id:
                "sessions",

            title:
                "Session Recovery",

            description:
                "Recover active or incomplete attendance sessions.",

            buttonText:
                "Recover Sessions",

            icon:
                "refresh-circle-outline",

            action:
                handleSessionRecovery
        },

        {
            id:
                "attendance",

            title:
                "Attendance Corrections",

            description:
                "View and correct attendance records for students.",

            buttonText:
                "Manage Corrections",

            icon:
                "document-text-outline",

            action:
                handleAttendanceCorrections
        },

        {
            id:
                "logs",

            title:
                "System Logs",

            description:
                "View system logs, errors, and audit information.",

            buttonText:
                "View Logs",

            icon:
                "clipboard-outline",

            action:
                handleSystemLogs
        },

        {
            id:
                "settings",

            title:
                "Settings",

            description:
                "Configure system settings and application preferences.",

            buttonText:
                "Manage Settings",

            icon:
                "settings-outline",

            action:
                handleSettings
        }

    ];


    // ============================================================
    // FORMAT LAST SYNC
    // ============================================================

    const formatLastSync =
        () => {

        if (!lastSync) {

            return "—";

        }


        return lastSync
            .toLocaleString(
                "en-US",
                {
                    month:
                        "short",

                    day:
                        "numeric",

                    year:
                        "numeric",

                    hour:
                        "numeric",

                    minute:
                        "2-digit"
                }
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
                        insets.bottom
                }
            ]}
        >

            <View
                style={
                    styles.container
                }
            >


                {/* =====================================================
                    TOP HEADER
                ====================================================== */}

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
                            source={require(
                                "../assets/logo.png"
                            )}
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


                    {/* =================================================
                        ADMIN PROFILE / LOGOUT
                    ================================================== */}

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
                                "Administrator"
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
                                handleLogout
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


                {/* =====================================================
                    PAGE CONTENT
                ====================================================== */}

                <ScrollView
                    contentContainerStyle={
                        styles.pageContent
                    }
                    
                >


                    {/* =================================================
                        PAGE HEADING
                    ================================================== */}

                    <View
                        style={
                            styles.pageHeading
                        }
                    >

                        <Text
                            style={
                                styles.dashboardTitle
                            }
                        >
                            Admin Dashboard
                        </Text>


                        <Text
                            style={
                                styles.dashboardSubtitle
                            }
                        >
                            Administrative tools for system support and issue management.
                        </Text>

                    </View>


                    {/* =================================================
                        SYSTEM OVERVIEW
                    ================================================== */}

                    <View
                        style={
                            styles.overviewCard
                        }
                    >


                        {/* Open Tickets */}

                        <View
                            style={
                                styles.overviewSection
                            }
                        >

                            <View
                                style={
                                    styles.overviewIcon
                                }
                            >

                                <Ionicons
                                    name="document-text-outline"
                                    size={32}
                                    color={
                                        Colors.primary
                                    }
                                />

                            </View>


                            <View>

                                <Text
                                    style={
                                        styles.overviewLabel
                                    }
                                >
                                    Open Tickets
                                </Text>


                                <View
                                    style={
                                        styles.ticketRow
                                    }
                                >

                                    <Text
                                        style={
                                            styles.overviewValue
                                        }
                                    >
                                        3
                                    </Text>


                                    <View
                                        style={
                                            styles.urgentBadge
                                        }
                                    >

                                        <Text
                                            style={
                                                styles.urgentText
                                            }
                                        >
                                            2 urgent
                                        </Text>

                                    </View>

                                </View>

                            </View>

                        </View>


                        <View
                            style={
                                styles.overviewDivider
                            }
                        />


                        {/* Database Status */}

                        <TouchableOpacity
                            style={
                                styles.overviewSection
                            }
                            onPress={
                                checkBackendStatus
                            }
                        >

                            <View
                                style={
                                    styles.overviewIcon
                                }
                            >

                                <Ionicons
                                    name="server-outline"
                                    size={32}
                                    color={
                                        Colors.primary
                                    }
                                />

                            </View>


                            <View>

                                <Text
                                    style={
                                        styles.overviewLabel
                                    }
                                >
                                    Database Status
                                </Text>


                                <View
                                    style={
                                        styles.statusRow
                                    }
                                >

                                    <View
                                        style={[
                                            styles.statusDot,
                                            {
                                                backgroundColor:
                                                    backendOnline
                                                        ? Colors.success
                                                        : Colors.danger
                                            }
                                        ]}
                                    />


                                    <Text
                                        style={[
                                            styles.statusText,
                                            {
                                                color:
                                                    backendOnline
                                                        ? Colors.success
                                                        : Colors.danger
                                            }
                                        ]}
                                    >
                                        {
                                            checkingBackend
                                                ? "Checking..."
                                                : backendOnline
                                                ? "Online"
                                                : "Offline"
                                        }
                                    </Text>

                                </View>

                            </View>

                        </TouchableOpacity>


                        <View
                            style={
                                styles.overviewDivider
                            }
                        />


                        {/* Last Sync */}

                        <View
                            style={
                                styles.overviewSection
                            }
                        >

                            <View
                                style={
                                    styles.overviewIcon
                                }
                            >

                                <Ionicons
                                    name="time-outline"
                                    size={32}
                                    color={
                                        Colors.primary
                                    }
                                />

                            </View>


                            <View
                                style={
                                    styles.syncSection
                                }
                            >

                                <Text
                                    style={
                                        styles.overviewLabel
                                    }
                                >
                                    Last Sync
                                </Text>


                                <Text
                                    style={
                                        styles.syncValue
                                    }
                                >
                                    {
                                        formatLastSync()
                                    }
                                </Text>


                                <Text
                                    style={
                                        styles.syncSubtitle
                                    }
                                >
                                    {
                                        backendOnline
                                            ? "Application backend reachable"
                                            : "Backend unavailable"
                                    }
                                </Text>

                            </View>

                        </View>

                    </View>


                    {/* =================================================
                        ADMIN TOOLS
                    ================================================== */}

                    <View
                        style={
                            styles.toolGrid
                        }
                    >

                        {
                            adminTools.map(
                                (tool) => (

                                    <View
                                        key={
                                            tool.id
                                        }
                                        style={[
                                            styles.toolCard,
                                            {
                                                width:
                                                    cardWidth
                                            }
                                        ]}
                                    >

                                        <View
                                            style={
                                                styles.toolContent
                                            }
                                        >

                                            <View
                                                style={
                                                    styles.toolIcon
                                                }
                                            >

                                                <Ionicons
                                                    name={
                                                        tool.icon
                                                    }
                                                    size={38}
                                                    color={
                                                        Colors.primary
                                                    }
                                                />

                                            </View>


                                            <View
                                                style={
                                                    styles.toolTextArea
                                                }
                                            >

                                                <Text
                                                    style={
                                                        styles.toolTitle
                                                    }
                                                >
                                                    {
                                                        tool.title
                                                    }
                                                </Text>


                                                <Text
                                                    style={
                                                        styles.toolDescription
                                                    }
                                                >
                                                    {
                                                        tool.description
                                                    }
                                                </Text>

                                            </View>

                                        </View>


                                        <TouchableOpacity
                                            style={
                                                styles.toolButton
                                            }
                                            onPress={
                                                tool.action
                                            }
                                        >

                                            <Text
                                                style={
                                                    styles.toolButtonText
                                                }
                                            >
                                                {
                                                    tool.buttonText
                                                }
                                            </Text>


                                            <Ionicons
                                                name="arrow-forward"
                                                size={21}
                                                color={
                                                    Colors.primary
                                                }
                                            />

                                        </TouchableOpacity>

                                    </View>

                                )
                            )
                        }

                    </View>


                    {/* =================================================
                        FOOTER
                    ================================================== */}

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            University of North Texas
                        </Text>

                        <Text
                            style={styles.footerDot}>
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


// ============================================================
// STYLES
// ============================================================

const styles =
    StyleSheet.create({


        // ============================================================
        // PAGE
        // ============================================================

        safe: {
            flex: 1,
            backgroundColor:
                Colors.background
        },


        container: {
            flex: 1,
            backgroundColor:
                Colors.background
        },


        pageContent: {
            paddingHorizontal: 48,
            paddingTop: 32,
            paddingBottom: 72
        },


        // ============================================================
        // HEADER
        // ============================================================

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
                Colors.tableBorder
        },


        brandBox: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap:
                Spacing.md
        },


        logoBox: {
            width: 72,
            height: 72
        },


        brandDivider: {
            width: 2,
            height: 32,

            backgroundColor:
                Colors.border
        },


        brandText: {
            color:
                Colors.textPrimary,

            fontSize: 22,
            fontWeight: "700"
        },


        profileBox: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 14
        },


        profileText: {
            color:
                Colors.textPrimary,

            fontSize: 18,
            fontWeight: "700"
        },


        profileDivider: {
            width: 2,
            height: 28,

            backgroundColor:
                Colors.border
        },


        logoutText: {
            color:
                Colors.primary,

            fontSize: 18,
            fontWeight: "700"
        },


        // ============================================================
        // PAGE TITLE
        // ============================================================

        pageHeading: {
            marginBottom: 26
        },


        dashboardTitle: {
            color:
                Colors.textPrimary,

            fontSize: 36,
            lineHeight: 42,

            fontWeight: "800"
        },


        dashboardSubtitle: {
            color:
                Colors.textSecondary,

            fontSize: 23,
            fontWeight: "500",

            marginTop: 4
        },


        // ============================================================
        // SYSTEM OVERVIEW
        // ============================================================

        overviewCard: {
            width: "100%",

            backgroundColor:
                Colors.surface,

            borderWidth: 1,
            borderColor:
                Colors.tableBorder,

            borderRadius:
                Radius.md,

            paddingHorizontal: 30,
            paddingVertical: 24,

            flexDirection:
                "row",

            alignItems:
                "center",

            marginBottom: 24
        },


        overviewSection: {
            flex: 1,

            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 18,

            minHeight: 78
        },


        overviewIcon: {
            width: 64,
            height: 64,

            borderRadius:
                Radius.md,

            backgroundColor:
                Colors.featureIconBackground,

            alignItems:
                "center",

            justifyContent:
                "center"
        },


        overviewDivider: {
            width: 1,
            height: 66,

            backgroundColor:
                Colors.tableBorder,

            marginHorizontal: 28
        },


        overviewLabel: {
            color:
                Colors.textSecondary,

            fontSize: 15,
            fontWeight: "500"
        },


        overviewValue: {
            color:
                Colors.textPrimary,

            fontSize: 28,
            fontWeight: "800"
        },


        ticketRow: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 12,

            marginTop: 5
        },


        urgentBadge: {
            backgroundColor:
                Colors.dangerSoft,

            borderRadius:
                Radius.pill,

            paddingHorizontal: 12,
            paddingVertical: 5
        },


        urgentText: {
            color:
                Colors.danger,

            fontSize: 13,
            fontWeight: "700"
        },


        statusRow: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 9,

            marginTop: 8
        },


        statusDot: {
            width: 12,
            height: 12,

            borderRadius:
                Radius.pill
        },


        statusText: {
            fontSize: 19,
            fontWeight: "800"
        },


        syncSection: {
            flex: 1
        },


        syncValue: {
            color:
                Colors.textPrimary,

            fontSize: 17,
            fontWeight: "800",

            marginTop: 4
        },


        syncSubtitle: {
            color:
                Colors.textSecondary,

            fontSize: 13,

            marginTop: 3
        },


        // ============================================================
        // ADMIN TOOL GRID
        // ============================================================

        toolGrid: {
            width: "100%",

            flexDirection:
                "row",

            flexWrap:
                "wrap",

            gap: 18
        },


        toolCard: {
            minHeight: 205,

            backgroundColor:
                Colors.surface,

            borderWidth: 1,
            borderColor:
                Colors.tableBorder,

            borderRadius:
                Radius.md,

            padding: 22,

            justifyContent:
                "space-between"
        },


        toolContent: {
            flexDirection:
                "row",

            alignItems:
                "flex-start",

            gap: 18
        },


        toolIcon: {
            width: 68,
            height: 68,

            borderRadius:
                Radius.md,

            backgroundColor:
                Colors.featureIconBackground,

            alignItems:
                "center",

            justifyContent:
                "center"
        },


        toolTextArea: {
            flex: 1,
            minWidth: 0
        },


        toolTitle: {
            color:
                Colors.textPrimary,

            fontSize: 18,
            fontWeight: "800",

            marginTop: 4
        },


        toolDescription: {
            color:
                Colors.textSecondary,

            fontSize: 15,
            lineHeight: 21,

            marginTop: 5
        },


        toolButton: {
            minHeight: 46,

            backgroundColor:
                Colors.surface,

            borderWidth: 1.5,
            borderColor:
                Colors.primary,

            borderRadius:
                Radius.sm,

            flexDirection:
                "row",

            alignItems:
                "center",

            justifyContent:
                "space-between",

            paddingHorizontal: 17,

            marginTop: 20
        },


        toolButtonText: {
            color:
                Colors.primary,

            fontSize: 14,
            fontWeight: "800"
        },


        // ============================================================
        // FOOTER
        // ============================================================

        footer: {
    position: "absolute",

    left: 48,
    right: 48,
    bottom: 0,

    height: 48,

    flexDirection: "row",
    alignItems: "center",

    gap: 8,

    backgroundColor: Colors.background,

    borderTopWidth: 1,
    borderTopColor: Colors.tableBorder,

    zIndex: 50
},

footerText: {
    color: Colors.textSecondary,
    fontSize: 12
},

footerDot: {
    color: Colors.textSecondary,
    fontSize: 12
},

    });
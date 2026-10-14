import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
    ScrollView
} from "react-native";

import {
    useLocalSearchParams,
    useRouter
} from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";

import { Colors, Radius, Spacing } from "../constants/theme";


export default function FirstTimeEnrollScreen() {

    const router = useRouter();

    const params = useLocalSearchParams();

    const userId = params.userId?.toString();

    const insets = useSafeAreaInsets();


    function handleAccept() {

        if (!userId) {

            console.log(
                "Missing userId from signup"
            );

            return;
        }


        router.push({
            pathname: "/faceEnroll",

            params: {
                userId: userId
            }
        });
    }


    function handleDecline() {

        router.replace("/login");
    }


    return (

        <View style={styles.container}>


            {/* =====================================================
                HEADER
            ====================================================== */}

            <View style={[styles.header, {paddingTop: insets.top}]}>

                <Pressable
                    onPress={() => router.back()}
                    style={styles.headerIconButton}
                    hitSlop={10}
                >

                    <Ionicons
                        name="chevron-back"
                        size={30}
                        color={Colors.textSecondary}
                    />

                </Pressable>


                <View style={styles.headerBrand}>

                    <Image
                        source={require("../assets/logo.png")}
                        style={styles.headerLogo}
                        resizeMode="contain"
                    />

                    <View style={styles.headerDivider} />

                    <Text style={styles.headerTitle}>
                        Consent Form
                    </Text>

                </View>


                <View style={styles.headerIconButton}>

                    <Ionicons
                        name="person-outline"
                        size={30}
                        color={Colors.textSecondary}
                    />

                </View>

            </View>


            {/* =====================================================
                CONTENT
            ====================================================== */}

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >

                <View style={styles.permissionCard}>


                    {/* Camera Icon */}

                    <View style={styles.cameraIconCircle}>

                        <Ionicons
                            name="camera-outline"
                            size={52}
                            color={Colors.primary}
                        />

                    </View>


                    {/* Title */}

                    <Text style={styles.title}>
                        Camera Permission
                    </Text>


                    {/* Permission Message */}

                    <Text style={styles.message}>
                        This app needs permission to use your camera
                        for biometric face enrollment.
                    </Text>


                    <Text style={styles.message}>
                        Your face will be scanned automatically and
                        processed to create your biometric profile.
                    </Text>


                    {/* Biometric Data Notice */}

                    <View style={styles.infoBox}>

                        <Ionicons
                            name="information-circle-outline"
                            size={28}
                            color={Colors.textSecondary}
                        />

                        <Text style={styles.infoText}>
                            Your biometric data is only used for
                            attendance verification and can be deleted
                            according to school policy.
                        </Text>

                    </View>


                    {/* =================================================
                        CONSENT ACTIONS
                    ================================================== */}

                    <View style={styles.buttonRow}>

                        <Pressable
                            style={styles.acceptButton}
                            onPress={handleAccept}
                        >

                            <Text style={styles.acceptButtonText}>
                                Accept
                            </Text>

                        </Pressable>


                        <Pressable
                            style={styles.declineButton}
                            onPress={handleDecline}
                        >

                            <Text style={styles.declineButtonText}>
                                Decline
                            </Text>

                        </Pressable>

                    </View>

                </View>

            </ScrollView>

        </View>
    );
}


const styles = StyleSheet.create({


    // ============================================================
    // PAGE
    // ============================================================

    container: {
        flex: 1,
        backgroundColor: Colors.background
    },


    scrollContent: {
        flexGrow: 1,

        justifyContent: "center",
        alignItems: "center",

        paddingHorizontal: 24,
        paddingVertical: 34
    },


    // ============================================================
    // HEADER
    // ============================================================

    header: {
        minHeight: 90,

        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",

        backgroundColor: Colors.surface,

        paddingHorizontal: 20,
        paddingTop: 14,

        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight
    },


    headerIconButton: {
        width: 44,
        height: 44,

        alignItems: "center",
        justifyContent: "center"
    },


    headerBrand: {
        flexDirection: "row",
        alignItems: "center",

        gap: Spacing.md
    },


    headerLogo: {
        width: 58,
        height: 58
    },


    headerDivider: {
        width: 2,
        height: 38,

        backgroundColor: Colors.border
    },


    headerTitle: {
        color: Colors.textPrimary,

        fontSize: 24,
        fontWeight: "800"
    },


    // ============================================================
    // PERMISSION CARD
    // ============================================================

    permissionCard: {
        width: "100%",
        maxWidth: 390,

        alignItems: "center",

        backgroundColor: Colors.surface,

        borderWidth: 1,
        borderColor: Colors.borderLight,
        borderRadius: Radius.lg,

        paddingHorizontal: 24,
        paddingTop: 34,
        paddingBottom: 24,

        shadowColor: Colors.textPrimary,
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: {
            width: 0,
            height: 5
        },

        elevation: 3
    },


    cameraIconCircle: {
        width: 108,
        height: 108,

        borderRadius: Radius.pill,

        alignItems: "center",
        justifyContent: "center",

        backgroundColor: Colors.featureIconBackground,

        marginBottom: 22
    },


    title: {
        color: Colors.textPrimary,

        fontSize: 30,
        fontWeight: "800",

        textAlign: "center",

        marginBottom: 22
    },


    message: {
        color: Colors.textPrimary,

        fontSize: 18,
        lineHeight: 26,

        textAlign: "center",

        marginBottom: 22
    },


    // ============================================================
    // BIOMETRIC DATA NOTICE
    // ============================================================

    infoBox: {
        width: "100%",

        flexDirection: "row",
        alignItems: "flex-start",

        gap: 14,

        backgroundColor: Colors.background,

        borderWidth: 1,
        borderColor: Colors.borderLight,
        borderRadius: Radius.md,

        paddingHorizontal: 18,
        paddingVertical: 16,

        marginTop: 2,
        marginBottom: 24
    },


    infoText: {
        flex: 1,

        color: Colors.textSecondary,

        fontSize: 15,
        lineHeight: 21
    },


    // ============================================================
    // CONSENT BUTTONS
    // ============================================================

    buttonRow: {
        width: "100%",

        flexDirection: "row",

        gap: 14
    },


    acceptButton: {
        flex: 1,
        minHeight: 58,

        backgroundColor: Colors.primary,

        borderRadius: Radius.md,

        alignItems: "center",
        justifyContent: "center"
    },


    acceptButtonText: {
        color: Colors.surface,

        fontSize: 19,
        fontWeight: "800"
    },


    declineButton: {
        flex: 1,
        minHeight: 58,

        backgroundColor: Colors.surface,

        borderWidth: 1.5,
        borderColor: Colors.danger,
        borderRadius: Radius.md,

        alignItems: "center",
        justifyContent: "center"
    },


    declineButtonText: {
        color: Colors.danger,

        fontSize: 19,
        fontWeight: "800"
    }

});


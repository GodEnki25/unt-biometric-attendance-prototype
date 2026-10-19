import {View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, TextInput, Platform, Alert, ActivityIndicator } from "react-native";

import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE } from "../constants/api";
import { Colors, Spacing, Radius } from "../constants/theme";


// ============================================================
// TYPES
// ============================================================

type OverrideEvent = {
    event_type: string;
    event_time: string;
};


type OverrideDetails = {

    student: {
        student_id: number;
        student_name: string;
    };

    course: {
        course_id: number;
        course_code: string;
        course_name: string;
    };

    session: {
        session_id: number;
        session_date: string;
    };

    attendance: {
        attendance_id:
            number | null;

        status:
            string;

        check_in_time:
            string | null;

        face_verified:
            boolean;

        location_verified:
            boolean;
    };

    events:
        OverrideEvent[];
};


// ============================================================
// SCREEN
// ============================================================

export default function InstructorOverride() {

    const router =
        useRouter();

    const insets =
        useSafeAreaInsets();


    // ============================================================
    // ROUTE PARAMETERS
    // ============================================================

    const {
        student,
        studentId
    } =
        useLocalSearchParams<{
            student?: string;
            studentId?: string;
        }>();


    // ============================================================
    // CURRENT INSTRUCTOR
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
    // SCREEN STATE
    // ============================================================

    const [
        details,
        setDetails
    ] =
        useState<
            OverrideDetails | null
        >(null);


    const [
        selectedStatus,
        setSelectedStatus
    ] =
        useState(
            ""
        );


    const [
        notes,
        setNotes
    ] =
        useState(
            ""
        );


    const [
        loading,
        setLoading
    ] =
        useState(
            true
        );


    const [
        saving,
        setSaving
    ] =
        useState(
            false
        );


    const [
        error,
        setError
    ] =
        useState(
            ""
        );


    // ============================================================
    // INITIAL LOAD
    // ============================================================

    useEffect(() => {

        loadOverrideData();

    }, []);


    // ============================================================
    // LOAD CURRENT STUDENT / SESSION
    // ============================================================

    const loadOverrideData =
        async () => {

        setLoading(
            true
        );

        setError(
            ""
        );


        try {

            const token =
                Platform.OS === "web"
                    ? localStorage.getItem(
                        "access_token"
                    )
                    : null;


            if (!token) {

                throw new Error(
                    "Instructor is not logged in."
                );

            }


            /*
             * The instructor dashboard currently sends the
             * student's name.
             *
             * If studentId is available later, we can skip
             * the /checkins lookup entirely.
             */

            let resolvedStudentId =
                studentId
                    ? Number(
                        studentId
                    )
                    : null;


            // --------------------------------------------------------
            // RESOLVE STUDENT ID FROM REAL CHECK-IN DATA
            // --------------------------------------------------------

            if (
                !resolvedStudentId
                && student
            ) {

                const checkinResponse =
                    await fetch(
                        `${API_BASE}/checkins`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${token}`
                            }
                        }
                    );


                if (
                    !checkinResponse.ok
                ) {

                    throw new Error(
                        "Unable to load student attendance."
                    );

                }


                const records =
                    await checkinResponse.json();


                const matchingStudent =
                    records.find(
                        (record: any) =>
                            record.student_name ===
                            student
                    );


                if (
                    !matchingStudent
                ) {

                    throw new Error(
                        "Student could not be found."
                    );

                }


                resolvedStudentId =
                    matchingStudent.student_id;

            }


            if (
                !resolvedStudentId
            ) {

                throw new Error(
                    "Student ID is missing."
                );

            }


            // --------------------------------------------------------
            // LOAD OVERRIDE DETAILS
            // --------------------------------------------------------

            const response =
                await fetch(
                    `${API_BASE}/attendance/override/${resolvedStudentId}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
                || !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to load override information."
                );

            }


            setDetails(
                data
            );


            setSelectedStatus(
                normalizeStatus(
                    data.attendance.status
                )
            );

        }

        catch (error: any) {

            console.error(
                "Override load failed:",
                error
            );


            setError(
                error.message ||
                "Unable to load attendance override."
            );

        }

        finally {

            setLoading(
                false
            );

        }

    };


    // ============================================================
    // STATUS HELPERS
    // ============================================================

    const normalizeStatus =
        (
            status:
                string
        ) => {

        if (!status) {

            return "absent";

        }


        return status
            .trim()
            .toLowerCase();

    };


    const formatStatus =
        (
            status:
                string
        ) => {

        if (!status) {

            return "Unknown";

        }


        return (
            status
                .charAt(0)
                .toUpperCase()
            +
            status
                .slice(1)
                .toLowerCase()
        );

    };


    // ============================================================
    // DATE FORMAT
    // ============================================================

    const formatDate =
        (
            dateValue:
                string
        ) => {

        if (!dateValue) {

            return "—";

        }


        const date =
            new Date(
                `${dateValue}T12:00:00`
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return dateValue;

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
                        "numeric"
                }
            );

    };


    // ============================================================
    // TIME FORMAT
    // ============================================================

    const formatTime =
        (
            dateTime:
                string
        ) => {

        if (!dateTime) {

            return "—";

        }


        const parts =
            dateTime.split(
                " "
            );


        if (
            parts.length < 2
        ) {

            return dateTime;

        }


        const timeParts =
            parts[1].split(
                ":"
            );


        if (
            timeParts.length < 2
        ) {

            return dateTime;

        }


        const hour =
            parseInt(
                timeParts[0],
                10
            );


        const minute =
            timeParts[1];


        const period =
            hour >= 12
                ? "PM"
                : "AM";


        const displayHour =
            hour % 12 || 12;


        return (
            `${displayHour}:${minute} ${period}`
        );

    };


    // ============================================================
    // SAVE OVERRIDE
    // ============================================================

    const saveOverride =
        async () => {

        if (
            !details
            || !selectedStatus
        ) {

            return;

        }


        setSaving(
            true
        );


        try {

            const token =
                Platform.OS === "web"
                    ? localStorage.getItem(
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
                    `${API_BASE}/attendance/override`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`
                        },

                        body:
                            JSON.stringify({
                                session_id:
                                    details.session.session_id,

                                student_id:
                                    details.student.student_id,

                                status:
                                    selectedStatus

                                /*
                                 * Notes intentionally are NOT
                                 * being sent yet.
                                 *
                                 * The DB / audit schema does not
                                 * currently have somewhere to
                                 * persist them.
                                 */
                            })
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
                || !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to save attendance override."
                );

            }


            Alert.alert(
                "Override Saved",
                `${details.student.student_name}'s attendance is now ${formatStatus(selectedStatus)}.`
            );


            await loadOverrideData();

        }

        catch (error: any) {

            console.error(
                "Override save failed:",
                error
            );


            Alert.alert(
                "Save Failed",
                error.message ||
                "Unable to save attendance override."
            );

        }

        finally {

            setSaving(
                false
            );

        }

    };


    // ============================================================
    // LOGOUT
    // ============================================================

    const logout =
        () => {

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
            "/loginInstructor"
        );

    };


    // ============================================================
    // STATUS OPTIONS
    // ============================================================

    const statusOptions = [

        {
            value:
                "present",

            title:
                "Present",

            description:
                "Student was present for this session."
        },

        {
            value:
                "late",

            title:
                "Late",

            description:
                "Student arrived after the session start time."
        },

        {
            value:
                "excused",

            title:
                "Excused",

            description:
                "Absence is excused."
        },

        {
            value:
                "absent",

            title:
                "Absent",

            description:
                "Student did not attend this session."
        }

    ];


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


                {/* =====================================================
                    PAGE
                ====================================================== */}

                <ScrollView
                    contentContainerStyle={
                        styles.pageContent
                    }
                >


                    {/* =================================================
                        BACK LINK
                    ================================================== */}

                    <TouchableOpacity
                        style={
                            styles.backLink
                        }
                        onPress={() =>
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
                                styles.pageTitle
                            }
                        >
                            Attendance Override
                        </Text>


                        <Text
                            style={
                                styles.pageSubtitle
                            }
                        >
                            Update a student's attendance for this class session.
                        </Text>

                    </View>


                    {/* =================================================
                        LOADING
                    ================================================== */}

                    {
                        loading && (

                            <View
                                style={
                                    styles.loadingCard
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
                                        styles.loadingText
                                    }
                                >
                                    Loading attendance...
                                </Text>

                            </View>

                        )
                    }


                    {/* =================================================
                        ERROR
                    ================================================== */}

                    {
                        !loading &&
                        error ? (

                            <View
                                style={
                                    styles.errorCard
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
                                    {error}
                                </Text>


                                <TouchableOpacity
                                    style={
                                        styles.retryButton
                                    }
                                    onPress={
                                        loadOverrideData
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

                        ) : null
                    }


                    {/* =================================================
                        OVERRIDE CONTENT
                    ================================================== */}

                    {
                        !loading &&
                        !error &&
                        details && (

                            <>


                                {/* =================================================
                                    STUDENT DETAILS
                                ================================================== */}

                                <View
                                    style={
                                        styles.detailsCard
                                    }
                                >

                                    <Text
                                        style={
                                            styles.sectionTitle
                                        }
                                    >
                                        Student Details
                                    </Text>


                                    <View
                                        style={
                                            styles.detailsRow
                                        }
                                    >


                                        {/* Student */}

                                        <View
                                            style={
                                                styles.detailSection
                                            }
                                        >

                                            <Text
                                                style={
                                                    styles.detailLabel
                                                }
                                            >
                                                Student
                                            </Text>


                                            <Text
                                                style={
                                                    styles.studentName
                                                }
                                            >
                                                {
                                                    details.student.student_name
                                                }
                                            </Text>


                                            <Text
                                                style={
                                                    styles.studentId
                                                }
                                            >
                                                ID: {
                                                    details.student.student_id
                                                }
                                            </Text>

                                        </View>


                                        <View
                                            style={
                                                styles.detailDivider
                                            }
                                        />


                                        {/* Course */}

                                        <View
                                            style={
                                                styles.detailSection
                                            }
                                        >

                                            <Text
                                                style={
                                                    styles.detailLabel
                                                }
                                            >
                                                Course
                                            </Text>


                                            <Text
                                                style={
                                                    styles.detailValue
                                                }
                                            >
                                                {
                                                    details.course.course_code
                                                }
                                                {" — "}
                                                {
                                                    details.course.course_name
                                                }
                                            </Text>

                                        </View>


                                        <View
                                            style={
                                                styles.detailDivider
                                            }
                                        />


                                        {/* Session Date */}

                                        <View
                                            style={
                                                styles.detailSection
                                            }
                                        >

                                            <Text
                                                style={
                                                    styles.detailLabel
                                                }
                                            >
                                                Session Date
                                            </Text>


                                            <Text
                                                style={
                                                    styles.detailValue
                                                }
                                            >
                                                {
                                                    formatDate(
                                                        details.session.session_date
                                                    )
                                                }
                                            </Text>

                                        </View>


                                        <View
                                            style={
                                                styles.detailDivider
                                            }
                                        />


                                        {/* Current Status */}

                                        <View
                                            style={
                                                styles.detailSection
                                            }
                                        >

                                            <Text
                                                style={
                                                    styles.detailLabel
                                                }
                                            >
                                                Current Status
                                            </Text>


                                            <View
                                                style={[
                                                    styles.statusBadge,

                                                    normalizeStatus(
                                                        details.attendance.status
                                                    ) === "present"
                                                        ? styles.presentBadge

                                                    : normalizeStatus(
                                                        details.attendance.status
                                                    ) === "late"
                                                        ? styles.lateBadge

                                                    : normalizeStatus(
                                                        details.attendance.status
                                                    ) === "excused"
                                                        ? styles.excusedBadge

                                                    : styles.absentBadge
                                                ]}
                                            >

                                                <Text
                                                    style={[
                                                        styles.statusBadgeText,

                                                        normalizeStatus(
                                                            details.attendance.status
                                                        ) === "present"
                                                            ? styles.presentText

                                                        : normalizeStatus(
                                                            details.attendance.status
                                                        ) === "late"
                                                            ? styles.lateText

                                                        : normalizeStatus(
                                                            details.attendance.status
                                                        ) === "excused"
                                                            ? styles.excusedText

                                                        : styles.absentText
                                                    ]}
                                                >
                                                    {
                                                        formatStatus(
                                                            details.attendance.status
                                                        )
                                                    }
                                                </Text>

                                            </View>

                                        </View>

                                    </View>

                                </View>


                                {/* =================================================
                                    LOWER CONTENT
                                ================================================== */}

                                <View
                                    style={
                                        styles.lowerLayout
                                    }
                                >


                                    {/* =================================================
                                        ATTENDANCE EVENTS
                                    ================================================== */}

                                    <View
                                        style={
                                            styles.eventsCard
                                        }
                                    >

                                        <Text
                                            style={
                                                styles.sectionTitle
                                            }
                                        >
                                            Attendance Events
                                        </Text>


                                        <Text
                                            style={
                                                styles.sectionSubtitle
                                            }
                                        >
                                            Biometric check-in/out events for this session.
                                        </Text>


                                        {/* Table Header */}

                                        <View
                                            style={
                                                styles.eventHeader
                                            }
                                        >

                                            <Text
                                                style={[
                                                    styles.eventHeaderText,
                                                    styles.eventTimeColumn
                                                ]}
                                            >
                                                TIME
                                            </Text>


                                            <Text
                                                style={[
                                                    styles.eventHeaderText,
                                                    styles.eventTypeColumn
                                                ]}
                                            >
                                                EVENT TYPE
                                            </Text>


                                            <Text
                                                style={[
                                                    styles.eventHeaderText,
                                                    styles.eventNotesColumn
                                                ]}
                                            >
                                                NOTES
                                            </Text>

                                        </View>


                                        {/* Events */}

                                        {
                                            details.events.length >
                                            0 ? (

                                                details.events.map(
                                                    (
                                                        event,
                                                        index
                                                    ) => (

                                                        <View
                                                            key={
                                                                `${event.event_time}-${index}`
                                                            }
                                                            style={
                                                                styles.eventRow
                                                            }
                                                        >

                                                            <Text
                                                                style={[
                                                                    styles.eventCellText,
                                                                    styles.eventTimeColumn
                                                                ]}
                                                            >
                                                                {
                                                                    formatTime(
                                                                        event.event_time
                                                                    )
                                                                }
                                                            </Text>


                                                            <Text
                                                                style={[
                                                                    styles.eventCellText,
                                                                    styles.eventTypeColumn
                                                                ]}
                                                            >
                                                                {
                                                                    event.event_type
                                                                }
                                                            </Text>


                                                            <Text
                                                                style={[
                                                                    styles.eventCellMuted,
                                                                    styles.eventNotesColumn
                                                                ]}
                                                            >
                                                                {
                                                                    event.event_type === "ENTER"
                                                                        ? "Entered classroom geofence"

                                                                    : event.event_type === "EXIT"
                                                                        ? "Exited classroom geofence"

                                                                    : event.event_type === "REENTER"
                                                                        ? "Re-entered classroom geofence"

                                                                    : "Attendance event"
                                                                }
                                                            </Text>

                                                        </View>

                                                    )
                                                )

                                            ) : (

                                                <View
                                                    style={
                                                        styles.emptyEvents
                                                    }
                                                >

                                                    <Ionicons
                                                        name="document-text-outline"
                                                        size={52}
                                                        color={
                                                            Colors.disabled
                                                        }
                                                    />


                                                    <Text
                                                        style={
                                                            styles.emptyEventsTitle
                                                        }
                                                    >
                                                        No attendance events
                                                    </Text>


                                                    <Text
                                                        style={
                                                            styles.emptyEventsText
                                                        }
                                                    >
                                                        There are no biometric events recorded for this student in this session.
                                                    </Text>

                                                </View>

                                            )
                                        }

                                    </View>


                                    {/* =================================================
                                        OVERRIDE ATTENDANCE
                                    ================================================== */}

                                    <View
                                        style={
                                            styles.overrideCard
                                        }
                                    >

                                        <Text
                                            style={
                                                styles.sectionTitle
                                            }
                                        >
                                            Override Attendance
                                        </Text>


                                        <Text
                                            style={
                                                styles.sectionSubtitle
                                            }
                                        >
                                            Set a new attendance status for this student.
                                        </Text>


                                        <Text
                                            style={
                                                styles.fieldLabel
                                            }
                                        >
                                            Attendance Status
                                        </Text>


                                        {/* Status Options */}

                                        <View
                                            style={
                                                styles.statusOptions
                                            }
                                        >

                                            {
                                                statusOptions.map(
                                                    (
                                                        option
                                                    ) => {

                                                        const selected =
                                                            selectedStatus ===
                                                            option.value;


                                                        return (

                                                            <TouchableOpacity
                                                                key={
                                                                    option.value
                                                                }
                                                                style={[
                                                                    styles.statusOption,

                                                                    selected &&
                                                                    styles.statusOptionSelected
                                                                ]}
                                                                onPress={() =>
                                                                    setSelectedStatus(
                                                                        option.value
                                                                    )
                                                                }
                                                            >

                                                                <View
                                                                    style={[
                                                                        styles.radioOuter,

                                                                        selected &&
                                                                        styles.radioOuterSelected
                                                                    ]}
                                                                >

                                                                    {
                                                                        selected && (

                                                                            <View
                                                                                style={
                                                                                    styles.radioInner
                                                                                }
                                                                            />

                                                                        )
                                                                    }

                                                                </View>


                                                                <View
                                                                    style={
                                                                        styles.statusOptionText
                                                                    }
                                                                >

                                                                    <Text
                                                                        style={[
                                                                            styles.statusOptionTitle,

                                                                            selected &&
                                                                            styles.statusOptionTitleSelected
                                                                        ]}
                                                                    >
                                                                        {
                                                                            option.title
                                                                        }
                                                                    </Text>


                                                                    <Text
                                                                        style={
                                                                            styles.statusOptionDescription
                                                                        }
                                                                    >
                                                                        {
                                                                            option.description
                                                                        }
                                                                    </Text>

                                                                </View>

                                                            </TouchableOpacity>

                                                        );

                                                    }
                                                )
                                            }

                                        </View>


                                        {/* =================================================
                                            NOTES
                                        ================================================== */}

                                        <Text
                                            style={
                                                styles.fieldLabel
                                            }
                                        >
                                            Reason / Notes
                                        </Text>


                                        <TextInput
                                            style={
                                                styles.notesInput
                                            }
                                            multiline
                                            maxLength={
                                                500
                                            }
                                            value={
                                                notes
                                            }
                                            onChangeText={
                                                setNotes
                                            }
                                            placeholder="Enter a reason or note for this override (optional)."
                                            placeholderTextColor={
                                                Colors.disabled
                                            }
                                            textAlignVertical="top"
                                        />


                                        <Text
                                            style={
                                                styles.characterCount
                                            }
                                        >
                                            {
                                                notes.length
                                            } / 500
                                        </Text>


                                        <Text
                                            style={
                                                styles.notesNotice
                                            }
                                        >
                                            Notes are not stored yet.
                                        </Text>


                                        {/* =================================================
                                            ACTION BUTTONS
                                        ================================================== */}

                                        <View
                                            style={
                                                styles.actionRow
                                            }
                                        >

                                            <TouchableOpacity
                                                style={[
                                                    styles.saveButton,

                                                    saving &&
                                                    styles.disabledButton
                                                ]}
                                                onPress={
                                                    saveOverride
                                                }
                                                disabled={
                                                    saving
                                                }
                                            >

                                                {
                                                    saving ? (

                                                        <ActivityIndicator
                                                            color={
                                                                Colors.surface
                                                            }
                                                        />

                                                    ) : (

                                                        <Text
                                                            style={
                                                                styles.saveButtonText
                                                            }
                                                        >
                                                            Save Override
                                                        </Text>

                                                    )
                                                }

                                            </TouchableOpacity>


                                            <TouchableOpacity
                                                style={
                                                    styles.cancelButton
                                                }
                                                onPress={() =>
                                                    router.replace(
                                                        "/dashboardInstructor"
                                                    )
                                                }
                                            >

                                                <Text
                                                    style={
                                                        styles.cancelButtonText
                                                    }
                                                >
                                                    Cancel
                                                </Text>

                                            </TouchableOpacity>

                                        </View>

                                    </View>

                                </View>


                                {/* =================================================
                                    FOOTER
                                ================================================== */}

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
                                        Biometric Attendance
                                    </Text>

                                </View>

                            </>

                        )
                    }

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

            paddingTop: 24,

            paddingBottom: 28
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

            fontWeight:
                "700"
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

            fontWeight:
                "700"
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

            fontWeight:
                "700"
        },


        // ============================================================
        // BACK LINK
        // ============================================================

        backLink: {
            flexDirection:
                "row",

            alignItems:
                "center",

            gap: 7,

            alignSelf:
                "flex-start",

            marginBottom: 18
        },


        backLinkText: {
            color:
                Colors.primary,

            fontSize: 14,

            fontWeight:
                "700"
        },


        // ============================================================
        // PAGE HEADING
        // ============================================================

        pageHeading: {
            marginBottom: 22
        },


        pageTitle: {
            color:
                Colors.textPrimary,

            fontSize: 36,

            lineHeight: 42,

            fontWeight:
                "800"
        },


        pageSubtitle: {
            color:
                Colors.textSecondary,

            fontSize: 20,

            fontWeight:
                "500",

            marginTop: 4
        },


        // ============================================================
        // SHARED
        // ============================================================

        sectionTitle: {
            color:
                Colors.textPrimary,

            fontSize: 20,

            fontWeight:
                "800"
        },


        sectionSubtitle: {
            color:
                Colors.textSecondary,

            fontSize: 14,

            marginTop: 4,

            marginBottom: 14
        },


        // ============================================================
        // STUDENT DETAILS
        // ============================================================

        detailsCard: {
            backgroundColor:
                Colors.surface,

            borderWidth: 1,

            borderColor:
                Colors.tableBorder,

            borderRadius:
                Radius.md,

            padding: 24,

            marginBottom: 18
        },


        detailsRow: {
            flexDirection:
                "row",

            alignItems:
                "stretch",

            marginTop: 18
        },


        detailSection: {
            flex: 1,

            justifyContent:
                "center",

            paddingHorizontal: 18
        },


        detailDivider: {
            width: 1,

            minHeight: 70,

            backgroundColor:
                Colors.tableBorder
        },


        detailLabel: {
            color:
                Colors.textSecondary,

            fontSize: 13,

            fontWeight:
                "700",

            marginBottom: 5
        },


        detailValue: {
            color:
                Colors.textPrimary,

            fontSize: 16,

            fontWeight:
                "700"
        },


        studentName: {
            color:
                Colors.textPrimary,

            fontSize: 18,

            fontWeight:
                "800"
        },


        studentId: {
            color:
                Colors.textSecondary,

            fontSize: 13,

            marginTop: 3
        },


        // ============================================================
        // STATUS BADGES
        // ============================================================

        statusBadge: {
            alignSelf:
                "flex-start",

            borderRadius:
                Radius.pill,

            paddingHorizontal: 16,

            paddingVertical: 7
        },


        statusBadgeText: {
            fontSize: 14,

            fontWeight:
                "700"
        },


        presentBadge: {
            backgroundColor:
                Colors.successSoft
        },


        lateBadge: {
            backgroundColor:
                Colors.warningSoft
        },


        absentBadge: {
            backgroundColor:
                Colors.dangerSoft
        },


        excusedBadge: {
            backgroundColor:
                Colors.featureIconBackground
        },


        presentText: {
            color:
                Colors.success
        },


        lateText: {
            color:
                Colors.warning
        },


        absentText: {
            color:
                Colors.danger
        },


        excusedText: {
            color:
                Colors.primary
        },


        // ============================================================
        // LOWER LAYOUT
        // ============================================================

        lowerLayout: {
            flexDirection:
                "row",

            alignItems:
                "stretch",

            gap: 18
        },


        // ============================================================
        // ATTENDANCE EVENTS
        // ============================================================

        eventsCard: {
            flex: 1.55,

            minHeight: 430,

            backgroundColor:
                Colors.surface,

            borderWidth: 1,

            borderColor:
                Colors.tableBorder,

            borderRadius:
                Radius.md,

            padding: 24
        },


        eventHeader: {
            minHeight: 46,

            flexDirection:
                "row",

            alignItems:
                "center",

            backgroundColor:
                Colors.tableHeader,

            borderWidth: 1,

            borderColor:
                Colors.tableBorder
        },


        eventHeaderText: {
            color:
                Colors.textSecondary,

            fontSize: 12,

            fontWeight:
                "800",

            paddingHorizontal: 14
        },


        eventRow: {
            minHeight: 52,

            flexDirection:
                "row",

            alignItems:
                "center",

            borderLeftWidth: 1,

            borderRightWidth: 1,

            borderBottomWidth: 1,

            borderColor:
                Colors.tableBorder
        },


        eventCellText: {
            color:
                Colors.textPrimary,

            fontSize: 13,

            paddingHorizontal: 14
        },


        eventCellMuted: {
            color:
                Colors.textSecondary,

            fontSize: 13,

            paddingHorizontal: 14
        },


        eventTimeColumn: {
            flex: 1
        },


        eventTypeColumn: {
            flex: 1.2
        },


        eventNotesColumn: {
            flex: 1.6
        },


        emptyEvents: {
            flex: 1,

            minHeight: 300,

            alignItems:
                "center",

            justifyContent:
                "center",

            paddingHorizontal: 40
        },


        emptyEventsTitle: {
            color:
                Colors.textPrimary,

            fontSize: 18,

            fontWeight:
                "800",

            marginTop: 14
        },


        emptyEventsText: {
            color:
                Colors.textSecondary,

            fontSize: 14,

            lineHeight: 20,

            textAlign:
                "center",

            maxWidth: 420,

            marginTop: 6
        },


        // ============================================================
        // OVERRIDE CARD
        // ============================================================

        overrideCard: {
            flex: 1,

            backgroundColor:
                Colors.surface,

            borderWidth: 1,

            borderColor:
                Colors.tableBorder,

            borderRadius:
                Radius.md,

            padding: 24
        },


        fieldLabel: {
            color:
                Colors.textPrimary,

            fontSize: 14,

            fontWeight:
                "800",

            marginTop: 10,

            marginBottom: 8
        },


        // ============================================================
        // STATUS OPTIONS
        // ============================================================

        statusOptions: {
            gap: 8
        },


        statusOption: {
            minHeight: 56,

            borderWidth: 1,

            borderColor:
                Colors.borderLight,

            borderRadius:
                Radius.sm,

            flexDirection:
                "row",

            alignItems:
                "center",

            paddingHorizontal: 14,

            paddingVertical: 8
        },


        statusOptionSelected: {
            borderWidth: 2,

            borderColor:
                Colors.primary
        },


        radioOuter: {
            width: 20,

            height: 20,

            borderRadius:
                Radius.pill,

            borderWidth: 2,

            borderColor:
                Colors.disabled,

            alignItems:
                "center",

            justifyContent:
                "center",

            marginRight: 13
        },


        radioOuterSelected: {
            borderColor:
                Colors.primary
        },


        radioInner: {
            width: 9,

            height: 9,

            borderRadius:
                Radius.pill,

            backgroundColor:
                Colors.primary
        },


        statusOptionText: {
            flex: 1
        },


        statusOptionTitle: {
            color:
                Colors.textPrimary,

            fontSize: 14,

            fontWeight:
                "700"
        },


        statusOptionTitleSelected: {
            color:
                Colors.primary
        },


        statusOptionDescription: {
            color:
                Colors.textSecondary,

            fontSize: 12,

            marginTop: 2
        },


        // ============================================================
        // NOTES
        // ============================================================

        notesInput: {
            minHeight: 88,

            backgroundColor:
                Colors.surface,

            borderWidth: 1,

            borderColor:
                Colors.border,

            borderRadius:
                Radius.sm,

            paddingHorizontal: 12,

            paddingVertical: 10,

            color:
                Colors.textPrimary,

            fontSize: 13
        },


        characterCount: {
            alignSelf:
                "flex-end",

            color:
                Colors.disabled,

            fontSize: 11,

            marginTop: 4
        },


        notesNotice: {
            color:
                Colors.textSecondary,

            fontSize: 11,

            fontStyle:
                "italic",

            marginTop: 2
        },


        // ============================================================
        // ACTION BUTTONS
        // ============================================================

        actionRow: {
            flexDirection:
                "row",

            gap: 12,

            marginTop: 18
        },


        saveButton: {
            flex: 1.7,

            minHeight: 46,

            backgroundColor:
                Colors.primary,

            borderRadius:
                Radius.sm,

            alignItems:
                "center",

            justifyContent:
                "center"
        },


        saveButtonText: {
            color:
                Colors.surface,

            fontSize: 14,

            fontWeight:
                "800"
        },


        cancelButton: {
            flex: 1,

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
                "center"
        },


        cancelButtonText: {
            color:
                Colors.primary,

            fontSize: 14,

            fontWeight:
                "800"
        },


        disabledButton: {
            opacity: 0.55
        },


        // ============================================================
        // LOADING / ERROR
        // ============================================================

        loadingCard: {
            minHeight: 260,

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
                "center"
        },


        loadingText: {
            color:
                Colors.textSecondary,

            fontSize: 14,

            marginTop: 12
        },


        errorCard: {
            minHeight: 260,

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

            padding: 30
        },


        errorText: {
            color:
                Colors.danger,

            fontSize: 15,

            textAlign:
                "center",

            marginTop: 10
        },


        retryButton: {
            minWidth: 120,

            minHeight: 42,

            backgroundColor:
                Colors.primary,

            borderRadius:
                Radius.sm,

            alignItems:
                "center",

            justifyContent:
                "center",

            marginTop: 18
        },


        retryButtonText: {
            color:
                Colors.surface,

            fontSize: 14,

            fontWeight:
                "800"
        },


        // ============================================================
        // FOOTER
        // ============================================================

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
                Colors.tableBorder
        },


        footerText: {
            color:
                Colors.textSecondary,

            fontSize: 12
        },


        footerDot: {
            color:
                Colors.textSecondary,

            fontSize: 12
        }

    });
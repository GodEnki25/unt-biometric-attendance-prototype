
import React, { useCallback, useEffect, useState } from "react";

import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
    Platform,
    Alert,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE } from "../constants/api";
import { Colors, Spacing, Radius } from "../constants/theme";


// ============================================================
// TYPES
// ============================================================

type User = {
    user_id: number;
    full_name: string;
    role: string;
    is_active: number;
};

type Course = {
    course_id: number;
    course_code: string;
    course_name: string;
    instructor_id: number | null;
    instructor_name: string | null;
    is_active: number;
    student_count: number;
};


// ============================================================
// SCREEN
// ============================================================

export default function AdminCoursesScreen() {

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const mobile = width < 700;

    const [courses, setCourses] = useState<Course[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selected, setSelected] = useState<Course | null>(null);
    const [enrolled, setEnrolled] = useState<number[]>([]);

    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [editing, setEditing] = useState(false);

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");


    // ============================================================
    // API
    // ============================================================

    const request = useCallback(async (
        path: string,
        options: RequestInit = {}
    ) => {

        const token = Platform.OS === "web"
            ? localStorage.getItem("access_token")
            : null;

        if (!token) {
            router.replace("/adminlogin");
            throw new Error("Admin login required.");
        }

        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        if (response.status === 401) {
            router.replace("/adminlogin");
            throw new Error("Session expired. Sign in again.");
        }

        if (response.status === 403) {
            throw new Error("Administrator permission required.");
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                typeof data.detail === "string"
                    ? data.detail
                    : "Request failed."
            );
        }

        return data;

    }, [router]);


    // ============================================================
    // LOAD DATA
    // ============================================================

    const load = useCallback(async () => {

        setLoading(true);

        try {
            const [courseData, userData] = await Promise.all([
                request("/admin/courses"),
                request("/admin/users"),
            ]);

            setCourses(courseData.courses);
            setUsers(userData.users);

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load courses."
            );
        } finally {
            setLoading(false);
        }

    }, [request]);


    useEffect(() => {
        void load();
    }, [load]);


    const loadEnrollment = async (courseId: number) => {
        const data = await request(
            `/admin/courses/${courseId}/students`
        );

        setEnrolled(
            data.students.map((student: User) => student.user_id)
        );
    };


    // ============================================================
    // COURSE SELECTION
    // ============================================================

    const selectCourse = async (course: Course) => {
        setSelected(course);
        setCode(course.course_code);
        setName(course.course_name);
        setEditing(true);
        setError("");
        setMessage("");

        try {
            await loadEnrollment(course.course_id);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load enrollments."
            );
        }
    };


    const newCourse = () => {
        setSelected(null);
        setCode("");
        setName("");
        setEnrolled([]);
        setEditing(true);
        setError("");
        setMessage("");
    };


    // ============================================================
    // SAVE COURSE
    // ============================================================

    const saveCourse = async () => {

        if (!code.trim() || !name.trim()) {
            setError("Course code and name are required.");
            return;
        }

        setBusy(true);
        setError("");

        try {
            if (selected) {

                await request(
                    `/admin/courses/${selected.course_id}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            course_code: code.trim(),
                            course_name: name.trim(),
                        }),
                    }
                );

                setMessage("Course updated.");

            } else {

                await request("/admin/courses", {
                    method: "POST",
                    body: JSON.stringify({
                        course_code: code.trim(),
                        course_name: name.trim(),
                    }),
                });

                setMessage("Course created.");
            }

            setEditing(false);
            setSelected(null);
            await load();

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to save course."
            );
        } finally {
            setBusy(false);
        }
    };


    // ============================================================
    // ARCHIVE / RESTORE
    // ============================================================

    const toggleCourse = async (course: Course) => {

        const operation = async () => {
            setBusy(true);
            setError("");

            try {
                if (course.is_active) {
                    await request(
                        `/admin/courses/${course.course_id}`,
                        { method: "DELETE" }
                    );
                } else {
                    await request(
                        `/admin/courses/${course.course_id}`,
                        {
                            method: "PATCH",
                            body: JSON.stringify({ is_active: true }),
                        }
                    );
                }

                setMessage(
                    course.is_active
                        ? "Course archived."
                        : "Course restored."
                );

                setSelected(null);
                setEditing(false);
                await load();

            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to update course."
                );
            } finally {
                setBusy(false);
            }
        };

        if (!course.is_active) {
            void operation();
            return;
        }

        if (Platform.OS === "web") {
            if (window.confirm(`Archive ${course.course_code}?`)) {
                void operation();
            }
        } else {
            Alert.alert(
                "Archive Course",
                `Archive ${course.course_code}?`,
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Archive",
                        style: "destructive",
                        onPress: () => { void operation(); },
                    },
                ]
            );
        }
    };


    // ============================================================
    // ASSIGN INSTRUCTOR
    // ============================================================

    const assignInstructor = async (instructorId: number | null) => {
        if (!selected || busy) return;

        setBusy(true);
        setError("");

        try {
            await request(
                `/admin/courses/${selected.course_id}/instructor`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        instructor_id: instructorId,
                    }),
                }
            );

            setMessage("Instructor assignment updated.");
            await load();

            setSelected(previous =>
                previous
                    ? { ...previous, instructor_id: instructorId }
                    : previous
            );

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to assign instructor."
            );
        } finally {
            setBusy(false);
        }
    };


    // ============================================================
    // ENROLL / UNENROLL
    // ============================================================

    const toggleStudent = async (studentId: number) => {
        if (!selected || busy) return;

        const courseId = selected.course_id;
        const isEnrolled = enrolled.includes(studentId);

        setBusy(true);
        setError("");

        try {
            await request(
                `/admin/courses/${courseId}/enrollments${
                    isEnrolled ? `/${studentId}` : ""
                }`,
                isEnrolled
                    ? { method: "DELETE" }
                    : {
                        method: "POST",
                        body: JSON.stringify({ student_id: studentId }),
                    }
            );

            await loadEnrollment(courseId);
            await load();

            setMessage(
                isEnrolled
                    ? "Student removed from course."
                    : "Student enrolled."
            );

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Enrollment update failed."
            );
        } finally {
            setBusy(false);
        }
    };


    const activeStudents = users.filter(
        user => user.role === "student" && user.is_active
    );

    const activeInstructors = users.filter(
        user => user.role === "instructor" && user.is_active
    );


    // ============================================================
    // RENDER
    // ============================================================

    return (
        <View
            style={[
                styles.safe,
                {
                    paddingTop: insets.top,
                    paddingBottom: insets.bottom,
                },
            ]}
        >

            <View
                style={[
                    styles.header,
                    mobile && { paddingHorizontal: Spacing.md },
                ]}
            >
                <View style={styles.brand}>
                    <Image
                        source={require("../assets/logo.png")}
                        style={styles.logo}
                        resizeMode="contain"
                    />

                    <View style={styles.brandDivider} />

                    <Text style={styles.brandText}>
                        Attendance
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => router.replace("/adminDashboard")}
                    style={styles.back}
                >
                    <Ionicons
                        name="arrow-back-outline"
                        size={20}
                        color={Colors.primary}
                    />

                    {!mobile && (
                        <Text style={styles.greenText}>
                            Admin Dashboard
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    mobile && { paddingHorizontal: Spacing.md },
                ]}
            >

                <Text style={styles.title}>
                    Course Management
                </Text>

                <Text style={styles.subtitle}>
                    Manage courses, instructors, and student enrollment.
                </Text>

                {!!error && (
                    <View style={styles.errorBox}>
                        <Text style={{ color: Colors.danger }}>
                            {error}
                        </Text>
                    </View>
                )}

                {!!message && (
                    <View style={styles.successBox}>
                        <Text style={{ color: Colors.success }}>
                            {message}
                        </Text>
                    </View>
                )}

                <View style={styles.card}>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={newCourse}
                    >
                        <Ionicons
                            name="add-outline"
                            size={20}
                            color={Colors.surface}
                        />
                        <Text style={styles.buttonText}>
                            Add Course
                        </Text>
                    </TouchableOpacity>

                    {loading && (
                        <ActivityIndicator
                            size="large"
                            color={Colors.primary}
                            style={{ margin: Spacing.lg }}
                        />
                    )}

                    {editing && (
                        <View style={styles.form}>

                            <Text style={styles.sectionTitle}>
                                {selected ? "Manage Course" : "New Course"}
                            </Text>

                            <Text style={styles.label}>Course Code</Text>

                            <TextInput
                                style={styles.input}
                                value={code}
                                onChangeText={setCode}
                                placeholder="CSCE 4901"
                            />

                            <Text style={styles.label}>Course Name</Text>

                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Capstone"
                            />

                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={styles.outlineButton}
                                    onPress={() => setEditing(false)}
                                >
                                    <Text style={styles.greenText}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={saveCourse}
                                    disabled={busy}
                                >
                                    <Text style={styles.buttonText}>
                                        Save Course
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {selected && selected.is_active === 1 && (
                                <>
                                    <Text style={styles.sectionTitle}>
                                        Assigned Instructor
                                    </Text>

                                    <TouchableOpacity
                                        style={styles.option}
                                        onPress={() => assignInstructor(null)}
                                        disabled={busy}
                                    >
                                        <Text style={styles.itemName}>
                                            Unassigned
                                        </Text>

                                        {selected.instructor_id === null && (
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={22}
                                                color={Colors.primary}
                                            />
                                        )}
                                    </TouchableOpacity>

                                    {activeInstructors.map(user => (
                                        <TouchableOpacity
                                            key={user.user_id}
                                            style={styles.option}
                                            onPress={() =>
                                                assignInstructor(user.user_id)
                                            }
                                            disabled={busy}
                                        >
                                            <Text style={styles.itemName}>
                                                {user.full_name}
                                            </Text>

                                            {selected.instructor_id ===
                                                user.user_id && (
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={22}
                                                    color={Colors.primary}
                                                />
                                            )}
                                        </TouchableOpacity>
                                    ))}

                                    <Text style={styles.sectionTitle}>
                                        Student Enrollment
                                    </Text>

                                    {activeStudents.map(student => (
                                        <TouchableOpacity
                                            key={student.user_id}
                                            style={styles.option}
                                            onPress={() =>
                                                toggleStudent(student.user_id)
                                            }
                                            disabled={busy}
                                        >
                                            <Text style={styles.itemName}>
                                                {student.full_name}
                                            </Text>

                                            <Ionicons
                                                name={
                                                    enrolled.includes(student.user_id)
                                                        ? "checkbox"
                                                        : "square-outline"
                                                }
                                                size={22}
                                                color={Colors.primary}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}

                        </View>
                    )}

                    <Text style={styles.sectionTitle}>
                        Courses
                    </Text>

                    {courses.map(course => (
                        <View
                            key={course.course_id}
                            style={[
                                styles.courseRow,
                                mobile && { flexDirection: "column" },
                            ]}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemName}>
                                    {course.course_code}
                                </Text>

                                <Text style={styles.detail}>
                                    {course.course_name}
                                </Text>

                                <Text style={styles.detail}>
                                    Instructor: {course.instructor_name || "Unassigned"}
                                </Text>

                                <Text style={styles.detail}>
                                    {course.student_count} active students
                                </Text>

                                {!course.is_active && (
                                    <Text style={{ color: Colors.danger }}>
                                        ARCHIVED
                                    </Text>
                                )}
                            </View>

                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={styles.outlineButton}
                                    onPress={() => selectCourse(course)}
                                    disabled={busy}
                                >
                                    <Text style={styles.greenText}>
                                        Manage
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.outlineButton}
                                    onPress={() => toggleCourse(course)}
                                    disabled={busy}
                                >
                                    <Text
                                        style={{
                                            color: course.is_active
                                                ? Colors.danger
                                                : Colors.primary,
                                        }}
                                    >
                                        {course.is_active
                                            ? "Archive"
                                            : "Restore"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                </View>
            </ScrollView>
        </View>
    );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

    safe: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    header: {
        minHeight: 86,
        backgroundColor: Colors.surface,
        borderTopWidth: 10,
        borderTopColor: Colors.primary,
        borderBottomWidth: 1,
        borderBottomColor: Colors.tableBorder,
        paddingHorizontal: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    brand: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
    },

    logo: {
        width: 72,
        height: 72,
    },

    brandDivider: {
        width: 2,
        height: 32,
        backgroundColor: Colors.border,
    },

    brandText: {
        color: Colors.textPrimary,
        fontSize: 22,
        fontWeight: "700",
    },

    back: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },

    greenText: {
        color: Colors.primary,
        fontWeight: "600",
    },

    content: {
        padding: Spacing.xl,
        paddingHorizontal: 48,
        paddingBottom: 80,
        maxWidth: 1400,
        width: "100%",
        alignSelf: "center",
    },

    title: {
        fontSize: 32,
        fontWeight: "800",
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },

    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginBottom: Spacing.xl,
    },

    card: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginVertical: Spacing.lg,
    },

    form: {
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        marginTop: Spacing.lg,
    },

    label: {
        color: Colors.textPrimary,
        fontWeight: "600",
        marginBottom: Spacing.sm,
    },

    input: {
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
        borderRadius: Radius.md,
        minHeight: 46,
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        color: Colors.textPrimary,
    },

    primaryButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: Radius.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.sm,
        alignSelf: "flex-start",
    },

    buttonText: {
        color: Colors.surface,
        fontWeight: "700",
    },

    outlineButton: {
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        alignItems: "center",
        justifyContent: "center",
    },

    actions: {
        flexDirection: "row",
        gap: Spacing.sm,
        flexWrap: "wrap",
        alignItems: "center",
        marginTop: Spacing.md,
    },

    courseRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.tableBorder,
    },

    option: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.tableBorder,
    },

    itemName: {
        color: Colors.textPrimary,
        fontWeight: "700",
        fontSize: 15,
    },

    detail: {
        color: Colors.textSecondary,
        fontSize: 13,
        marginTop: Spacing.xs,
    },

    errorBox: {
        backgroundColor: Colors.dangerSoft,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
    },

    successBox: {
        backgroundColor: Colors.successSoft,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
    },

});

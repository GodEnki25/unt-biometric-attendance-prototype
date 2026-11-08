
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE } from "../constants/api";
import { Colors, Radius, Spacing } from "../constants/theme";


// ============================================================
// TYPES
// ============================================================

type UserRole = "student" | "instructor" | "admin";

type AdminUser = {
    user_id: number;
    full_name: string;
    email: string;
    role: UserRole;
    student_id: string | null;
    created_at: string;
    is_active: number;
    is_root_admin: number;
};

type UserForm = {
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    student_id: string;
};

const EMPTY_FORM: UserForm = {
    full_name: "",
    email: "",
    password: "",
    role: "student",
    student_id: "",
};


// ============================================================
// SCREEN
// ============================================================

export default function AdminUsersScreen() {

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    const isMobile = width < 700;
    const [actionBusy, setActionBusy] = useState<number | null>(null);

    const [users, setUsers] = useState<AdminUser[]>([]);
    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] =
        useState<AdminUser | null>(null);

    const [form, setForm] = useState<UserForm>(EMPTY_FORM);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [currentAdmin, setCurrentAdmin] = useState<{
        user_id: number;
        is_root_admin: boolean;
    } | null>(null);


    // ============================================================
    // AUTHENTICATION
    // ============================================================

    const getToken = () => {
        if (Platform.OS !== "web") {
            return null;
        }

        return localStorage.getItem("access_token");
    };


    // ============================================================
    // API REQUEST HELPER
    // ============================================================

    const adminRequest = useCallback(async (
        path: string,
        options: RequestInit = {}
    ) => {

        const token = getToken();

        if (!token) {
            router.replace("/adminlogin");
            throw new Error("Authentication required.");
        }

        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...options.headers,
            },
        });

        if (response.status === 401) {
            if (Platform.OS === "web") {
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");
            }

            router.replace("/adminlogin");

            throw new Error("Your session expired. Please sign in.");
        }

        const data = await response.json();

        if (response.status === 403) {
            throw new Error(
                typeof data.detail === "string"
                    ? data.detail
                    : "You do not have permission to perform this action."
            );
        }

        if (!response.ok) {
            const detail = data.detail;

            throw new Error(
                typeof detail === "string"
                    ? detail
                    : "The requested operation failed."
            );
        }

        return data;

    }, [router]);


    // ============================================================
    // LOAD USERS
    // ============================================================

    const loadUsers = useCallback(async () => {

        setLoading(true);

        try {
            const [data, profile] = await Promise.all([
                adminRequest("/admin/users"),
                adminRequest("/admin/me"),
            ]);

            setUsers(data.users ?? []);
            setCurrentAdmin(profile);
        }

        catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load users."
            );
        }

        finally {
            setLoading(false);
        }

    }, [adminRequest]);


    useEffect(() => {
        loadUsers();
    }, [loadUsers]);


    // ============================================================
    // SEARCH
    // ============================================================

    const filteredUsers = useMemo(() => {

        const query = search.trim().toLowerCase();

        if (!query) {
            return users;
        }

        return users.filter(user =>
            user.full_name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            (user.student_id ?? "").toLowerCase().includes(query)
        );

    }, [users, search]);


    // ============================================================
    // FORM HELPERS
    // ============================================================

    const updateField = (
        field: keyof UserForm,
        value: string
    ) => {

        setForm(previous => ({
            ...previous,
            [field]: value,
        }));

    };


    const openCreateForm = () => {

        if (!currentAdmin) {
            setError("Administrator permissions have not loaded yet.");
            return;
        }
        setEditingUser(null);
        setForm({ ...EMPTY_FORM });

        setError("");
        setMessage("");
        setShowForm(true);

    };


    const openEditForm = (user: AdminUser) => {

        if (!currentAdmin || user.is_root_admin ||
            (user.role === "admin" && !currentAdmin.is_root_admin)) {
            setError("Root administrator privileges required.");
            return;
        }

        setEditingUser(user);

        setForm({
            full_name: user.full_name,
            email: user.email,
            password: "",
            role: user.role,
            student_id: user.student_id ?? "",
        });

        setError("");
        setMessage("");
        setShowForm(true);

    };


    const closeForm = () => {

        setShowForm(false);
        setEditingUser(null);
        setForm({ ...EMPTY_FORM });
        setError("");

    };


    // ============================================================
    // SAVE USER
    // ============================================================

    const handleSave = async () => {
        if (!currentAdmin) {
            setError("Administrator permissions have not loaded yet.");
            return;
        }
        if (!currentAdmin.is_root_admin && form.role === "admin") {
            setError("Only root can manage administrator accounts.");
            return;
        }
        const full_name = form.full_name.trim();
        const email = form.email.trim().toLowerCase();
        const student_id = form.student_id.trim();

        if (!full_name || !email) {
            setError("Name and email are required.");
            return;
        }

        if (
            form.role === "student" &&
            !student_id
        ) {
            setError("Student ID is required.");
            return;
        }

        if (!editingUser && form.password.length < 8) {
            setError("Password must contain at least 8 characters.");
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");

        try {

            if (editingUser) {

                await adminRequest(
                    `/admin/users/${editingUser.user_id}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            full_name,
                            email,
                            role: form.role,
                            student_id:
                                form.role === "student"
                                    ? student_id
                                    : null,
                        }),
                    }
                );

                setMessage("User updated successfully.");

            } else {

                await adminRequest("/admin/users", {
                    method: "POST",
                    body: JSON.stringify({
                        full_name,
                        email,
                        password: form.password,
                        role: form.role,
                        student_id:
                            form.role === "student"
                                ? student_id
                                : null,
                    }),
                });

                setMessage("User created successfully.");
            }

            setShowForm(false);
            setEditingUser(null);
            setForm({ ...EMPTY_FORM });

            await loadUsers();

        }

        catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to save user."
            );
        }

        finally {
            setSaving(false);
        }

    };


    // ============================================================
    // REMOVE / RESTORE USER
    // ============================================================

    const canManageUser = (user: AdminUser) =>
        Boolean(currentAdmin) &&
        !user.is_root_admin &&
        (user.role !== "admin" || Boolean(currentAdmin?.is_root_admin));

    const changeUserStatus = async (user: AdminUser, restore: boolean) => {
        if (!canManageUser(user)) {
            setError("You do not have permission to manage this account.");
            return;
        }

        setActionBusy(user.user_id);
        setError("");
        setMessage("");

        try {
            if (restore) {
                await adminRequest(`/admin/users/${user.user_id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ is_active: true }),
                });
            } else {
                await adminRequest(`/admin/users/${user.user_id}`, {
                    method: "DELETE",
                });
            }
            await loadUsers();
            setMessage(restore
                ? `${user.full_name} has been restored.`
                : `${user.full_name} has been deactivated.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to update account.");
        } finally {
            setActionBusy(null);
        }
    };

    const handleRemoveUser = (user: AdminUser) => {
        if (!canManageUser(user)) {
            setError("Root administrator privileges required.");
            return;
        }

        const message = `Deactivate ${user.full_name}? Their attendance history will be preserved.`;
        if (Platform.OS === "web") {
            if (window.confirm(message)) void changeUserStatus(user, false);
            return;
        }
        Alert.alert("Deactivate User", message, [
            { text: "Cancel", style: "cancel" },
            { text: "Deactivate", style: "destructive",
              onPress: () => { void changeUserStatus(user, false); } },
        ]);
    };


    // ============================================================
    // UI
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

            {/* HEADER */}

            <View
                style={[
                    styles.topHeader,
                    isMobile && styles.mobileHeader,
                ]}
            >
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

                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.replace("/adminDashboard")}
                >
                    <Ionicons
                        name="arrow-back-outline"
                        size={20}
                        color={Colors.primary}
                    />

                    {!isMobile && (
                        <Text style={styles.backText}>
                            Admin Dashboard
                        </Text>
                    )}
                </TouchableOpacity>
            </View>


            <ScrollView
                contentContainerStyle={[
                    styles.pageContent,
                    isMobile && styles.mobileContent,
                ]}
                keyboardShouldPersistTaps="handled"
            >

                {/* PAGE TITLE */}

                <Text style={styles.pageTitle}>
                    User Management
                </Text>

                <Text style={styles.subtitle}>
                    Manage student, instructor, and administrator accounts.
                </Text>


                {/* SUCCESS MESSAGE */}

                {!!message && (
                    <View style={styles.successBox}>
                        <Text style={styles.successText}>
                            {message}
                        </Text>
                    </View>
                )}


                {/* ERROR MESSAGE */}

                {!!error && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>
                            {error}
                        </Text>
                    </View>
                )}


                {/* USER MANAGEMENT CARD */}

                <View style={styles.card}>

                    <View
                        style={[
                            styles.toolbar,
                            isMobile && styles.mobileToolbar,
                        ]}
                    >

                        <View style={styles.searchBox}>

                            <Ionicons
                                name="search-outline"
                                size={20}
                                color={Colors.textSecondary}
                            />

                            <TextInput
                                placeholder="Search users..."
                                placeholderTextColor={Colors.disabled}
                                style={styles.searchInput}
                                value={search}
                                onChangeText={setSearch}
                                autoCapitalize="none"
                            />

                        </View>

                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={openCreateForm}
                            disabled={!currentAdmin || saving}
                        >
                            <Ionicons
                                name="add-outline"
                                size={20}
                                color={Colors.surface}
                            />

                            <Text style={styles.primaryButtonText}>
                                Add User
                            </Text>
                        </TouchableOpacity>

                    </View>


                    {/* USER FORM */}

                    {showForm && (

                        <View style={styles.formCard}>

                            <Text style={styles.formTitle}>
                                {editingUser
                                    ? "Edit User"
                                    : "Create New User"}
                            </Text>

                            <Text style={styles.inputLabel}>
                                Full Name
                            </Text>

                            <TextInput
                                style={styles.input}
                                value={form.full_name}
                                onChangeText={value =>
                                    updateField("full_name", value)
                                }
                                placeholder="Full name"
                            />

                            <Text style={styles.inputLabel}>
                                Email
                            </Text>

                            <TextInput
                                style={styles.input}
                                value={form.email}
                                onChangeText={value =>
                                    updateField("email", value)
                                }
                                placeholder="Email address"
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />

                            {!editingUser && (
                                <>
                                    <Text style={styles.inputLabel}>
                                        Password
                                    </Text>
                                    <TextInput
                                        style={styles.input}
                                        value={form.password}
                                        onChangeText={value => updateField("password", value)}
                                        placeholder="Minimum 8 characters"
                                        secureTextEntry
                                    />
                                </>
                            )}

                            <Text style={styles.inputLabel}>Role</Text>
                            <View style={styles.roleRow}>
                                {(
                                    currentAdmin?.is_root_admin
                                        ? (["student", "instructor", "admin"] as const)
                                        : (["student", "instructor"] as const)
                                ).map(role => (
                                    <TouchableOpacity
                                        key={role}
                                        style={[
                                            styles.roleButton,
                                            form.role === role && styles.selectedRole,
                                        ]}
                                        onPress={() => updateField("role", role)}
                                        disabled={saving}
                                    >
                                        <Text style={[
                                            styles.roleText,
                                            form.role === role && styles.selectedRoleText,
                                        ]}>
                                            {role === "student" ? "Student" :
                                             role === "instructor" ? "Instructor" : "Admin"}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {form.role === "student" && (

                                <>
                                    <Text style={styles.inputLabel}>
                                        Student ID
                                    </Text>

                                    <TextInput
                                        style={styles.input}
                                        value={form.student_id}
                                        onChangeText={value =>
                                            updateField("student_id", value)
                                        }
                                        placeholder="Student ID"
                                    />
                                </>
                            )}

                            <View style={styles.formActions}>

                                <TouchableOpacity
                                    style={styles.outlineButton}
                                    onPress={closeForm}
                                    disabled={saving}
                                >
                                    <Text style={styles.outlineButtonText}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.primaryButton,
                                        saving && styles.disabledButton,
                                    ]}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>
                                            {editingUser
                                                ? "Save Changes"
                                                : "Create User"}
                                        </Text>
                                    )}
                                </TouchableOpacity>

                            </View>

                        </View>
                    )}


                    {/* USER LIST */}

                    {loading ? (

                        <ActivityIndicator
                            size="large"
                            color={Colors.primary}
                            style={styles.loading}
                        />

                    ) : (

                        <>
                            <Text style={styles.resultsText}>
                                {filteredUsers.length} users found
                            </Text>

                            {filteredUsers.length === 0 && (
                                <Text style={styles.emptyText}>
                                    No users found.
                                </Text>
                            )}

                            {filteredUsers.map(user => (

                                <View
                                    key={user.user_id}
                                    style={[
                                        styles.userRow,
                                        isMobile && styles.mobileUserRow,
                                    ]}
                                >

                                    <View style={styles.userInfo}>

                                        <Text style={styles.userName}>
                                            {user.full_name}
                                        </Text>

                                        <Text style={styles.userEmail}>
                                            {user.email}
                                        </Text>

                                        <Text style={styles.userDetail}>
                                            {user.role.toUpperCase()}
                                            {user.student_id
                                                ? `  •  ${user.student_id}`
                                                : ""}
                                        </Text>
                                        {!user.is_active && (
                                            <Text style={styles.inactiveText}>INACTIVE</Text>
                                        )}
                                    </View>

                                    {user.is_root_admin ? (
                                        <Text style={styles.protectedText}>
                                            ROOT ADMIN • PROTECTED
                                        </Text>
                                    ) : !canManageUser(user) ? (
                                        <Text style={styles.protectedText}>
                                            ROOT ACCESS REQUIRED
                                        </Text>
                                    ) : (
                                        <View style={styles.userActions}>
                                            <TouchableOpacity
                                                style={styles.editButton}
                                                onPress={() => openEditForm(user)}
                                                disabled={actionBusy !== null || saving}
                                            >
                                                <Ionicons
                                                    name="create-outline"
                                                    size={17}
                                                    color={Colors.primary}
                                                />
                                                <Text style={styles.editText}>Edit</Text>
                                            </TouchableOpacity>

                                            {user.is_active ? (
                                                <TouchableOpacity
                                                    style={[styles.editButton, styles.removeButton]}
                                                    onPress={() => handleRemoveUser(user)}
                                                    disabled={actionBusy !== null || saving}
                                                >
                                                    {actionBusy === user.user_id ? (
                                                        <ActivityIndicator color={Colors.danger} />
                                                    ) : (
                                                        <Ionicons name="person-remove-outline"
                                                            size={17} color={Colors.danger} />
                                                    )}
                                                    <Text style={styles.removeText}>Remove</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    style={styles.editButton}
                                                    onPress={() => void changeUserStatus(user, true)}
                                                    disabled={actionBusy !== null || saving}
                                                >
                                                    {actionBusy === user.user_id ? (
                                                        <ActivityIndicator color={Colors.primary} />
                                                    ) : (
                                                        <Ionicons name="refresh-outline"
                                                            size={17} color={Colors.primary} />
                                                    )}
                                                    <Text style={styles.editText}>Restore</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}

                                </View>

                            ))}

                        </>
                    )}

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

    topHeader: {
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

    mobileHeader: {
        paddingHorizontal: Spacing.md,
    },

    brandBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
    },

    logoBox: {
        width: 72,
        height: 72,
    },

    brandDivider: {
        width: 2,
        height: 32,
        backgroundColor: Colors.border,
    },

    brandText: {
        fontSize: 22,
        fontWeight: "700",
        color: Colors.textPrimary,
    },

    backButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },

    backText: {
        color: Colors.primary,
        fontWeight: "600",
        fontSize: 15,
    },

    pageContent: {
        padding: Spacing.xl,
        paddingHorizontal: 48,
        paddingBottom: 80,
        maxWidth: 1400,
        width: "100%",
        alignSelf: "center",
    },

    mobileContent: {
        paddingHorizontal: Spacing.md,
    },

    pageTitle: {
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

    toolbar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },

    mobileToolbar: {
        flexDirection: "column",
        alignItems: "stretch",
    },

    searchBox: {
        flex: 1,
        minHeight: 46,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
    },

    searchInput: {
        flex: 1,
        color: Colors.textPrimary,
        fontSize: 15,
        paddingVertical: Spacing.sm,
    },

    primaryButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        minHeight: 46,
        borderRadius: Radius.md,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: Spacing.sm,
    },

    primaryButtonText: {
        color: Colors.surface,
        fontWeight: "700",
        fontSize: 14,
    },

    disabledButton: {
        opacity: 0.6,
    },

    resultsText: {
        color: Colors.textSecondary,
        fontSize: 13,
        marginBottom: Spacing.md,
    },

    userRow: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.tableBorder,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: Spacing.md,
    },

    mobileUserRow: {
        alignItems: "flex-start",
    },

    userInfo: {
        flex: 1,
    },

    userName: {
        fontSize: 16,
        fontWeight: "700",
        color: Colors.textPrimary,
    },

    userEmail: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: 4,
    },

    userDetail: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: "600",
        marginTop: Spacing.sm,
    },

    userActions: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: Spacing.sm,
    },

    protectedText: {
        color: Colors.textSecondary,
        fontWeight: "600",
        fontSize: 12,
    },

    inactiveText: {
        color: Colors.danger,
        fontWeight: "700",
        fontSize: 12,
        marginTop: Spacing.xs,
    },

    removeButton: {
        borderColor: Colors.danger,
    },

    removeText: {
        color: Colors.danger,
        fontWeight: "600",
    },

    editButton: {
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: Radius.md,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: 6,
    },

    editText: {
        color: Colors.primary,
        fontWeight: "600",
    },

    formCard: {
        backgroundColor: Colors.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },

    formTitle: {
        fontSize: 21,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: Spacing.lg,
    },

    inputLabel: {
        fontWeight: "600",
        fontSize: 14,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },

    input: {
        minHeight: 46,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.surface,
        color: Colors.textPrimary,
        fontSize: 15,
        marginBottom: Spacing.md,
    },

    roleRow: {
        flexDirection: "row",
        gap: Spacing.sm,
        marginBottom: Spacing.md,
        flexWrap: "wrap",
    },

    roleButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        backgroundColor: Colors.surface,
    },

    selectedRole: {
        borderColor: Colors.primary,
        backgroundColor: Colors.featureIconBackground,
    },

    roleText: {
        color: Colors.textSecondary,
        fontWeight: "600",
    },

    selectedRoleText: {
        color: Colors.primaryDark,
    },

    formActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: Spacing.md,
        marginTop: Spacing.md,
        flexWrap: "wrap",
    },

    outlineButton: {
        minHeight: 46,
        paddingHorizontal: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: Radius.md,
        alignItems: "center",
        justifyContent: "center",
    },

    outlineButtonText: {
        color: Colors.primary,
        fontWeight: "600",
    },

    successBox: {
        backgroundColor: Colors.successSoft,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
    },

    successText: {
        color: Colors.success,
        fontWeight: "600",
    },

    errorBox: {
        backgroundColor: Colors.dangerSoft,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
    },

    errorText: {
        color: Colors.danger,
        fontWeight: "600",
    },

    loading: {
        marginVertical: Spacing.xl,
    },

    emptyText: {
        color: Colors.textSecondary,
        textAlign: "center",
        padding: Spacing.xl,
    },

});

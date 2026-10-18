import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing } from "../constants/theme";
import { useEffect, useState } from "react";
import { API_BASE } from "@/constants/api";
import Svg, { Circle } from "react-native-svg";

// ============================================================
// ATTENDANCE PERCENTAGE RING
// ============================================================

function AttendanceRing({
  percentage,
}: {
  percentage: number;
}) {
  const size = 92;
  const strokeWidth = 10;

  const radius =
    (size - strokeWidth) / 2;

  const circumference =
    2 * Math.PI * radius;

  const safePercentage =
    Math.min(
      Math.max(percentage, 0),
      100
    );

  const strokeDashoffset =
    circumference -
    (safePercentage / 100) *
      circumference;

  return (
    <View
      style={[
        styles.percentageRingContainer,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <Svg
        width={size}
        height={size}
        style={
          styles.percentageRingSvg
        }
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={
            Colors.borderLight
          }
          strokeWidth={
            strokeWidth
          }
          fill="none"
        />

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={
            Colors.primary
          }
          strokeWidth={
            strokeWidth
          }
          fill="none"
          strokeLinecap="round"
          strokeDasharray={[
            circumference,
            circumference
          ]}
          strokeDashoffset={
            strokeDashoffset
          }
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      <View
        style={
          styles.percentageRingText
        }
      >
        <Text
          style={
            styles.percentageValue
          }
        >
          {safePercentage}%
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();

  const { userId } = useLocalSearchParams();

  // ============================================================
  // DASHBOARD STATE
  // ============================================================

  const [courses, setCourses] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [studentName, setStudentName] = useState("Student");

  // ============================================================
  // LOAD STUDENT INFO
  // ============================================================

  useEffect(() => {
    loadStudent();
  }, []);

  async function loadStudent() {
    const storedUser =
      await SecureStore.getItemAsync("user");

    if (!storedUser) {
      return;
    }

    const user = JSON.parse(storedUser);

    setStudentName(
      user.name || "Student"
    );
  }

  // ============================================================
  // LOAD / REFRESH STUDENT COURSES
  // ============================================================

  useEffect(() => {
    loadClasses();

    const interval = setInterval(() => {
      loadClasses();
    }, 5000);

    return () =>
      clearInterval(interval);
  }, []);

  async function loadClasses() {
    const token =
      await SecureStore.getItemAsync(
        "access_token"
      );

    if (!token) {
      return;
    }

    const res = await fetch(
      `${API_BASE}/courses/student`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      return;
    }

    const data = await res.json();

    setCourses(
      data.courses || []
    );

    setActiveSession(
      data.active_session || null
    );

    setSelectedCourseId(
      (currentId) => {
        if (currentId !== null) {
          return currentId;
        }

        if (data.active_session) {
          return (
            data.active_session.course_id
          );
        }

        if (
          data.courses?.length > 0
        ) {
          return (
            data.courses[0].course_id
          );
        }

        return null;
      }
    );
  }

  // ============================================================
  // SELECTED COURSE
  // ============================================================

  const selectedCourse =
    courses.find(
      (course) =>
        course.course_id ===
        selectedCourseId
    ) || null;

  const selectedCourseIsActive =
    activeSession?.course_id ===
    selectedCourseId;

  // ============================================================
  // COURSE DATA AND PERCENTAGE
  // ============================================================
  const [attendanceSummary, setAttendanceSummary] = useState({
    present: 0,
    late: 0,
    absent: 0,
    percentage: 0,
  });

  useEffect(() => {
    if (selectedCourse === null) {
      return;
    }

    loadAttendanceSummary();
  }, [selectedCourseId]);

  async function loadAttendanceSummary() {
    const token = 
      await SecureStore.getItemAsync("access_token");

    if(!token || selectedCourseId === null) {
      return;
    }

    const res = await fetch(`${API_BASE}/courses/student/${selectedCourseId}/attendance-summary`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
    }
  );

  if (!res.ok) {
    return;
  }

  const data = await res.json();

  setAttendanceSummary({
    present: data.present || 0,
    late: data.late || 0,
    absent: data.absent || 0,
    percentage: data.percentage || 0,
  });  
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  function openCheckIn() {
    router.push({
      pathname: "/checkIn",

      params: {
        userId:
          userId?.toString(),
      },
    });
  }

  function openAttendanceHistory() {
    router.push(
      "/attendanceHistory"
    );
  }

  return (
    <View style={styles.container}>

      {/* =====================================================
          HEADER
      ====================================================== */}

      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.headerSide}
        >
          <Ionicons
            name="chevron-back"
            size={30}
            color={Colors.surface}
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
        >
          Student Dashboard
        </Text>

        <View
          style={styles.headerSide}
        >
          <Image
            source={require(
              "../assets/logo.png"
            )}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* =====================================================
          DASHBOARD CONTENT
      ====================================================== */}

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* =====================================================
            STUDENT INFO
        ====================================================== */}

        <View style={styles.card}>
          <View
            style={
              styles.studentInfoLayout
            }
          >

            <View
              style={
                styles.studentInfoSection
              }
            >

              <Text
                style={
                  styles.cardTitle
                }
              >
                Student Info
              </Text>

              {/* Name */}

              <View
                style={
                  styles.studentInfoRow
                }
              >
                <Ionicons
                  name="person-outline"
                  size={26}
                  color={
                    Colors.textPrimary
                  }
                />

                <View
                  style={
                    styles.studentInfoTextLine
                  }
                >
                  <Text
                    style={
                      styles.studentInfoLabel
                    }
                  >
                    Name:
                  </Text>

                  <Text
                    style={
                      styles.studentInfoValue
                    }
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={
                      0.82
                    }
                  >
                    {studentName}
                  </Text>
                </View>
              </View>

              {/* Status */}

              <View
                style={
                  styles.studentInfoRow
                }
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={27}
                  color={
                    Colors.primary
                  }
                />

                <View
                  style={
                    styles.studentInfoTextLine
                  }
                >
                  <Text
                    style={
                      styles.studentInfoLabel
                    }
                  >
                    Status:
                  </Text>

                  <Text
                    style={
                      styles.activeText
                    }
                  >
                    Active
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}

            <View
              style={
                styles.studentInfoDivider
              }
            />

            {/* Check In Button */}

            <View
              style={
                styles.checkInSection
              }
            >
              <Pressable
                style={
                  styles.checkInButton
                }
                onPress={openCheckIn}
              >
                <Ionicons
                  name="camera-outline"
                  size={23}
                  color={
                    Colors.surface
                  }
                />

                <Text
                  style={
                    styles.checkInButtonText
                  }
                >
                  Check In
                </Text>
              </Pressable>
            </View>

          </View>
        </View>

        {/* =====================================================
            CURRENT / UPCOMING CLASS
        ====================================================== */}

        <View style={styles.card}>

          <Text
            style={styles.cardTitle}
          >
            Current / Upcoming Class
          </Text>

          {/* Selected Course */}

          <View
            style={
              styles.classHeaderRow
            }
          >
            <Text
              style={styles.className}
            >
              {selectedCourse
                ? `${selectedCourse.course_code} - ${selectedCourse.course_name}`
                : "No course selected"}
            </Text>

            <View
              style={
                styles.upcomingBadge
              }
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={Colors.primary}
              />

              <Text
                style={
                  styles.upcomingBadgeText
                }
              >
                {selectedCourseIsActive
                  ? "Active"
                  : "Upcoming"}
              </Text>
            </View>
          </View>

          {/* Room */}

          <View
            style={
              styles.classInfoRow
            }
          >
            <Ionicons
              name="location-outline"
              size={24}
              color={
                Colors.textPrimary
              }
            />

            <Text
              style={
                styles.classInfoText
              }
            >
              Room 266
            </Text>
          </View>

          {/* Session Time */}

          <View
            style={
              styles.classInfoRow
            }
          >
            <Ionicons
              name="time-outline"
              size={24}
              color={
                Colors.textPrimary
              }
            />

            <Text
              style={
                styles.classInfoText
              }
            >
              Today • 6:30 PM - 9:20 PM
            </Text>
          </View>

          <View
            style={
              styles.classDivider
            }
          />

          {/* =====================================================
              COURSE TABS
          ====================================================== */}

          <View
            style={
              styles.courseTabs
            }
          >
            {courses.map(
              (course) => (
                <Pressable
                  key={
                    course.course_id
                  }
                  onPress={() =>
                    setSelectedCourseId(
                      course.course_id
                    )
                  }
                  style={
                    selectedCourseId ===
                    course.course_id
                      ? styles.courseTabActive
                      : styles.courseTab
                  }
                >
                  <Text
                    style={
                      selectedCourseId ===
                      course.course_id
                        ? styles.courseTabActiveText
                        : styles.courseTabText
                    }
                  >
                    {
                      course.course_code
                    }
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </View>

        {/* =====================================================
            ATTENDANCE SUMMARY
        ====================================================== */}

        <View style={styles.card}>

          <Text
            style={styles.cardTitle}
          >
            Attendance Summary
          </Text>

          <Text
            style={
              styles.cardSubtitle
            }
          >
            This semester
          </Text>

          <View
            style={
              styles.summaryLayout
            }
          >

            {/* Summary Stats */}

            <View
              style={
                styles.summaryStats
              }
            >

              {/* Present */}

              <View
                style={
                  styles.summaryItem
                }
              >
                <View
                  style={[
                    styles.summaryIconBox,
                    styles.presentIconBox,
                  ]}
                >
                  <Ionicons
                    name="checkmark"
                    size={27}
                    color={
                      Colors.success
                    }
                  />
                </View>

                <Text
                  style={
                    styles.summaryNumber
                  }
                >
                  {attendanceSummary.present}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Present
                </Text>
              </View>

              {/* Late */}

              <View
                style={
                  styles.summaryItem
                }
              >
                <View
                  style={[
                    styles.summaryIconBox,
                    styles.lateIconBox,
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={27}
                    color={
                      Colors.warning
                    }
                  />
                </View>

                <Text
                  style={
                    styles.summaryNumber
                  }
                >
                  {attendanceSummary.late}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Late
                </Text>
              </View>

              {/* Absent */}

              <View
                style={
                  styles.summaryItem
                }
              >
                <View
                  style={[
                    styles.summaryIconBox,
                    styles.absentIconBox,
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={27}
                    color={
                      Colors.danger
                    }
                  />
                </View>

                <Text
                  style={
                    styles.summaryNumber
                  }
                >
                  {attendanceSummary.absent}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Absent
                </Text>
              </View>
            </View>

            {/* Divider */}

            <View
              style={
                styles.summaryDivider
              }
            />

            {/* Attendance Percentage */}

            <View
              style={
                styles.percentageSection
              }
            >
              <AttendanceRing
                percentage={
                  attendanceSummary.percentage
                }
              />

              <Text
                style={
                  styles.percentageLabel
                }
              >
                Attendance
              </Text>
            </View>
          </View>
        </View>

        {/* =====================================================
            ATTENDANCE HISTORY
        ====================================================== */}

        <Pressable
          style={
            styles.historyCard
          }
          onPress={
            openAttendanceHistory
          }
        >
          <View
            style={
              styles.historyIconCircle
            }
          >
            <Ionicons
              name="time-outline"
              size={29}
              color={
                Colors.primary
              }
            />
          </View>

          <Text
            style={
              styles.historyText
            }
          >
            Attendance History
          </Text>

          <Ionicons
            name="chevron-forward"
            size={28}
            color={
              Colors.textSecondary
            }
          />
        </Pressable>

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
    backgroundColor:
      Colors.background,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: Spacing.lg,
    gap: 14,
  },

  // ============================================================
  // HEADER
  // ============================================================

  header: {
    minHeight: 108,
    backgroundColor:
      Colors.primary,
    paddingHorizontal: 14,
    paddingTop: 30,
    flexDirection: "row",
    alignItems: "center",
  },

  headerSide: {
    width: 62,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    color: Colors.surface,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },

  headerLogo: {
    width: 58,
    height: 58,
  },

  // ============================================================
  // SHARED CARD
  // ============================================================

  card: {
    width: "100%",
    backgroundColor:
      Colors.surface,
    borderWidth: 1,
    borderColor:
      Colors.borderLight,
    borderRadius:
      Radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },

  cardTitle: {
    color:
      Colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },

  cardSubtitle: {
    color:
      Colors.textSecondary,
    fontSize: 15,
    marginTop: 3,
    marginBottom: 16,
  },

  // ============================================================
  // STUDENT INFO
  // ============================================================

  studentInfoLayout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  studentInfoSection: {
    flex: 1,
    minWidth: 0,
  },

  studentInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 12,
  },

  studentInfoTextLine: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  studentInfoLabel: {
    color:
      Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 0,
  },

  studentInfoValue: {
    color:
      Colors.textPrimary,
    fontSize: 16,
    flex: 1,
    flexShrink: 1,
  },

  activeText: {
    color:
      Colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },

  studentInfoDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor:
      Colors.borderLight,
    marginLeft: 18,
    marginRight: 20,
  },

  checkInSection: {
    width: 124,
    alignItems: "center",
    justifyContent: "center",
  },

  checkInButton: {
    width: "100%",
    minHeight: 46,
    backgroundColor:
      Colors.primary,
    borderRadius:
      Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },

  checkInButtonText: {
    color:
      Colors.surface,
    fontSize: 16,
    fontWeight: "800",
  },

  // ============================================================
  // CURRENT / UPCOMING CLASS
  // ============================================================

  classHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 12,
    marginTop: 16,
    marginBottom: 14,
  },

  className: {
    flex: 1,
    color:
      Colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },

  upcomingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor:
      Colors.successSoft,
    borderRadius:
      Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  upcomingBadgeText: {
    color:
      Colors.success,
    fontSize: 14,
    fontWeight: "700",
  },

  classInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 10,
  },

  classInfoText: {
    color:
      Colors.textPrimary,
    fontSize: 16,
  },

  classDivider: {
    height: 1,
    backgroundColor:
      Colors.borderLight,
    marginTop: 6,
    marginBottom: 14,
  },

  courseTabs: {
    flexDirection: "row",
    gap: 10,
  },

  courseTabActive: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1.5,
    borderColor:
      Colors.primary,
    borderRadius:
      Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      Colors.surface,
  },

  courseTabActiveText: {
    color:
      Colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },

  courseTab: {
    flex: 1,
    minHeight: 46,
    borderRadius:
      Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      Colors.background,
  },

  courseTabText: {
    color:
      Colors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },

  // ============================================================
  // ATTENDANCE SUMMARY
  // ============================================================

  summaryLayout: {
    flexDirection: "row",
    alignItems: "center",
  },

  summaryStats: {
    flex: 1,
    flexDirection: "row",
    justifyContent:
      "space-between",
    gap: 12,
  },

  summaryItem: {
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  summaryIconBox: {
    width: 58,
    height: 50,
    borderRadius:
      Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },

  presentIconBox: {
    backgroundColor:
      Colors.successSoft,
  },

  lateIconBox: {
    backgroundColor:
      Colors.warningSoft,
  },

  absentIconBox: {
    backgroundColor:
      Colors.dangerSoft,
  },

  summaryNumber: {
    color:
      Colors.textPrimary,
    fontSize: 21,
    fontWeight: "800",
  },

  summaryLabel: {
    color:
      Colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },

  summaryDivider: {
    width: 1,
    height: 108,
    backgroundColor:
      Colors.borderLight,
    marginLeft: 18,
    marginRight: 16,
  },

  // ============================================================
  // ATTENDANCE PERCENTAGE
  // ============================================================

  percentageSection: {
    width: 100,
    alignItems: "center",
  },

  percentageRingContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },

  percentageRingSvg: {
    position: "absolute",
    top: 0,
    left: 0,
  },

  percentageRingText: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  percentageValue: {
    color:
      Colors.textPrimary,
    fontSize: 23,
    fontWeight: "800",
  },

  percentageLabel: {
    color:
      Colors.textSecondary,
    fontSize: 14,
    marginTop: 6,
  },

  // ============================================================
  // ATTENDANCE HISTORY
  // ============================================================

  historyCard: {
    minHeight: 78,
    backgroundColor:
      Colors.surface,
    borderWidth: 1,
    borderColor:
      Colors.borderLight,
    borderRadius:
      Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },

  historyIconCircle: {
    width: 46,
    height: 46,
    borderRadius:
      Radius.pill,
    borderWidth: 2,
    borderColor:
      Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  historyText: {
    flex: 1,
    color:
      Colors.textPrimary,
    fontSize: 19,
    fontWeight: "600",
    marginLeft: 14,
  },
});
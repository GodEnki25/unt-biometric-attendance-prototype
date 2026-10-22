import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { Colors, Radius } from "../constants/theme";
import { useEffect, useState } from "react";
import { API_BASE } from "@/constants/api";

// ============================================================
// TYPES
// ============================================================

type Course = {
  course_id: number;
  course_code: string;
  course_name: string;
};

type AttendanceRecord = {
  session_id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  check_in_time: string | null;
  exit_time: string | null;
  face_verified: boolean;
  location_verified: boolean;
};

type AttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  percentage: number;
};

// ============================================================
// ATTENDANCE RING
// ============================================================

function AttendanceRing({
  percentage,
}: {
  percentage: number;
}) {
  const size = 116;
  const strokeWidth = 12;

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
        styles.ringContainer,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <Svg
        width={size}
        height={size}
        style={styles.ringSvg}
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
            circumference,
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
          styles.ringTextContainer
        }
      >
        <Text
          style={
            styles.ringPercentage
          }
        >
          {safePercentage}%
        </Text>

        <Text
          style={styles.ringLabel}
        >
          Overall
        </Text>

        <Text
          style={styles.ringLabel}
        >
          Attendance
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// SCREEN
// ============================================================

export default function AttendanceHistoryScreen() {
  const router = useRouter();

  // ============================================================
  // SCREEN STATE
  // ============================================================

  const [courses, setCourses] =
    useState<Course[]>([]);

  const [
    selectedCourseId,
    setSelectedCourseId,
  ] =
    useState<number | null>(
      null
    );

  const [
    attendanceRecords,
    setAttendanceRecords,
  ] =
    useState<
      AttendanceRecord[]
    >([]);

  const [
    attendanceSummary,
    setAttendanceSummary,
  ] =
    useState<AttendanceSummary>({
      present: 0,
      late: 0,
      absent: 0,
      percentage: 0,
    });

  const [
    filterOpen,
    setFilterOpen,
  ] =
    useState(false);

  const [
    expandedSessionId,
    setExpandedSessionId,
  ] =
    useState<number | null>(
      null
    );

  // ============================================================
  // SELECTED COURSE
  // ============================================================

  const selectedCourse =
    courses.find(
      (course) =>
        course.course_id ===
        selectedCourseId
    ) || null;

  const selectedCourseLabel =
    selectedCourse
      ? selectedCourse.course_code
      : "All Classes";

  // ============================================================
  // LOAD STUDENT COURSES
  // ============================================================

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    const token =
      await SecureStore.getItemAsync(
        "access_token"
      );

    if (!token) {
      return;
    }

    try {
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

      const data =
        await res.json();

      setCourses(
        data.courses || []
      );
    } catch (error) {
      console.error(
        "Failed to load courses:",
        error
      );
    }
  }

  // ============================================================
  // LOAD ATTENDANCE HISTORY
  // ============================================================

  useEffect(() => {
    loadAttendanceHistory();
  }, [selectedCourseId]);

  async function loadAttendanceHistory() {
    const token =
      await SecureStore.getItemAsync(
        "access_token"
      );

    if (!token) {
      return;
    }

    try {
      let url =
        `${API_BASE}/courses/student/attendance-history`;

      if (
        selectedCourseId !==
        null
      ) {
        url +=
          `?course_id=${selectedCourseId}`;
      }

      const res =
        await fetch(
          url,
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

      const data =
        await res.json();

      setAttendanceRecords(
        data.records || []
      );

      setAttendanceSummary({
        present:
          data.summary?.present ||
          0,

        late:
          data.summary?.late ||
          0,

        absent:
          data.summary?.absent ||
          0,

        percentage:
          data.summary
            ?.percentage || 0,
      });

      setExpandedSessionId(
        null
      );

    } catch (error) {
      console.error(
        "Failed to load attendance history:",
        error
      );
    }
  }

  // ============================================================
  // COURSE FILTER
  // ============================================================

  function selectCourse(
    courseId: number | null
  ) {
    setSelectedCourseId(
      courseId
    );

    setFilterOpen(false);
  }

  function toggleFilter() {
    setFilterOpen(
      (current) =>
        !current
    );
  }

  // ============================================================
  // RECORD DETAILS
  // ============================================================

  function toggleRecord(
    sessionId: number
  ) {
    setExpandedSessionId(
      (current) =>
        current === sessionId
          ? null
          : sessionId
    );
  }

  // ============================================================
  // FORMAT DATE
  // ============================================================

  function formatDate(
    dateValue: string
  ) {
    if (!dateValue) {
      return "---";
    }

    const date =
      new Date(
        `${dateValue}T12:00:00`
      );

    return date.toLocaleDateString(
      "en-US",
      {
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
      }
    );
  }

  // ============================================================
  // FORMAT TIME
  // ============================================================

  function formatTime(
    timeValue:
      | string
      | null
  ) {
    if (!timeValue) {
      return "---";
    }

    const timePart =
      timeValue.includes(" ")
        ? timeValue.split(" ")[1]
        : timeValue;

    const date =
      new Date(
        `2000-01-01T${timePart}`
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return timeValue;
    }

    return date.toLocaleTimeString(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // ============================================================
  // FORMAT STATUS
  // ============================================================

  function formatStatus(
    status: string
  ) {
    if (!status) {
      return "Absent";
    }

    return (
      status
        .charAt(0)
        .toUpperCase() +
      status
        .slice(1)
        .toLowerCase()
    );
  }

  return (
    <View
      style={
        styles.container
      }
    >

      {/* =====================================================
          HEADER
      ====================================================== */}

      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.headerSide
          }
        >
          <Ionicons
            name="chevron-back"
            size={34}
            color={
              Colors.surface
            }
          />
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          Attendance History
        </Text>

        <View
          style={
            styles.headerSide
          }
        >
          <Image
            source={require(
              "../assets/logo.png"
            )}
            style={
              styles.headerLogo
            }
            resizeMode="contain"
          />
        </View>
      </View>

      {/* =====================================================
          CONTENT
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
            ATTENDANCE OVERVIEW
        ====================================================== */}

        <View
          style={styles.card}
        >
          <View
            style={
              styles.overviewHeaderRow
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Attendance Overview
            </Text>

            <Pressable
              style={
                styles.overviewFilter
              }
              onPress={
                toggleFilter
              }
            >
              <Text
                style={
                  styles.overviewFilterText
                }
              >
                {
                  selectedCourseLabel
                }
              </Text>

              <Ionicons
                name={
                  filterOpen
                    ? "chevron-up"
                    : "chevron-down"
                }
                size={23}
                color={
                  Colors.textSecondary
                }
              />
            </Pressable>
          </View>

          <View
            style={
              styles.overviewLayout
            }
          >
            <View
              style={
                styles.overviewRingSection
              }
            >
              <AttendanceRing
                percentage={
                  attendanceSummary.percentage
                }
              />
            </View>

            <View
              style={
                styles.overviewDivider
              }
            />

            <View
              style={
                styles.overviewStats
              }
            >

              {/* Present */}

              <View
                style={
                  styles.overviewStatItem
                }
              >
                <View
                  style={[
                    styles.statIconBox,
                    styles.presentIconBox,
                  ]}
                >
                  <View
                    style={[
                      styles.statIconCircle,
                      styles.presentIconCircle,
                    ]}
                  >
                    <Ionicons
                      name="checkmark"
                      size={24}
                      color={
                        Colors.surface
                      }
                    />
                  </View>
                </View>

                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {
                    attendanceSummary.present
                  }
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Present
                </Text>
              </View>

              {/* Late */}

              <View
                style={
                  styles.overviewStatItem
                }
              >
                <View
                  style={[
                    styles.statIconBox,
                    styles.lateIconBox,
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={32}
                    color={
                      Colors.warning
                    }
                  />
                </View>

                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {
                    attendanceSummary.late
                  }
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Late
                </Text>
              </View>

              {/* Absent */}

              <View
                style={
                  styles.overviewStatItem
                }
              >
                <View
                  style={[
                    styles.statIconBox,
                    styles.absentIconBox,
                  ]}
                >
                  <View
                    style={[
                      styles.statIconCircle,
                      styles.absentIconCircle,
                    ]}
                  >
                    <Ionicons
                      name="close"
                      size={26}
                      color={
                        Colors.danger
                      }
                    />
                  </View>
                </View>

                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {
                    attendanceSummary.absent
                  }
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Absent
                </Text>
              </View>

            </View>
          </View>
        </View>

        {/* =====================================================
            COURSE FILTER
        ====================================================== */}

        <View
          style={styles.card}
        >
          <Text
            style={
              styles.filterLabel
            }
          >
            Course
          </Text>

          <Pressable
            style={
              styles.courseSelect
            }
            onPress={
              toggleFilter
            }
          >
            <Ionicons
              name="book-outline"
              size={29}
              color={
                Colors.textSecondary
              }
            />

            <Text
              style={
                styles.courseSelectText
              }
            >
              {
                selectedCourse
                  ? `${selectedCourse.course_code} - ${selectedCourse.course_name}`
                  : "All Classes"
              }
            </Text>

            <Ionicons
              name={
                filterOpen
                  ? "chevron-up"
                  : "chevron-down"
              }
              size={24}
              color={
                Colors.textSecondary
              }
            />
          </Pressable>

          {/* =====================================================
              COURSE DROPDOWN
          ====================================================== */}

          {filterOpen && (
            <View
              style={
                styles.courseDropdown
              }
            >
              <Pressable
                style={
                  styles.dropdownItem
                }
                onPress={() =>
                  selectCourse(
                    null
                  )
                }
              >
                <Text
                  style={
                    selectedCourseId ===
                    null
                      ? styles.dropdownItemActiveText
                      : styles.dropdownItemText
                  }
                >
                  All Classes
                </Text>
              </Pressable>

              {courses.map(
                (course) => (
                  <Pressable
                    key={
                      course.course_id
                    }
                    style={
                      styles.dropdownItem
                    }
                    onPress={() =>
                      selectCourse(
                        course.course_id
                      )
                    }
                  >
                    <Text
                      style={
                        selectedCourseId ===
                        course.course_id
                          ? styles.dropdownItemActiveText
                          : styles.dropdownItemText
                      }
                    >
                      {
                        course.course_code
                      }
                      {" - "}
                      {
                        course.course_name
                      }
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          )}

          {/* =====================================================
              COURSE TABS
          ====================================================== */}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.courseTabs
            }
          >
            <Pressable
              onPress={() =>
                selectCourse(null)
              }
              style={
                selectedCourseId ===
                null
                  ? styles.courseTabActive
                  : styles.courseTab
              }
            >
              <Text
                style={
                  selectedCourseId ===
                  null
                    ? styles.courseTabActiveText
                    : styles.courseTabText
                }
              >
                All Classes
              </Text>
            </Pressable>

            {courses.map(
              (course) => (
                <Pressable
                  key={
                    course.course_id
                  }
                  onPress={() =>
                    selectCourse(
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
          </ScrollView>
        </View>

        {/* =====================================================
            ATTENDANCE RECORDS HEADER
        ====================================================== */}

        <View
          style={
            styles.recordsHeader
          }
        >
          <Text
            style={
              styles.recordsTitle
            }
          >
            Attendance Records
          </Text>

          <Text
            style={
              styles.recordsCount
            }
          >
            {
              attendanceRecords.length
            }{" "}
            {
              attendanceRecords.length ===
              1
                ? "record"
                : "records"
            }
          </Text>
        </View>

        {/* =====================================================
            ATTENDANCE RECORDS
        ====================================================== */}

        <View
          style={
            styles.recordsList
          }
        >
          {attendanceRecords.length ===
          0 ? (
            <View
              style={
                styles.emptyRecordsCard
              }
            >
              <Ionicons
                name="calendar-outline"
                size={34}
                color={
                  Colors.textSecondary
                }
              />

              <Text
                style={
                  styles.emptyRecordsText
                }
              >
                No attendance records
                found.
              </Text>
            </View>
          ) : (
            attendanceRecords.map(
              (item) => {
                const formattedStatus =
                  formatStatus(
                    item.status
                  );

                const isPresent =
                  formattedStatus ===
                  "Present";

                const isLate =
                  formattedStatus ===
                  "Late";

                const isAbsent =
                  formattedStatus ===
                  "Absent";

                const isExpanded =
                  expandedSessionId ===
                  item.session_id;

                return (
                  <Pressable
                    key={
                      item.session_id
                    }
                    style={
                      styles.recordCard
                    }
                    onPress={() =>
                      toggleRecord(
                        item.session_id
                      )
                    }
                  >
                    <View
                      style={
                        styles.recordTopRow
                      }
                    >
                      <View
                        style={
                          styles.recordTitleArea
                        }
                      >
                        <Text
                          style={
                            styles.recordCourse
                          }
                        >
                          {
                            item.course_code
                          }
                          {" - "}
                          {
                            item.course_name
                          }
                        </Text>

                        <Text
                          style={
                            styles.recordDate
                          }
                        >
                          {formatDate(
                            item.session_date
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.recordStatusArea
                        }
                      >
                        <View
                          style={[
                            styles.statusBadge,

                            isPresent &&
                              styles.statusPresent,

                            isLate &&
                              styles.statusLate,

                            isAbsent &&
                              styles.statusAbsent,
                          ]}
                        >
                          <Ionicons
                            name={
                              isPresent
                                ? "checkmark-circle"
                                : isLate
                                ? "time-outline"
                                : "close-circle"
                            }
                            size={24}
                            color={
                              isPresent
                                ? Colors.success
                                : isLate
                                ? Colors.warning
                                : Colors.danger
                            }
                          />

                          <Text
                            style={[
                              styles.statusText,

                              isPresent &&
                                styles.statusPresentText,

                              isLate &&
                                styles.statusLateText,

                              isAbsent &&
                                styles.statusAbsentText,
                            ]}
                          >
                            {
                              formattedStatus
                            }
                          </Text>
                        </View>

                        <Ionicons
                          name={
                            isExpanded
                              ? "chevron-down"
                              : "chevron-forward"
                          }
                          size={27}
                          color={
                            Colors.textSecondary
                          }
                        />
                      </View>
                    </View>

                    <View
                      style={
                        styles.recordDivider
                      }
                    />

                    <View
                      style={
                        styles.recordTimes
                      }
                    >

                      {/* Entry */}

                      <View
                        style={
                          styles.timeSection
                        }
                      >
                        <Ionicons
                          name="enter-outline"
                          size={31}
                          color={
                            isAbsent
                              ? Colors.disabled
                              : Colors.success
                          }
                        />

                        <View>
                          <Text
                            style={
                              styles.timeLabel
                            }
                          >
                            Entry
                          </Text>

                          <Text
                            style={
                              styles.timeValue
                            }
                          >
                            {formatTime(
                              item.check_in_time
                            )}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.timeDivider
                        }
                      />

                      {/* Exit */}

                      <View
                        style={
                          styles.timeSection
                        }
                      >
                        <Ionicons
                          name="exit-outline"
                          size={31}
                          color={
                            isAbsent
                              ? Colors.disabled
                              : Colors.danger
                          }
                        />

                        <View>
                          <Text
                            style={
                              styles.timeLabel
                            }
                          >
                            Exit
                          </Text>

                          <Text
                            style={
                              styles.timeValue
                            }
                          >
                            {formatTime(
                              item.exit_time
                            )}
                          </Text>
                        </View>
                      </View>

                    </View>

                    {/* =====================================================
                        EXPANDED RECORD DETAILS
                    ====================================================== */}

                    {isExpanded && (
                      <View
                        style={
                          styles.recordDetails
                        }
                      >
                        <View
                          style={
                            styles.detailRow
                          }
                        >
                          <Ionicons
                            name="scan-outline"
                            size={20}
                            color={
                              item.face_verified
                                ? Colors.success
                                : Colors.textSecondary
                            }
                          />

                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Face verification
                          </Text>

                          <Text
                            style={
                              item.face_verified
                                ? styles.detailSuccess
                                : styles.detailNeutral
                            }
                          >
                            {
                              item.face_verified
                                ? "Verified"
                                : "Not verified"
                            }
                          </Text>
                        </View>

                        <View
                          style={
                            styles.detailRow
                          }
                        >
                          <Ionicons
                            name="location-outline"
                            size={20}
                            color={
                              item.location_verified
                                ? Colors.success
                                : Colors.textSecondary
                            }
                          />

                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Location verification
                          </Text>

                          <Text
                            style={
                              item.location_verified
                                ? styles.detailSuccess
                                : styles.detailNeutral
                            }
                          >
                            {
                              item.location_verified
                                ? "Verified"
                                : "Not verified"
                            }
                          </Text>
                        </View>
                      </View>
                    )}
                  </Pressable>
                );
              }
            )
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({

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
      paddingBottom: 32,
      gap: 16,
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
      justifyContent:
        "center",
    },

    headerTitle: {
      flex: 1,
      color:
        Colors.surface,
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
      paddingHorizontal: 16,
      paddingVertical: 16,
    },

    sectionTitle: {
      color:
        Colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
    },

    // ============================================================
    // ATTENDANCE OVERVIEW
    // ============================================================

    overviewHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginBottom: 14,
    },

    overviewFilter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    overviewFilterText: {
      color:
        Colors.textSecondary,
      fontSize: 16,
    },

    overviewLayout: {
      flexDirection: "row",
      alignItems: "center",
    },

    overviewRingSection: {
      width: 142,
      alignItems: "center",
    },

    overviewDivider: {
      width: 1,
      height: 116,
      backgroundColor:
        Colors.borderLight,
      marginRight: 10,
    },

    overviewStats: {
      flex: 1,
      flexDirection: "row",
      justifyContent:
        "space-between",
    },

    overviewStatItem: {
      flex: 1,
      alignItems: "center",
    },

    statIconBox: {
      width: 52,
      height: 44,
      borderRadius:
        Radius.md,
      alignItems: "center",
      justifyContent:
        "center",
      marginBottom: 6,
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

    statIconCircle: {
      width: 34,
      height: 34,
      borderRadius:
        Radius.pill,
      alignItems: "center",
      justifyContent:
        "center",
    },

    presentIconCircle: {
      backgroundColor:
        Colors.success,
    },

    absentIconCircle: {
      backgroundColor:
        Colors.dangerSoft,
    },

    statNumber: {
      color:
        Colors.textPrimary,
      fontSize: 24,
      fontWeight: "800",
    },

    statLabel: {
      color:
        Colors.textSecondary,
      fontSize: 14,
      marginTop: 1,
    },

    // ============================================================
    // ATTENDANCE RING
    // ============================================================

    ringContainer: {
      position: "relative",
      alignItems: "center",
      justifyContent:
        "center",
    },

    ringSvg: {
      position: "absolute",
      top: 0,
      left: 0,
    },

    ringTextContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent:
        "center",
    },

    ringPercentage: {
      color:
        Colors.textPrimary,
      fontSize: 24,
      fontWeight: "800",
    },

    ringLabel: {
      color:
        Colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },

    // ============================================================
    // COURSE FILTER
    // ============================================================

    filterLabel: {
      color:
        Colors.textSecondary,
      fontSize: 16,
      marginBottom: 8,
    },

    courseSelect: {
      minHeight: 54,
      borderWidth: 1,
      borderColor:
        Colors.border,
      borderRadius:
        Radius.md,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 12,
      marginBottom: 14,
    },

    courseSelectText: {
      flex: 1,
      color:
        Colors.textPrimary,
      fontSize: 19,
      fontWeight: "500",
    },

    courseDropdown: {
      borderWidth: 1,
      borderColor:
        Colors.borderLight,
      borderRadius:
        Radius.md,
      backgroundColor:
        Colors.surface,
      marginTop: -6,
      marginBottom: 14,
      overflow: "hidden",
    },

    dropdownItem: {
      minHeight: 48,
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
      fontSize: 15,
    },

    dropdownItemActiveText: {
      color:
        Colors.primary,
      fontSize: 15,
      fontWeight: "800",
    },

    courseTabs: {
      flexDirection: "row",
      gap: 8,
      paddingRight: 2,
    },

    courseTabActive: {
      minWidth: 112,
      minHeight: 42,
      borderWidth: 1.5,
      borderColor:
        Colors.primary,
      borderRadius:
        Radius.pill,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        Colors.surface,
      paddingHorizontal: 14,
    },

    courseTabActiveText: {
      color:
        Colors.primary,
      fontSize: 14,
      fontWeight: "800",
    },

    courseTab: {
      minWidth: 105,
      minHeight: 42,
      borderRadius:
        Radius.pill,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        Colors.background,
      paddingHorizontal: 14,
    },

    courseTabText: {
      color:
        Colors.textPrimary,
      fontSize: 13,
      fontWeight: "500",
    },

    // ============================================================
    // ATTENDANCE RECORDS HEADER
    // ============================================================

    recordsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      paddingHorizontal: 2,
      marginTop: 4,
    },

    recordsTitle: {
      color:
        Colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
    },

    recordsCount: {
      color:
        Colors.textSecondary,
      fontSize: 16,
    },

    // ============================================================
    // ATTENDANCE RECORDS
    // ============================================================

    recordsList: {
      gap: 12,
    },

    recordCard: {
      width: "100%",
      backgroundColor:
        Colors.surface,
      borderWidth: 1,
      borderColor:
        Colors.borderLight,
      borderRadius:
        Radius.lg,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },

    recordTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    recordTitleArea: {
      flex: 1,
      minWidth: 0,
    },

    recordCourse: {
      color:
        Colors.textPrimary,
      fontSize: 17,
      fontWeight: "800",
    },

    recordDate: {
      color:
        Colors.textSecondary,
      fontSize: 14,
      marginTop: 2,
    },

    recordStatusArea: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    statusBadge: {
      minHeight: 38,
      borderRadius:
        Radius.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
    },

    statusPresent: {
      backgroundColor:
        Colors.successSoft,
    },

    statusLate: {
      backgroundColor:
        Colors.warningSoft,
    },

    statusAbsent: {
      backgroundColor:
        Colors.dangerSoft,
    },

    statusText: {
      fontSize: 14,
      fontWeight: "700",
    },

    statusPresentText: {
      color:
        Colors.success,
    },

    statusLateText: {
      color:
        Colors.warning,
    },

    statusAbsentText: {
      color:
        Colors.danger,
    },

    recordDivider: {
      height: 1,
      backgroundColor:
        Colors.borderLight,
      marginTop: 10,
      marginBottom: 10,
    },

    recordTimes: {
      flexDirection: "row",
      alignItems: "center",
    },

    timeSection: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 10,
    },

    timeDivider: {
      width: 1,
      height: 44,
      backgroundColor:
        Colors.borderLight,
    },

    timeLabel: {
      color:
        Colors.textSecondary,
      fontSize: 13,
    },

    timeValue: {
      color:
        Colors.textPrimary,
      fontSize: 15,
      marginTop: 1,
    },

    // ============================================================
    // RECORD DETAILS
    // ============================================================

    recordDetails: {
      borderTopWidth: 1,
      borderTopColor:
        Colors.borderLight,
      marginTop: 12,
      paddingTop: 12,
      gap: 10,
    },

    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    detailLabel: {
      flex: 1,
      color:
        Colors.textSecondary,
      fontSize: 14,
    },

    detailSuccess: {
      color:
        Colors.success,
      fontSize: 14,
      fontWeight: "700",
    },

    detailNeutral: {
      color:
        Colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },

    // ============================================================
    // EMPTY RECORDS
    // ============================================================

    emptyRecordsCard: {
      minHeight: 120,
      backgroundColor:
        Colors.surface,
      borderWidth: 1,
      borderColor:
        Colors.borderLight,
      borderRadius:
        Radius.lg,
      alignItems: "center",
      justifyContent:
        "center",
      gap: 10,
    },

    emptyRecordsText: {
      color:
        Colors.textSecondary,
      fontSize: 15,
    },
  });
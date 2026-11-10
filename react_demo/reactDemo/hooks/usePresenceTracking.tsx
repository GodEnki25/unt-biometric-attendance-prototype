import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

import * as Location from "expo-location";

import { getStoredItem } from "@/utils/storage";

import { API_BASE } from "../constants/api";

// ============================================================
// TYPES
// ============================================================

type UserLocation = {
  lat: number;
  lon: number;
  accuracy: number;
};

type PresenceResult = {
  inside: boolean;
  allow_biometric: boolean;

  reason?: string;

  confirmed_state?: "INSIDE" | "OUTSIDE";
  candidate_state?: "INSIDE" | "OUTSIDE" | null;
  candidate_count?: number;

  state_changed?: boolean;
  event_type?: "EXIT" | "REENTER" | null;

  presence_tracking?: boolean;

  radius_m?: number;
  accuracy_buffer_m?: number;
  allowed_radius_m?: number;
  distance_m?: number;

  engine?: string;
};

type SessionResult = {
  id?: number | null;
  is_open?: boolean;

  center_lat?: number;
  center_lon?: number;

  radius_m?: number;

  session_date?: string;
  start_time?: string;
  end_time?: string | null;
};

type PermissionState =
  | "unknown"
  | "granted"
  | "denied";

type PresenceContextType = {
  location: UserLocation | null;

  result: PresenceResult | null;

  rawInside: boolean;
  confirmedInside: boolean;

  permissionStatus: PermissionState;

  isRefreshing: boolean;

  
  refreshPresence: () => Promise<void>;

  startCheckedInTracking: () => Promise<void>;
};

// ============================================================
// CONSTANTS
// ============================================================

const PRESENCE_CHECK_INTERVAL_MS = 10_000;

const SESSION_CHECK_INTERVAL_MS = 5_000;

const DISTANCE_PAUSE_THRESHOLD_M = 100;

// ============================================================
// CONTEXT
// ============================================================

const PresenceContext =
  createContext<PresenceContextType | null>(
    null
  );

// ============================================================
// PROVIDER
// ============================================================

export function PresenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  // ----------------------------------------------------------
  // REACT STATE
  // ----------------------------------------------------------

  const [location, setLocation] =
    useState<UserLocation | null>(null);

  const [result, setResult] =
    useState<PresenceResult | null>(null);

  const [
    permissionStatus,
    setPermissionStatus,
  ] =
    useState<PermissionState>(
      "unknown"
    );

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  // ----------------------------------------------------------
  // REFS
  // ----------------------------------------------------------

  const latestLocationRef =
    useRef<UserLocation | null>(null);

  const locationSubscriptionRef =
    useRef<
      Location.LocationSubscription | null
    >(null);

  const trackingActiveRef =
    useRef(false);

  const sendingRef =
    useRef(false);

  const pausedForDistanceRef = 
    useRef(false);

  // ==========================================================
  // STOP LOCATION WATCHER
  // ==========================================================

  function stopLocationTracking() {
    if (
      locationSubscriptionRef.current
    ) {
      console.log(
        "PRESENCE: stopping location watcher"
      );

      locationSubscriptionRef.current.remove();

      locationSubscriptionRef.current =
        null;
    }

    trackingActiveRef.current = false;

    latestLocationRef.current = null;

    setLocation(null);
  }

  // ==========================================================
  // START LOCATION WATCHER
  // ==========================================================

  async function startLocationTracking() {
    if (
      trackingActiveRef.current ||
      locationSubscriptionRef.current
    ) {
      return;
    }

    console.log(
      "PRESENCE: starting location watcher"
    );

    // --------------------------------------------------------
    // PERMISSION
    // --------------------------------------------------------

    const permission =
      await Location
        .requestForegroundPermissionsAsync();

    if (
      permission.status !==
      "granted"
    ) {
      console.log(
        "PRESENCE: location permission denied"
      );

      setPermissionStatus(
        "denied"
      );

      return;
    }

    setPermissionStatus(
      "granted"
    );

    // --------------------------------------------------------
    // LOCATION WATCHER
    //
    // OS maintains the latest foreground location.
    //
    // We DO NOT send every location update to the server.
    //
    // Backend presence checks remain periodic.
    // --------------------------------------------------------

    try {
      locationSubscriptionRef.current =
        await Location.watchPositionAsync(
          {
            accuracy:
              Location.Accuracy.High,

            // Update when device moves roughly 1 meter.
            distanceInterval: 1,

            // Android uses this.
            // Other platforms safely ignore it.
            timeInterval: 2000,
          },

          (
            newLocation
          ) => {
            const currentLoc: UserLocation =
              {
                lat:
                  newLocation.coords.latitude,

                lon:
                  newLocation.coords.longitude,

                accuracy:
                  newLocation.coords
                    .accuracy ??
                  999,
              };

            latestLocationRef.current =
              currentLoc;

            setLocation(
              currentLoc
            );

            console.log(
              "LOCATION UPDATE:",
              {
                lat:
                  currentLoc.lat,

                lon:
                  currentLoc.lon,

                accuracy:
                  currentLoc.accuracy,
              }
            );
          }
        );

      trackingActiveRef.current =
        true;

      console.log(
        "PRESENCE: location watcher active"
      );
    }

    catch (error) {
      console.warn(
        "PRESENCE: failed to start location watcher:",
        error
      );

      trackingActiveRef.current =
        false;
    }
  }

  // ==========================================================
  // SEND LOCATION TO GEOFENCE BACKEND
  // ==========================================================

  async function sendPresenceCheck(
    forceLocation = false
  ) {
    // Prevent overlapping requests.
    if (sendingRef.current) {
      console.log(
        "PRESENCE: previous check still running"
      );

      return;
    }

    sendingRef.current = true;

    setIsRefreshing(
      true
    );

    try {
      // ------------------------------------------------------
      // AUTH TOKEN
      // ------------------------------------------------------

      const token =
        await getStoredItem(
          "access_token"
        );

      if (!token) {
        console.log(
          "PRESENCE: no access token"
        );

        return;
      }

      // ------------------------------------------------------
      // LOCATION
      // ------------------------------------------------------

      let currentLoc =
        latestLocationRef.current;

      // Manual refresh fallback.
      //
      // Normal periodic tracking should NOT need this because
      // watchPositionAsync keeps latestLocationRef current.
      if (
       
        forceLocation
      ) {
        console.log(
          "PRESENCE: requesting one-time check-in location"
        );

        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (
          permission.status !==
          "granted"
        ) {
          setPermissionStatus(
            "denied"
          );

          console.log(
            "PRESENCE: one-time location permission denied"
          );

          return;
        }

        setPermissionStatus(
          "granted"
        );

        const current =
          await Location.getCurrentPositionAsync({
            accuracy:
              Location.Accuracy.High,
          });

        currentLoc = {
          lat:
            current.coords.latitude,

          lon:
            current.coords.longitude,

          accuracy:
            current.coords.accuracy ??
            999,
        };

        latestLocationRef.current =
          currentLoc;

        setLocation(
          currentLoc
        );
      }

      if (!currentLoc) {
        console.log(
          "PRESENCE: waiting for first location fix"
        );

        return;
      }

      // ------------------------------------------------------
      // GEOFENCE REQUEST
      // ------------------------------------------------------

      console.log(
        "PRESENCE CHECK SEND:",
        {
          lat:
            currentLoc.lat,

          lon:
            currentLoc.lon,

          accuracy_m:
            currentLoc.accuracy,
        }
      );

      const response =
        await fetch(
          `${API_BASE}/geofence/check`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                lat:
                  currentLoc.lat,

                lon:
                  currentLoc.lon,

                accuracy_m:
                  currentLoc.accuracy,
              }),
          }
        );

      // ------------------------------------------------------
      // HANDLE RESPONSE
      // ------------------------------------------------------

      if (!response.ok) {
        const errorText =
          await response.text();

        console.warn(
          "PRESENCE: backend error",
          response.status,
          errorText
        );

        return;
      }

      const data:
        PresenceResult =
        await response.json();

      setResult(
        data
      );

      if (
        data.presence_tracking === true &&
        data.confirmed_state === "OUTSIDE" &&
        typeof data.distance_m === "number" &&
        data.distance_m >= DISTANCE_PAUSE_THRESHOLD_M
      ) {
        pausedForDistanceRef.current = true;

        console.log("PRESENCE: confirmed outside beyond privacy cutoff; pausing GPS",
          {
            distance_m: data.distance_m,
            cutoff_m: DISTANCE_PAUSE_THRESHOLD_M,
          }
        );

        stopLocationTracking();
      }

      console.log(
        "PRESENCE UPDATE:",
        {
          phone_lat:
            currentLoc.lat,

          phone_lon:
            currentLoc.lon,

          accuracy:
            currentLoc.accuracy,

          raw_inside:
            data.inside,

          confirmed_state:
            data.confirmed_state,

          candidate_state:
            data.candidate_state,

          candidate_count:
            data.candidate_count,

          state_changed:
            data.state_changed,

          event_type:
            data.event_type,

          presence_tracking:
            data.presence_tracking,

          radius_m:
            data.radius_m,

          accuracy_buffer_m:
            data.accuracy_buffer_m,

          allowed_radius_m:
            data.allowed_radius_m,

          engine:
            data.engine,
        }
      );
    }

    catch (error) {
      console.warn(
        "PRESENCE: geofence check failed:",
        error
      );
    }

    finally {
      sendingRef.current =
        false;

      setIsRefreshing(
        false
      );
    }
  }

  // ==========================================================
  // MANUAL REFRESH
  // ==========================================================

  async function refreshPresence() {
    // Intentional refresh is allowed to wake presnce tracking
    // back up after 100m privacy cutoff.
    pausedForDistanceRef.current = false;

    await sendPresenceCheck(
      true
    );
  }

  async function startCheckedInTracking() {
    console.log ("PRESENSE: successful check-in confirmed; starting presence tracking");

    await startLocationTracking();
    await sendPresenceCheck(true);
  }

  // ==========================================================
  // PROVIDER LIFECYCLE
  // ==========================================================

  useEffect(() => {
    let cancelled =
      false;

    let sessionInterval:
      ReturnType<
        typeof setInterval
      > | null = null;

    let presenceInterval:
      ReturnType<
        typeof setInterval
      > | null = null;

    // --------------------------------------------------------
    // CHECK WHETHER AN ACTIVE CLASS SESSION EXISTS
    // --------------------------------------------------------

    async function checkSession() {
      try {
        const token =
          await getStoredItem (
              "access_token"
            );

        // ----------------------------------------------------
        // NOT LOGGED IN
        // ----------------------------------------------------

        if (!token) {
          pausedForDistanceRef.current = false;
          stopLocationTracking();
          setResult(null);
          return;
        }

        // ----------------------------------------------------
        // GET ACTIVE SESSION
        // 
        // This request contains NO location data.
        // ----------------------------------------------------

        const response =
          await fetch(
            `${API_BASE}/geofence/session`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (!response.ok) {
          console.warn(
            "PRESENCE: session request failed",
            response.status
          );

          return;
        }

        const session:
          SessionResult =
          await response.json();

        if (cancelled) {
          return;
        }

        // ----------------------------------------------------
        // NO ACTIVE SESSION
        //
        // No class = no location collection.
        // ----------------------------------------------------

        if (
          session?.is_open !==
          true
        ) {
          if (
            trackingActiveRef.current ||
            latestLocationRef.current
          ) {
            console.log ("PRESENCE: no active class session");
          }

          pausedForDistanceRef.current = false;
          stopLocationTracking();
          setResult(null);

          return;
        }

        // ----------------------------------------------------
        // ACTIVE SESSION: CHECK WHETHER THIS STUDENT
        // ACTUALLY CHECKED IN.
        //
        // This request contains NO location data.
        // ----------------------------------------------------

        const checkInResponse = await fetch (`${API_BASE}/checkin/status`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        if (!checkInResponse.ok) {
          console.warn (
            "PRESENCE: check-in status request failed",
            checkInResponse.status
          );

          return;
        }

        const checkInStatus = await checkInResponse.json();

        if (cancelled) {
          return;
        }

        // ----------------------------------------------------
        // STUDENT DID NOT CHECK IN
        //
        // DO NOT periodically collect GPS.
        // ----------------------------------------------------

        if (
          checkInStatus?.checked_in !==
          true
        ) {
          
          pausedForDistanceRef.current = false;

          if (
            trackingActiveRef.current
          ) {
            console.log (
              "PRESENCE: student is not checked in; stopping periodic tracking"
            );

            stopLocationTracking();
          }

          return;
        }

        // ----------------------------------------------------
        // ACTIVE SESSION + STUDENT CHECKED IN
        //
        // Only now can periodic GPS tracking begin.
        // ----------------------------------------------------

        if (
          pausedForDistanceRef.current
        ) {
          //Student is still checked in, but GPS was intentionally
          // Stopped becuase they were confirmed outside and >100m away
          return;
        }

        if(
          !trackingActiveRef.current
        ) {
          console.log(
            "PRESENCE: checked-in student detected; starting periodic tracking"
          );

          await startLocationTracking();
        }
      }

      catch (error) {
        console.warn (
          "PRESENCE: unable to refresh tracking state:",
          error
        );
      }
    }

    // --------------------------------------------------------
    // INITIAL SESSION CHECK
    // --------------------------------------------------------

    void checkSession();

    // --------------------------------------------------------
    // SESSION WATCH
    //
    // Detect instructor opening / closing attendance.
    // --------------------------------------------------------

    sessionInterval =
      setInterval(
        () => {
          void checkSession();
        },
        SESSION_CHECK_INTERVAL_MS
      );

    // --------------------------------------------------------
    // PRESENCE CHECK LOOP
    //
    // Only sends while:
    //
    // 1. student is logged in
    // 2. active session exists
    // 3. location watcher is active
    //
    // Location updates themselves are NOT continuously sent.
    // --------------------------------------------------------

    presenceInterval =
      setInterval(
        () => {
          if (
            !trackingActiveRef.current
          ) {
            return;
          }

          void sendPresenceCheck(true);
        },

        PRESENCE_CHECK_INTERVAL_MS
      );

    // --------------------------------------------------------
    // CLEANUP
    // --------------------------------------------------------

    return () => {
      cancelled = true;

      if (
        sessionInterval
      ) {
        clearInterval(
          sessionInterval
        );
      }

      if (
        presenceInterval
      ) {
        clearInterval(
          presenceInterval
        );
      }

      stopLocationTracking();
    };
  }, []);

  // ==========================================================
  // DERIVED PRESENCE STATE
  // ==========================================================

  /*
   * Before check-in:
   *
   * backend presence_tracking = false
   *
   * Use raw Tile38 result so the student can immediately
   * begin biometric verification when physically inside.
   */

  const rawInside =
    result?.inside === true &&
    result?.allow_biometric ===
      true;

  /*
   * After check-in:
   *
   * backend presence_tracking = true
   *
   * Use confirmed_state so GPS jitter does not immediately
   * create EXIT / REENTER events.
   */

  const confirmedInside =
    result?.presence_tracking &&
    result?.confirmed_state
      ? result.confirmed_state ===
        "INSIDE"
      : rawInside;

  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (
    <PresenceContext.Provider
      value={{
        location,
        result,
        rawInside,
        confirmedInside,
        permissionStatus,
        isRefreshing,
        refreshPresence,
        startCheckedInTracking,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function usePresenceTracking() {
  const context =
    useContext(
      PresenceContext
    );

  if (!context) {
    throw new Error(
      "usePresenceTracking must be used inside PresenceProvider"
    );
  }

  return context;
}
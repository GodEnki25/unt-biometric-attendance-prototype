import { createContext, useContext, useEffect, useRef, useState, ReactNode, } from "react";

import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

import { API_BASE } from "../constants/api";

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

  engine?: string;
};

type PresenceContextType = {
  location: UserLocation | null;
  result: PresenceResult | null;

  rawInside: boolean;
  confirmedInside: boolean;

  permissionStatus:
    | "unknown"
    | "granted"
    | "denied";

  isRefreshing: boolean;

  refreshPresence: () => Promise<void>;
};

const PresenceContext =
  createContext<PresenceContextType | null>(
    null
  );

export function PresenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [location, setLocation] =
    useState<UserLocation | null>(null);

  const [result, setResult] =
    useState<PresenceResult | null>(null);

  const [permissionStatus, setPermissionStatus] =
    useState<
      "unknown" |
      "granted" |
      "denied"
    >("unknown");

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const requestRunning =
    useRef(false);

  async function refreshPresence() {
    if (requestRunning.current) {
      return;
    }

    requestRunning.current = true;

    try {
      setIsRefreshing(true);

      const token =
        await SecureStore.getItemAsync(
          "access_token"
        );

      if (!token) {
        return;
      }

      const current =
        await Location.getCurrentPositionAsync({
          accuracy:
            Location.Accuracy.High,
        });

      const currentLoc: UserLocation = {
        lat:
          current.coords.latitude,

        lon:
          current.coords.longitude,

        accuracy:
          current.coords.accuracy ??
          999,
      };

      setLocation(currentLoc);

      const response = await fetch(
        `${API_BASE}/geofence/check`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            lat: currentLoc.lat,
            lon: currentLoc.lon,
            accuracy_m:
              currentLoc.accuracy,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Geofence check failed (${response.status})`
        );
      }

      const data: PresenceResult =
        await response.json();

      setResult(data);

      console.log(
        "PRESENCE UPDATE:",
        {
          phone_lat:
            currentLoc.lat,

          phone_lon:
            currentLoc.lon,

          inside:
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
        }
      );
    }

    catch (error) {
      console.error(
        "Presence tracking error:",
        error
      );
    }

    finally {
      setIsRefreshing(false);
      requestRunning.current = false;
    }
  }

  useEffect(() => {
    let interval:
      ReturnType<typeof setInterval>
      | null = null;

    async function startTracking() {
      const permission =
        await Location
          .requestForegroundPermissionsAsync();

      if (
        permission.status !==
        "granted"
      ) {
        setPermissionStatus(
          "denied"
        );

        return;
      }

      setPermissionStatus(
        "granted"
      );

      await refreshPresence();

      interval = setInterval(
        () => {
          void refreshPresence();
        },
        10000
      );
    }

    void startTracking();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  const rawInside =
    result?.inside === true &&
    result?.allow_biometric === true;

  const confirmedInside =
    result?.presence_tracking &&
    result.confirmed_state
      ? result.confirmed_state ===
        "INSIDE"
      : rawInside;

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
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresenceTracking() {
  const context =
    useContext(PresenceContext);

  if (!context) {
    throw new Error(
      "usePresenceTracking must be used inside PresenceProvider"
    );
  }

  return context;
}
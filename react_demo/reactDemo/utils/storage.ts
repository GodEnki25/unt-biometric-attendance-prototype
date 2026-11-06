import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// ============================================================
// SHARED CROSS-PLATFORM STORAGE
// ============================================================
//
// Native:
//   iOS / Android -> Expo SecureStore
//
// Web / Windows web build:
//   browser localStorage
//
// Every screen should use these functions instead of importing
// SecureStore directly.
// ============================================================

export async function getStoredItem(
  key: string
): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (
        typeof window === "undefined" ||
        !window.localStorage
      ) {
        return null;
      }

      return window.localStorage.getItem(
        key
      );
    }

    return await SecureStore.getItemAsync(
      key
    );
  } catch (error) {
    console.error(
      `STORAGE: failed to read "${key}"`,
      error
    );

    return null;
  }
}

export async function setStoredItem(
  key: string,
  value: string
): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (
        typeof window === "undefined" ||
        !window.localStorage
      ) {
        throw new Error(
          "Browser localStorage is unavailable"
        );
      }

      window.localStorage.setItem(
        key,
        value
      );

      return;
    }

    await SecureStore.setItemAsync(
      key,
      value
    );
  } catch (error) {
    console.error(
      `STORAGE: failed to save "${key}"`,
      error
    );

    throw error;
  }
}

export async function deleteStoredItem(
  key: string
): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.localStorage
      ) {
        window.localStorage.removeItem(
          key
        );
      }

      return;
    }

    await SecureStore.deleteItemAsync(
      key
    );
  } catch (error) {
    console.error(
      `STORAGE: failed to delete "${key}"`,
      error
    );

    throw error;
  }
}

// ============================================================
// AUTH HELPERS
// ============================================================

export async function clearAuthStorage() {
  await Promise.all([
    deleteStoredItem("access_token"),
    deleteStoredItem("user"),
  ]);
}

import { Stack } from "expo-router";

export default function Layout()
{
    return (
        <Stack initialRouteName="login">
            <Stack.Screen name="login" options={{ headerShown: false }} />

            <Stack.Screen name="dashboard" options={{ headerShown: false }} />
            <Stack.Screen name="firstTimeEnroll" options={{ headerShown: false }} />

            <Stack.Screen name="attendanceHistory" options={{ headerShown: false }} />
            <Stack.Screen name="checkIn" options={{ headerShown: false }} />
        </Stack>
    );
}
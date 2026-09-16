import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

export default function ModalScreen()
{
    if (Platform.OS === 'web')
    {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (isMobile)
        {
            return <Redirect href="/login" />;
        }

        return <Redirect href="/loginInstructor" />;
    }
    return <Redirect href="/login" />;
}
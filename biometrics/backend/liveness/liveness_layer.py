import mediapipe as mp
import random


def check_blink(landmarks):
    """Check if the eyes are blinking based on landmarks"""
    left_eye = [landmarks[33], landmarks[133], landmarks[159], landmarks[145]]
    right_eye = [landmarks[362], landmarks[263], landmarks[386], landmarks[374]]

    def eye_aspect_ratio(eye):
        """Calculate the eye aspect ratio (EAR)"""
        A = ((eye[1].x - eye[5].x) ** 2 + (eye[1].y - eye[5].y) ** 2) ** 0.5
        B = ((eye[2].x - eye[4].x) ** 2 + (eye[2].y - eye[4].y) ** 2) ** 0.5
        C = ((eye[0].x - eye[3].x) ** 2 + (eye[0].y - eye[3].y) ** 2) ** 0.5
        return (A + B) / (2.0 * C)

    left_ear = eye_aspect_ratio(left_eye)
    right_ear = eye_aspect_ratio(right_eye)

    # Average EAR for both eyes
    ear = (left_ear + right_ear) / 2.0

    # Threshold for blink detection
    BLINK_THRESHOLD = 0.25

    return ear < BLINK_THRESHOLD

def check_smile(landmarks):
    """Check if the person is smiling based on landmarks"""
    left_mouth = landmarks[61]
    right_mouth = landmarks[291]
    top_mouth = landmarks[13]
    bottom_mouth = landmarks[14]

    mouth_width = ((right_mouth.x - left_mouth.x) ** 2 + (right_mouth.y - left_mouth.y) ** 2) ** 0.5
    mouth_height = ((top_mouth.x - bottom_mouth.x) ** 2 + (top_mouth.y - bottom_mouth.y) ** 2) ** 0.5

    # Smile ratio
    smile_ratio = mouth_width / mouth_height

    # Threshold for smile detection
    SMILE_THRESHOLD = 1.8

    return smile_ratio > SMILE_THRESHOLD

def check_open_mouth(landmarks):
    """Check if the person has their mouth open based on landmarks"""
    top_mouth = landmarks[13]
    bottom_mouth = landmarks[14]
    left_mouth = landmarks[61]
    right_mouth = landmarks[291]

    mouth_width = ((right_mouth.x - left_mouth.x) ** 2 + (right_mouth.y - left_mouth.y) ** 2) ** 0.5
    mouth_height = ((top_mouth.x - bottom_mouth.x) ** 2 + (top_mouth.y - bottom_mouth.y) ** 2) ** 0.5

    # Open mouth ratio
    open_mouth_ratio = mouth_height / mouth_width

    # Threshold for open mouth detection
    OPEN_MOUTH_THRESHOLD = 1.2

    return open_mouth_ratio > OPEN_MOUTH_THRESHOLD

def check_face_right(landmarks):
    """Check if the person is facing right based on landmarks"""
    nose_tip = landmarks[1]
    left_eye = landmarks[33]
    right_eye = landmarks[263]

    # Calculate the horizontal position of the nose tip relative to the eyes
    eye_distance = right_eye.x - left_eye.x
    nose_position = (nose_tip.x - left_eye.x) / eye_distance

    # Threshold for facing right detection
    RIGHT_THRESHOLD = 0.6

    return nose_position > RIGHT_THRESHOLD

def check_face_left(landmarks):
    """Check if the person is facing left based on landmarks"""
    nose_tip = landmarks[1]
    left_eye = landmarks[33]
    right_eye = landmarks[263]

    # Calculate the horizontal position of the nose tip relative to the eyes
    eye_distance = right_eye.x - left_eye.x
    nose_position = (nose_tip.x - left_eye.x) / eye_distance

    # Threshold for facing left detection
    LEFT_THRESHOLD = 0.4

    return nose_position < LEFT_THRESHOLD

def check_raise_eyebrows(landmarks):
    """Check if the person is raising their eyebrows based on landmarks"""
    left_eyebrow = landmarks[105]
    right_eyebrow = landmarks[334]
    left_eye = landmarks[33]
    right_eye = landmarks[263]

    # Calculate the vertical distance between the eyebrows and eyes
    left_distance = left_eyebrow.y - left_eye.y
    right_distance = right_eyebrow.y - right_eye.y

    # Average distance for both eyebrows
    avg_distance = (left_distance + right_distance) / 2.0

    # Threshold for raising eyebrows detection
    RAISE_EYEBROWS_THRESHOLD = 0.05

    return avg_distance < RAISE_EYEBROWS_THRESHOLD

def check_puff_cheeks(landmarks):
    """Check if the person is puffing their cheeks based on landmarks"""
    left_cheek = landmarks[234]
    right_cheek = landmarks[454]
    left_mouth = landmarks[61]
    right_mouth = landmarks[291]

    # Calculate the horizontal distance between the cheeks and mouth corners
    left_distance = ((left_cheek.x - left_mouth.x) ** 2 + (left_cheek.y - left_mouth.y) ** 2) ** 0.5
    right_distance = ((right_cheek.x - right_mouth.x) ** 2 + (right_cheek.y - right_mouth.y) ** 2) ** 0.5

    # Average distance for both cheeks
    avg_distance = (left_distance + right_distance) / 2.0

    # Threshold for puffing cheeks detection
    PUFF_CHEEKS_THRESHOLD = 0.1

    return avg_distance > PUFF_CHEEKS_THRESHOLD

# implementing ramdom gesture selection for liveness detection
gestures = {
    "blink": check_blink,
    "smile": check_smile,
    "open_mouth": check_open_mouth,
    "face_right": check_face_right,
    "face_left": check_face_left,
    "raise_eyebrows": check_raise_eyebrows,
    "puff_cheeks": check_puff_cheeks
}



def run_liveness_check(landmarks):

    max_attempts = 3

    for attempt in range(max_attempts):

        gesture_name = random.choice(list(gestures.keys()))
        gesture_function = gestures[gesture_name]

        if gesture_function(landmarks):
            return True

    return False

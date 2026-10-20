
import random
import time

import cv2
import numpy as np
import mediapipe as mp


CHALLENGE_SECONDS = 12.0
CHALLENGE_COUNT = 2

BLINK_CLOSED = 0.18
BLINK_OPEN = 0.23

MOUTH_CLOSED = 0.10
MOUTH_OPEN = 0.28

TURN_DELTA = 0.10

LEFT_EYE = (33, 160, 158, 133, 153, 144)
RIGHT_EYE = (362, 385, 387, 263, 373, 380)


def distance(a, b):
    return float(
        np.hypot(
            a.x - b.x,
            a.y - b.y
        )
    )


def eye_ratio(landmarks, indices):
    p = [landmarks[i] for i in indices]

    width = distance(p[0], p[3])

    if width < 1e-6:
        return 0.0

    return (
        distance(p[1], p[5]) +
        distance(p[2], p[4])
    ) / (2 * width)


def facial_metrics(landmarks):
    eyes = (
        eye_ratio(landmarks, LEFT_EYE) +
        eye_ratio(landmarks, RIGHT_EYE)
    ) / 2

    mouth_width = distance(
        landmarks[61],
        landmarks[291]
    )

    mouth = distance(
        landmarks[13],
        landmarks[14]
    ) / max(mouth_width, 1e-6)

    eye_a = landmarks[33]
    eye_b = landmarks[263]
    nose = landmarks[1]

    center = (
        eye_a.x + eye_b.x
    ) / 2

    yaw = (
        nose.x - center
    ) / max(
        abs(eye_b.x - eye_a.x),
        1e-6
    )

    return eyes, mouth, yaw


class LivenessSession:

    def __init__(
        self,
        duration=CHALLENGE_SECONDS
    ):
        self.duration = duration

        self.actions = random.SystemRandom().sample(
            [
                "blink",
                "open_mouth",
                "turn_head"
            ],
            CHALLENGE_COUNT
        )

        self.started = time.monotonic()

        self.index = 0

        self.neutral_yaw = None

        self.eye_open_seen = False
        self.eye_closed_seen = False

        self.mouth_closed_seen = False

        self.confirmation = 0

        self.mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=2,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )

    def close(self):
        self.mesh.close()

    def current_action(self):
        if self.index < len(self.actions):
            return self.actions[self.index]

        return None

    def progress(self):
        remaining = max(
            0,
            self.duration - (
                time.monotonic() - self.started
            )
        )

        return {
            "status": "liveness_pending",
            "action": self.current_action(),
            "step": self.index + 1,
            "total_steps": len(self.actions),
            "seconds_remaining": round(
                remaining,
                1
            )
        }

    def process(self, frame):

        if (
            time.monotonic() - self.started
            > self.duration
        ):
            return {
                "status": "liveness_failed",
                "reason": "timeout"
            }

        if (
            frame is None
            or not isinstance(frame, np.ndarray)
            or frame.ndim != 3
            or frame.shape[2] != 3
        ):
            return {
                **self.progress(),
                "reason": "invalid_frame"
            }

        rgb = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        result = self.mesh.process(rgb)

        faces = result.multi_face_landmarks or []

        if len(faces) != 1:
            return {
                **self.progress(),
                "reason": "one_face_required"
            }

        eyes, mouth, yaw = facial_metrics(
            faces[0].landmark
        )

        if not np.isfinite(
            [eyes, mouth, yaw]
        ).all():
            return {
                **self.progress(),
                "reason": "landmark_error"
            }

        action = self.current_action()
        completed = False

        if action == "blink":

            if eyes >= BLINK_OPEN:

                self.eye_open_seen = True

                if self.eye_closed_seen:
                    completed = True

            elif (
                eyes <= BLINK_CLOSED
                and self.eye_open_seen
            ):
                self.eye_closed_seen = True

        elif action == "open_mouth":

            if mouth <= MOUTH_CLOSED:
                self.mouth_closed_seen = True

            if (
                self.mouth_closed_seen
                and mouth >= MOUTH_OPEN
            ):
                self.confirmation += 1

                completed = (
                    self.confirmation >= 2
                )

            elif mouth < MOUTH_OPEN:
                self.confirmation = 0

        elif action == "turn_head":

            if self.neutral_yaw is None:
                self.neutral_yaw = yaw

            elif (
                abs(
                    yaw - self.neutral_yaw
                ) >= TURN_DELTA
            ):
                self.confirmation += 1

                completed = (
                    self.confirmation >= 2
                )

            else:
                self.confirmation = 0

        if completed:

            self.index += 1

            self.neutral_yaw = None

            self.eye_open_seen = False
            self.eye_closed_seen = False

            self.mouth_closed_seen = False

            self.confirmation = 0

            if self.index == len(
                self.actions
            ):
                return {
                    "status": "liveness_passed"
                }

        return self.progress()

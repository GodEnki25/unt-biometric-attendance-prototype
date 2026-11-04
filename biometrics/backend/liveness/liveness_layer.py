
import random
from time import monotonic

import cv2
import numpy as np
import mediapipe as mp


CHALLENGES = ("blink", "open_mouth", "turn_head", "smile")
CHALLENGE_SECONDS = 7.0
NUMBER_OF_CHALLENGES = 2


def _distance(points, a, b):
    return float(np.linalg.norm(points[a] - points[b]))


def _eye_ratio(points, indices):
    p1, p2, p3, p4, p5, p6 = indices
    width = _distance(points, p1, p4)

    if width < 1e-6:
        return None

    return (
        _distance(points, p2, p6)
        + _distance(points, p3, p5)
    ) / (2 * width)


class LivenessSession:

    def __init__(self):
        if (
            not hasattr(mp, "solutions")
            or not hasattr(mp.solutions, "face_mesh")
        ):
            raise RuntimeError(
                "Compatible MediaPipe Face Mesh installation required."
            )

        self.mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        self.actions = random.SystemRandom().sample(
            CHALLENGES,
            NUMBER_OF_CHALLENGES
        )

        self.index = 0
        self.step_started = monotonic()
        self.baseline = None
        self.closed_seen = False
        self.finished = False

    def close(self):
        if self.mesh is not None:
            self.mesh.close()
            self.mesh = None

    def _measure(self, frame):
        if (
            self.mesh is None
            or frame is None
            or frame.size == 0
        ):
            return None

        rgb = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        rgb.flags.writeable = False

        result = self.mesh.process(rgb)

        if (
            not result.multi_face_landmarks
            or len(result.multi_face_landmarks) != 1
        ):
            return None

        height, width = frame.shape[:2]

        points = np.array(
            [
                [point.x * width, point.y * height]
                for point in result.multi_face_landmarks[0].landmark
            ],
            dtype=np.float32
        )

        left_eye = _eye_ratio(
            points,
            (33, 160, 158, 133, 153, 144)
        )

        right_eye = _eye_ratio(
            points,
            (362, 385, 387, 263, 373, 380)
        )

        if left_eye is None or right_eye is None:
            return None

        eyes = (left_eye + right_eye) / 2

        face_width = _distance(points, 234, 454)
        mouth_width = _distance(points, 61, 291)
        mouth_open = _distance(points, 13, 14)

        if face_width < 1e-6 or mouth_width < 1e-6:
            return None

        left_to_nose = _distance(points, 234, 1)
        nose_to_right = _distance(points, 1, 454)

        yaw = (
            left_to_nose - nose_to_right
        ) / face_width

        return {
            "eyes": eyes,
            "mouth_open": mouth_open / mouth_width,
            "smile": mouth_width / face_width,
            "yaw": yaw
        }

    def process(self, frame):
        if self.finished:
            return {
                "status": "liveness_failed",
                "reason": "session_finished"
            }

        remaining = CHALLENGE_SECONDS - (
            monotonic() - self.step_started
        )

        if remaining <= 0:
            self.finished = True

            return {
                "status": "liveness_failed",
                "reason": "challenge_timeout"
            }

        action = self.actions[self.index]

        result = {
            "status": "liveness_pending",
            "action": action,
            "step": self.index + 1,
            "total_steps": len(self.actions),
            "seconds_remaining": remaining
        }

        metrics = self._measure(frame)

        if metrics is None:
            return result

        if self.baseline is None:
            self.baseline = metrics
            return result

        baseline = self.baseline
        completed = False

        if action == "blink":
            if metrics["eyes"] < min(
                0.18,
                baseline["eyes"] * 0.72
            ):
                self.closed_seen = True

            elif (
                self.closed_seen
                and metrics["eyes"] > baseline["eyes"] * 0.85
            ):
                completed = True

        elif action == "open_mouth":
            completed = (
                metrics["mouth_open"]
                > max(
                    0.28,
                    baseline["mouth_open"] + 0.16
                )
            )

        elif action == "turn_head":
            completed = (
                abs(metrics["yaw"] - baseline["yaw"])
                > 0.16
            )

        elif action == "smile":
            completed = (
                metrics["smile"]
                > baseline["smile"] * 1.12
            )

        if not completed:
            return result

        self.index += 1

        if self.index >= len(self.actions):
            self.finished = True

            return {
                "status": "liveness_passed",
                "steps_completed": len(self.actions)
            }

        self.baseline = None
        self.closed_seen = False
        self.step_started = monotonic()

        return {
            "status": "liveness_pending",
            "action": self.actions[self.index],
            "step": self.index + 1,
            "total_steps": len(self.actions),
            "seconds_remaining": CHALLENGE_SECONDS
        }

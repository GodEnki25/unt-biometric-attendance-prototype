
import numpy as np

from backend.database.db import get_db_connection


EMBEDDING_DIM = 512
MAX_TEMPLATES = 3
MIN_NORM = 1e-8


def prepare_face_embeddings(embedding):

    embeddings = np.asarray(
        embedding,
        dtype=np.float32
    )

    if embeddings.ndim == 1:

        if embeddings.shape[0] != EMBEDDING_DIM:
            raise ValueError(
                "Face embedding must contain 512 values."
            )

        embeddings = embeddings.reshape(
            1,
            EMBEDDING_DIM
        )

    elif embeddings.ndim == 2:

        if (
            embeddings.shape[1] != EMBEDDING_DIM
            or embeddings.shape[0] not in (1, MAX_TEMPLATES)
        ):
            raise ValueError(
                "Expected 1 or 3 face embeddings of 512 values."
            )

    else:

        raise ValueError(
            "Invalid face embedding dimensions."
        )

    if not np.isfinite(embeddings).all():
        raise ValueError(
            "Face embeddings contain invalid values."
        )

    norms = np.linalg.norm(
        embeddings,
        axis=1
    )

    if np.any(norms <= MIN_NORM):
        raise ValueError(
            "Face embeddings have invalid norms."
        )

    embeddings = embeddings / norms[:, None]

    return np.ascontiguousarray(
        embeddings,
        dtype=np.float32
    )


def prepare_periocular_embeddings(embedding):

    embeddings = np.asarray(
        embedding,
        dtype=np.float32
    )

    if embeddings.ndim != 2:
        raise ValueError(
            "Periocular embeddings must be a 2D array."
        )

    if embeddings.shape[0] != MAX_TEMPLATES:
        raise ValueError(
            "Expected exactly 3 periocular embeddings."
        )

    if embeddings.shape[1] == 0:
        raise ValueError(
            "Invalid periocular embedding dimension."
        )

    if not np.isfinite(embeddings).all():
        raise ValueError(
            "Periocular embeddings contain invalid values."
        )

    norms = np.linalg.norm(
        embeddings,
        axis=1
    )

    if np.any(norms <= MIN_NORM):
        raise ValueError(
            "Periocular embeddings have invalid norms."
        )

    embeddings = embeddings / norms[:, None]

    return np.ascontiguousarray(
        embeddings,
        dtype=np.float32
    )


def ensure_periocular_columns(cursor):

    cursor.execute(
        "PRAGMA table_info(face_profiles)"
    )

    columns = {
        row[1]
        for row in cursor.fetchall()
    }

    if not columns:
        raise ValueError(
            "face_profiles table does not exist."
        )

    if "periocular_embedding" not in columns:

        cursor.execute(
            """
            ALTER TABLE face_profiles
            ADD COLUMN periocular_embedding BLOB
            """
        )

    if "periocular_dim" not in columns:

        cursor.execute(
            """
            ALTER TABLE face_profiles
            ADD COLUMN periocular_dim INTEGER
            """
        )


def save_face_embedding(user_id, embedding):

    embeddings = prepare_face_embeddings(
        embedding
    )

    embedding_blob = embeddings.tobytes()

    conn = get_db_connection()

    try:

        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO face_profiles (
                user_id,
                embedding_path
            )
            VALUES (?, ?)
            ON CONFLICT(user_id)
            DO UPDATE SET
                embedding_path = excluded.embedding_path
            """,
            (
                user_id,
                embedding_blob
            )
        )

        conn.commit()

    except Exception:

        conn.rollback()
        raise

    finally:

        conn.close()


def save_biometric_templates(
    user_id,
    face_embeddings,
    periocular_embeddings
):

    faces = prepare_face_embeddings(
        face_embeddings
    )

    eyes = prepare_periocular_embeddings(
        periocular_embeddings
    )

    if faces.shape[0] != MAX_TEMPLATES:
        raise ValueError(
            "Expected exactly 3 full-face embeddings."
        )

    face_blob = faces.tobytes()
    eye_blob = eyes.tobytes()
    eye_dimension = eyes.shape[1]

    conn = get_db_connection()

    try:

        cursor = conn.cursor()

        ensure_periocular_columns(cursor)

        cursor.execute(
            """
            INSERT INTO face_profiles (
                user_id,
                embedding_path,
                periocular_embedding,
                periocular_dim
            )
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id)
            DO UPDATE SET
                embedding_path = excluded.embedding_path,
                periocular_embedding =
                    excluded.periocular_embedding,
                periocular_dim =
                    excluded.periocular_dim
            """,
            (
                user_id,
                face_blob,
                eye_blob,
                eye_dimension
            )
        )

        conn.commit()

    except Exception:

        conn.rollback()
        raise

    finally:

        conn.close()


def get_face_embedding(user_id):

    conn = get_db_connection()

    try:

        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT embedding_path
            FROM face_profiles
            WHERE user_id = ?
            """,
            (user_id,)
        )

        result = cursor.fetchone()

    finally:

        conn.close()

    if result is None:
        return None

    embedding_blob = result["embedding_path"]

    if embedding_blob is None:
        return None

    if len(embedding_blob) not in (
        EMBEDDING_DIM * 4,
        MAX_TEMPLATES * EMBEDDING_DIM * 4
    ):
        raise ValueError(
            "Stored face embedding has an invalid size."
        )

    embeddings = np.frombuffer(
        embedding_blob,
        dtype=np.float32
    ).copy()

    if len(embeddings) == EMBEDDING_DIM:

        return prepare_face_embeddings(
            embeddings
        )[0]

    embeddings = embeddings.reshape(
        MAX_TEMPLATES,
        EMBEDDING_DIM
    )

    return prepare_face_embeddings(
        embeddings
    )


def get_periocular_embedding(user_id):

    conn = get_db_connection()

    try:

        cursor = conn.cursor()

        cursor.execute(
            "PRAGMA table_info(face_profiles)"
        )

        columns = {
            row[1]
            for row in cursor.fetchall()
        }

        if (
            "periocular_embedding" not in columns
            or "periocular_dim" not in columns
        ):
            return None

        cursor.execute(
            """
            SELECT
                periocular_embedding,
                periocular_dim
            FROM face_profiles
            WHERE user_id = ?
            """,
            (user_id,)
        )

        result = cursor.fetchone()

    finally:

        conn.close()

    if result is None:
        return None

    embedding_blob = result["periocular_embedding"]
    dimension = result["periocular_dim"]

    if embedding_blob is None or dimension is None:
        return None

    dimension = int(dimension)

    if dimension <= 0:
        raise ValueError(
            "Invalid stored periocular dimension."
        )

    expected_bytes = (
        MAX_TEMPLATES * dimension * 4
    )

    if len(embedding_blob) != expected_bytes:
        raise ValueError(
            "Stored periocular embedding has an invalid size."
        )

    embeddings = np.frombuffer(
        embedding_blob,
        dtype=np.float32
    ).copy()

    embeddings = embeddings.reshape(
        MAX_TEMPLATES,
        dimension
    )

    return prepare_periocular_embeddings(
        embeddings
    )


def get_biometric_templates(user_id):

    return {
        "face": get_face_embedding(user_id),
        "periocular": get_periocular_embedding(user_id)
    }

-- DecliTrack Report Service — Initial Schema
-- V1: emotion_reports, session_alerts, track_reports

CREATE TABLE emotion_reports (
    id                     BIGSERIAL PRIMARY KEY,
    session_code           VARCHAR(255) NOT NULL,
    session_id             BIGINT,
    session_id_legacy      VARCHAR(255),
    generated_at           TIMESTAMP NOT NULL,
    student_login_identity VARCHAR(255),
    final_state            VARCHAR(255),
    final_sentence         VARCHAR(500),
    angry_mean             DOUBLE PRECISION,
    disgust_mean           DOUBLE PRECISION,
    fear_mean              DOUBLE PRECISION,
    happy_mean             DOUBLE PRECISION,
    sad_mean               DOUBLE PRECISION,
    surprise_mean          DOUBLE PRECISION,
    neutral_mean           DOUBLE PRECISION,
    dominant_emotion       VARCHAR(255),
    number_of_samples      INTEGER,
    instructor_note        VARCHAR(1000),
    status                 VARCHAR(50) DEFAULT 'IN_PROGRESS',
    created_at             TIMESTAMP,
    updated_at             TIMESTAMP,
    CONSTRAINT uq_report_session_student UNIQUE (session_code, student_login_identity)
);

CREATE TABLE session_alerts (
    id                     BIGSERIAL PRIMARY KEY,
    session_id             VARCHAR(255) NOT NULL,
    student_login_identity VARCHAR(255),
    alert_type             VARCHAR(50)  NOT NULL,
    severity               VARCHAR(50),
    message                VARCHAR(500),
    alert_timestamp        TIMESTAMP,
    tab_url                VARCHAR(1000),
    tab_title              VARCHAR(500),
    switch_count           INTEGER,
    created_at             TIMESTAMP
);

CREATE INDEX idx_session_alerts_session_student ON session_alerts (session_id, student_login_identity);
CREATE INDEX idx_session_alerts_session_id      ON session_alerts (session_id);

CREATE TABLE track_reports (
    id               BIGSERIAL PRIMARY KEY,
    session_id       VARCHAR(255),
    session_code     VARCHAR(255),
    student_identity VARCHAR(255),
    exercise_name    VARCHAR(255),
    conclusion       TEXT,
    created_at       TIMESTAMP
);

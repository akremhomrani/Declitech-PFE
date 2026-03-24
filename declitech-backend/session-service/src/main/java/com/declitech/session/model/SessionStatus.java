package com.declitech.session.model;

public enum SessionStatus {
    ACTIVE,      // Session is currently running
    ENDED,       // Session ended normally by instructor
    EXPIRED,     // Session time limit reached
    CANCELLED    // Session ended within 5 minutes of creation
}

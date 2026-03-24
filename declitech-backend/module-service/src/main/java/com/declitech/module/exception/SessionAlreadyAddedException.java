package com.declitech.module.exception;

public class SessionAlreadyAddedException extends RuntimeException {
    public SessionAlreadyAddedException(String message) {
        super(message);
    }

    public SessionAlreadyAddedException(Long sessionId, Long moduleId) {
        super("Session with ID " + sessionId + " is already added to module with ID " + moduleId);
    }
}

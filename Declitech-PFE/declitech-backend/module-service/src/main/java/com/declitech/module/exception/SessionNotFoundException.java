package com.declitech.module.exception;

public class SessionNotFoundException extends RuntimeException {
    public SessionNotFoundException(String message) {
        super(message);
    }

    public SessionNotFoundException(Long id) {
        super("Session not found with ID: " + id);
    }
}

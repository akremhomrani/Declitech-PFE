package com.declitech.user.exception;

public class InvalidUserDataException extends RuntimeException {
    public InvalidUserDataException(String message) {
        super(message);
    }

    public InvalidUserDataException(String field, String reason) {
        super(String.format("Invalid %s: %s", field, reason));
    }
}

package com.declitech.user.exception;

public class UserAlreadyExistsException extends RuntimeException {
    public UserAlreadyExistsException(String message) {
        super(message);
    }

    public UserAlreadyExistsException(String field, String value) {
        super(String.format("User already exists with %s: %s", field, value));
    }
}

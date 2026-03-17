package com.declitech.user.exception;

public class UserInactiveException extends RuntimeException {
    public UserInactiveException(String message) {
        super(message);
    }

    public UserInactiveException(Long userId) {
        super("User is inactive with ID: " + userId);
    }
}

package com.declitech.user.exception;

public class InvalidEmailFormatException extends RuntimeException {
    public InvalidEmailFormatException(String email) {
        super(String.format("Invalid email format: %s", email));
    }
}

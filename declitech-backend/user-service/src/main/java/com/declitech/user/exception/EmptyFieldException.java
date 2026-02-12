package com.declitech.user.exception;

public class EmptyFieldException extends RuntimeException {
    public EmptyFieldException(String fieldName) {
        super(String.format("Field '%s' cannot be empty or null", fieldName));
    }

    public EmptyFieldException(String message, String fieldName) {
        super(message);
    }
}

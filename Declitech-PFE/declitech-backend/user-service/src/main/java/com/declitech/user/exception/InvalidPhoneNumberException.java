package com.declitech.user.exception;

public class InvalidPhoneNumberException extends RuntimeException {
    public InvalidPhoneNumberException(String phoneNumber) {
        super(String.format("Invalid phone number format: %s", phoneNumber));
    }

    public InvalidPhoneNumberException(String phoneNumber, String reason) {
        super(String.format("Invalid phone number %s: %s", phoneNumber, reason));
    }
}

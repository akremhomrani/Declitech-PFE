package com.declitech.module.exception;

public class ModuleNotFoundException extends RuntimeException {
    public ModuleNotFoundException(String message) {
        super(message);
    }

    public ModuleNotFoundException(Long id) {
        super("Module not found with ID: " + id);
    }
}

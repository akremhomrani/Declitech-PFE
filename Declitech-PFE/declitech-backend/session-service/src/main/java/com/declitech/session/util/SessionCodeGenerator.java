package com.declitech.session.util;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
public class SessionCodeGenerator {

    private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int DEFAULT_LENGTH = 6;
    private final SecureRandom random = new SecureRandom();

    public String generateCode() {
        return generateCode(DEFAULT_LENGTH);
    }

    public String generateCode(int length) {
        StringBuilder code = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            code.append(CHARACTERS.charAt(random.nextInt(CHARACTERS.length())));
        }
        return code.toString();
    }
}

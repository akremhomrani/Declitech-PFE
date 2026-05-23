package com.declitech.session.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.text.ParseException;
import java.util.Base64;
import java.util.Date;

@Component
public class IamJwtVerifier {

    private final byte[] hmacSecret;

    public IamJwtVerifier(@Value("${jwt.secret}") String secret) {
        this.hmacSecret = Base64.getDecoder().decode(secret);
    }

    public JWTClaimsSet verify(String token) throws BadJOSEException, JOSEException, ParseException {
        String stripped = stripBearer(token);
        SignedJWT jwt = SignedJWT.parse(stripped);
        String alg = jwt.getHeader().getAlgorithm().getName();
        if (!alg.startsWith("HS")) {
            throw new BadJOSEException("Unsupported algorithm: " + alg);
        }
        JWSVerifier verifier = new MACVerifier(hmacSecret);
        if (!jwt.verify(verifier)) {
            throw new BadJOSEException("Signature verification failed");
        }
        JWTClaimsSet claims = jwt.getJWTClaimsSet();
        Date exp = claims.getExpirationTime();
        if (exp != null && !exp.after(new Date())) {
            throw new BadJOSEException("Token expired");
        }
        return claims;
    }

    private static String stripBearer(String token) {
        if (token == null) return null;
        return token.startsWith("Bearer ") ? token.substring(7) : token;
    }
}

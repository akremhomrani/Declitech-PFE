package com.declitech.session.controller;

import com.declitech.session.dto.IamSiteDto;
import com.declitech.session.service.IamReferentialService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/iam")
public class IamReferentialController {

    private final IamReferentialService iamReferentialService;

    public IamReferentialController(IamReferentialService iamReferentialService) {
        this.iamReferentialService = iamReferentialService;
    }

    @GetMapping("/sites")
    public ResponseEntity<List<IamSiteDto>> getSites() {
        return ResponseEntity.ok(iamReferentialService.getSites());
    }
}

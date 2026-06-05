package com.declitech.report.client;

import com.declitech.report.client.dto.ModuleView;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

@FeignClient(name = "module-service")
public interface ModuleDirectoryClient {

    @GetMapping("/api/modules")
    List<ModuleView> listModules();

    @GetMapping("/api/modules/{id}")
    ModuleView getModule(@PathVariable("id") Long id);
}

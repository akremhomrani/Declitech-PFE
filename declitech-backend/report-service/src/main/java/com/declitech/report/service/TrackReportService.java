package com.declitech.report.service;

import com.declitech.report.dto.TrackReportDTO;
import com.declitech.report.model.TrackReport;
import com.declitech.report.repository.TrackReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class TrackReportService {

    private final TrackReportRepository trackReportRepository;

    @Transactional
    public TrackReportDTO createTrackReport(TrackReportDTO request) {
        log.info("Creating formal tracked session report for student: {} in session: {}", request.getStudentIdentity(), request.getSessionCode());

        TrackReport report = TrackReport.builder()
                .sessionId(request.getSessionId())
                .sessionCode(request.getSessionCode())
                .studentIdentity(request.getStudentIdentity())
                .exerciseName(request.getExerciseName())
                .conclusion(request.getConclusion())
                .createdAt(request.getCreatedAt() != null ? request.getCreatedAt() : LocalDateTime.now())
                .build();

        report = trackReportRepository.save(report);
        return convertToDTO(report);
    }

    @Transactional(readOnly = true)
    public List<TrackReportDTO> getTrackReportsBySessionCode(String sessionCode) {
        return trackReportRepository.findBySessionCode(sessionCode)
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TrackReportDTO> getTrackReportsByStudentIdentity(String studentIdentity) {
        return trackReportRepository.findByStudentIdentity(studentIdentity)
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TrackReportDTO> getAllTrackReports() {
        return trackReportRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private TrackReportDTO convertToDTO(TrackReport report) {
        return TrackReportDTO.builder()
                .id(report.getId())
                .sessionId(report.getSessionId())
                .sessionCode(report.getSessionCode())
                .studentIdentity(report.getStudentIdentity())
                .exerciseName(report.getExerciseName())
                .conclusion(report.getConclusion())
                .createdAt(report.getCreatedAt())
                .build();
    }
}

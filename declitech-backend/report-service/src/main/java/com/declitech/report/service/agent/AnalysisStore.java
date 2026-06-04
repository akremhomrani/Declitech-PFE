package com.declitech.report.service.agent;

import com.declitech.report.dto.agent.ScreenAnalysisResult;
import com.declitech.report.dto.agent.SessionAnalysisSummary;

import java.util.List;

public interface AnalysisStore {

    void append(String sessionKey, String loginIdentity, ScreenAnalysisResult result);

    List<ScreenAnalysisResult> read(String sessionKey, String loginIdentity);

    void saveSummary(String sessionKey, String loginIdentity, SessionAnalysisSummary summary);

    SessionAnalysisSummary readSummary(String sessionKey, String loginIdentity);

    void clear(String sessionKey, String loginIdentity);
}

package com.declitech.report.dto;

public enum AlertType {
    TAB_SWITCH,           // Changement d'onglet
    MULTIPLE_SWITCHES,    // Changements d'onglets multiples
    OFF_PLATFORM,         // Navigation hors plateforme
    INACTIVITY,           // Inactivité prolongée
    LOW_ENGAGEMENT,       // Engagement faible
    DISTRACTION,          // Distraction détectée
    FOCUS_LOSS            // Perte de focus
}

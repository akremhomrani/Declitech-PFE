# Script de test pour déclencher une alerte manuellement

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Test Alerte Kafka + SSE Direct" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Récupérer le sessionId actuel depuis emotion_report.json
$reportPath = "d:\PFE-Declitech\declitech-agent\emotion_report.json"
if (Test-Path $reportPath) {
    $report = Get-Content $reportPath | ConvertFrom-Json
    $sessionId = $report.sessionId
    $participantId = $report.participantId
    Write-Host "✅ Session trouvée:" -ForegroundColor Green
    Write-Host "   SessionId: $sessionId" -ForegroundColor Cyan
    Write-Host "   ParticipantId: $participantId" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Aucune session active trouvée" -ForegroundColor Yellow
    Write-Host "   Utilisation de valeurs par défaut" -ForegroundColor Yellow
    $sessionId = "LOCAL-125835"
    $participantId = "LOCAL-E12"
}

Write-Host ""
Write-Host "Test 1: Envoi d'une activité avec 10 tab switches..." -ForegroundColor Yellow

$activityData = @{
    type = "TAB_SWITCHED"
    sessionId = $sessionId
    participantId = $participantId
    switchCount = 10
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    timeOnPlatform = 120
    timeOffPlatform = 30
    isOnPlatform = $false
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8081/api/participants/$participantId/activity" `
        -Method POST `
        -Body $activityData `
        -ContentType "application/json" `
        -UseBasicParsing
    
    Write-Host "✅ Activité envoyée avec succès!" -ForegroundColor Green
    Write-Host "   Une alerte HIGH devrait être publiée dans Kafka" -ForegroundColor Cyan
    Write-Host "   Message attendu: 'Multiple tab switches detected: 10'" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Erreur lors de l'envoi de l'activité" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Test 2: Envoi d'une activité hors plateforme..." -ForegroundColor Yellow

$offPlatformData = @{
    type = "TAB_SWITCHED"
    sessionId = $sessionId
    participantId = $participantId
    switchCount = 3
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    timeOnPlatform = 60
    timeOffPlatform = 90
    isOnPlatform = $false
    targetUrl = "https://www.youtube.com"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8081/api/participants/$participantId/activity" `
        -Method POST `
        -Body $offPlatformData `
        -ContentType "application/json" `
        -UseBasicParsing
    
    Write-Host "✅ Activité hors plateforme envoyée!" -ForegroundColor Green
    Write-Host "   Une alerte MEDIUM devrait être publiée" -ForegroundColor Cyan
    Write-Host "   Message attendu: 'Participant navigated off platform'" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Erreur lors de l'envoi" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test 3: Envoi d'une activité avec inactivité..." -ForegroundColor Yellow

$inactivityData = @{
    type = "ACTIVITY_UPDATE"
    sessionId = $sessionId
    participantId = $participantId
    switchCount = 1
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    timeOnPlatform = 200
    timeOffPlatform = 0
    isOnPlatform = $true
    mouseInactivitySeconds = 70
    keyboardInactivitySeconds = 65
    totalInactivitySeconds = 65
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8081/api/participants/$participantId/activity" `
        -Method POST `
        -Body $inactivityData `
        -ContentType "application/json" `
        -UseBasicParsing
    
    Write-Host "✅ Activité avec inactivité envoyée!" -ForegroundColor Green
    Write-Host "   Une alerte LOW devrait être publiée" -ForegroundColor Cyan
    Write-Host "   Message attendu: 'Participant inactive for 65 seconds'" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Erreur lors de l'envoi" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Vérification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Dans le dashboard (http://localhost:4200):" -ForegroundColor White
Write-Host "1. Rafraîchissez la page (F5)" -ForegroundColor White
Write-Host "2. Cherchez la carte du participant: $participantId" -ForegroundColor Yellow
Write-Host "3. Vous devriez voir des badges d'alerte rouges/ambre/bleus" -ForegroundColor White
Write-Host "4. Les messages d'alerte devraient s'afficher sous les infos" -ForegroundColor White
Write-Host ""
Write-Host "Console du navigateur (F12):" -ForegroundColor Cyan
Write-Host "  Cherchez: 🚨 Alert received:" -ForegroundColor White
Write-Host ""
Write-Host "Kafka Console Consumer:" -ForegroundColor Cyan
Write-Host "  .\kafka-console-consumer.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Kafka UI:" -ForegroundColor Cyan
Write-Host "  http://localhost:8090" -ForegroundColor White
Write-Host ""

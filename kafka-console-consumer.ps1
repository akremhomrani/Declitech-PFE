# Kafka Console Consumer - Pour voir les messages en temps réel

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Kafka Console Consumer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Topic: participant-alerts" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

docker exec -it declitech-kafka kafka-console-consumer `
    --bootstrap-server localhost:9092 `
    --topic participant-alerts `
    --from-beginning `
    --property print.timestamp=true `
    --property print.key=true `
    --property print.value=true

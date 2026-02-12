# Stop Kafka and Zookeeper

Write-Host "Stopping Kafka infrastructure..." -ForegroundColor Cyan

docker-compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Kafka infrastructure stopped successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to stop Kafka infrastructure" -ForegroundColor Red
    exit 1
}

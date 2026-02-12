# Start Kafka and Zookeeper using Docker Compose

Write-Host "Starting Kafka infrastructure..." -ForegroundColor Cyan

# Check if Docker is running
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: Docker is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# Start Docker Compose
Write-Host "Starting Kafka, Zookeeper, and Kafka UI..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Kafka infrastructure started successfully!" -ForegroundColor Green
    Write-Host "`nServices:" -ForegroundColor Cyan
    Write-Host "  - Zookeeper: localhost:2181" -ForegroundColor White
    Write-Host "  - Kafka: localhost:9092" -ForegroundColor White
    Write-Host "  - Kafka UI: http://localhost:8090" -ForegroundColor White
    Write-Host "`nWaiting for Kafka to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Write-Host "✅ Kafka should be ready now!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Failed to start Kafka infrastructure" -ForegroundColor Red
    exit 1
}

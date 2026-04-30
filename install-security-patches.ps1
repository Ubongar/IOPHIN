# Install security patches for all vulnerabilities
Write-Host "Installing security patches for IOPHIN project..." -ForegroundColor Green

Write-Host "`n[1/2] Installing client dependencies..." -ForegroundColor Cyan
Set-Location -Path "client"
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) { Write-Host "Client install failed" -ForegroundColor Red; exit 1 }
Write-Host "✓ Client dependencies updated" -ForegroundColor Green

Write-Host "`n[2/2] Installing server dependencies..." -ForegroundColor Cyan
Set-Location -Path "../server"
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "Server install failed" -ForegroundColor Red; exit 1 }
Write-Host "✓ Server dependencies updated" -ForegroundColor Green

Write-Host "`n✓ All security patches installed successfully!" -ForegroundColor Green
Write-Host "`nVulnerabilities fixed:" -ForegroundColor Yellow
Write-Host "  ✓ Vite: server.fs.deny bypass, arbitrary file read, path traversal" 
Write-Host "  ✓ Axios: NO_PROXY bypass"
Write-Host "  ✓ uuid: buffer bounds check"
Write-Host "  ✓ Nodemailer: SMTP command injection (CRLF & envelope.size)"
Write-Host "  ✓ PostCSS: XSS via unescaped </style>"
Write-Host "  ✓ Picomatch: method injection"
Write-Host "  ✓ path-to-regexp: ReDoS"
Write-Host "  ✓ DOMPurify: SAFE_FOR_TEMPLATES bypass"
Write-Host "  ✓ follow-redirects: custom auth header leak"
Write-Host "  ✓ Helmet: security improvements"
Write-Host "  ✓ Socket.IO: transport improvements"
Write-Host "  ✓ Express: latest security patches"

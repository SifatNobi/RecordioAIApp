Add-Type -AssemblyName System.Drawing

$logoPath = "E:\RecordioAI\RecordioAI\assets\logo.jpeg"
$assetsDir = "E:\RecordioAI\RecordioAI\assets"
$androidResDir = "E:\RecordioAI\RecordioAI\android\app\src\main\res"

# Load the logo image
$logo = [System.Drawing.Image]::FromFile($logoPath)
$origWidth = $logo.Width
$origHeight = $logo.Height
Write-Host "Original logo: ${origWidth}x${origHeight}"

# Create output directories
$densities = @(
    @{name="mdpi"; size=48; scale=1.0},
    @{name="hdpi"; size=72; scale=1.5},
    @{name="xhdpi"; size=96; scale=2.0},
    @{name="xxhdpi"; size=144; scale=3.0},
    @{name="xxxhdpi"; size=192; scale=4.0}
)

# Fix: remove the incorrectly created directory
$badDir = Join-Path $androidResDir "mipmap--v4"
if (Test-Path $badDir) {
    Remove-Item -Recurse -Force $badDir
}

# Resize function using high-quality interpolation
function Resize-Image {
    param($source, $targetWidth, $targetHeight, $backgroundColor = $null)
    
    $bitmap = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    
    if ($backgroundColor) {
        $brush = New-Object System.Drawing.SolidBrush($backgroundColor)
        $graphics.FillRectangle($brush, 0, 0, $targetWidth, $targetHeight)
    } else {
        $graphics.Clear([System.Drawing.Color]::Transparent)
    }
    
    # Calculate scaling to fit within bounds while maintaining aspect ratio
    $scale = [Math]::Min($targetWidth / $source.Width, $targetHeight / $source.Height)
    $drawWidth = [int]($source.Width * $scale)
    $drawHeight = [int]($source.Height * $scale)
    $x = ($targetWidth - $drawWidth) / 2
    $y = ($targetHeight - $drawHeight) / 2
    
    $graphics.DrawImage($source, $x, $y, $drawWidth, $drawHeight)
    $graphics.Dispose()
    return $bitmap
}

# Generate icons for each density
foreach ($density in $densities) {
    $size = $density.size
    $densityName = $density['name']
    $dirName = "mipmap-${densityName}-v4"
    $dirPath = Join-Path $androidResDir $dirName
    
    if (-not (Test-Path $dirPath)) {
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
    }
    
    # ic_launcher (main icon)
    $launcher = Resize-Image $logo $size $size
    $launcherPath = Join-Path $dirPath "ic_launcher.png"
    $launcher.Save($launcherPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $launcher.Dispose()
    Write-Host "Generated $dirName/ic_launcher.png (${size}x${size})"
    
    # ic_launcher_round (rounded icon)
    $round = Resize-Image $logo $size $size
    # Apply rounded corners
    $roundBitmap = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($roundBitmap)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $radius = $size * 0.25  # 25% corner radius for round icon
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $radius * 2, $radius * 2, 180, 90)
    $path.AddArc($size - $radius * 2, 0, $radius * 2, $radius * 2, 270, 90)
    $path.AddArc($size - $radius * 2, $size - $radius * 2, $radius * 2, $radius * 2, 0, 90)
    $path.AddArc(0, $size - $radius * 2, $radius * 2, $radius * 2, 90, 90)
    $path.CloseFigure()
    
    $g.SetClip($path)
    $g.DrawImage($round, 0, 0, $size, $size)
    $g.Dispose()
    $round.Dispose()
    
    $roundPath = Join-Path $dirPath "ic_launcher_round.png"
    $roundBitmap.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $roundBitmap.Dispose()
    Write-Host "Generated $dirName/ic_launcher_round.png (${size}x${size})"
    
    # ic_launcher_foreground (for adaptive icon - same as main but with safe zone)
    # For adaptive icon, the foreground should have padding for the safe zone (66% of total)
    $safeZoneRatio = 0.66
    $foregroundSize = [int]($size * $safeZoneRatio)
    $foreground = Resize-Image $logo $foregroundSize $foregroundSize
    $fgBitmap = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($fgBitmap)
    $g.Clear([System.Drawing.Color]::Transparent)
    $fgX = ($size - $foregroundSize) / 2
    $fgY = ($size - $foregroundSize) / 2
    $g.DrawImage($foreground, $fgX, $fgY, $foregroundSize, $foregroundSize)
    $g.Dispose()
    $foreground.Dispose()
    
    $fgPath = Join-Path $dirPath "ic_launcher_foreground.png"
    $fgBitmap.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fgBitmap.Dispose()
    Write-Host "Generated $dirName/ic_launcher_foreground.png (${size}x${size})"
    
    # ic_launcher_background (solid color background for adaptive icon)
    # Use a dark color matching the app theme
    $bgBitmap = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bgBitmap)
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0))  # Black background
    $g.Dispose()
    $bgPath = Join-Path $dirPath "ic_launcher_background.png"
    $bgBitmap.Save($bgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bgBitmap.Dispose()
    Write-Host "Generated $dirName/ic_launcher_background.png (${size}x${size})"
    
    # ic_launcher_monochrome (for Android 13+ themed icons)
    $monoBitmap = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($monoBitmap)
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Create a white silhouette of the logo
    $monoSize = [int]($size * 0.7)
    $mono = Resize-Image $logo $monoSize $monoSize
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Convert to grayscale and threshold for monochrome
    for ($y = 0; $y -lt $monoSize; $y++) {
        for ($x = 0; $x -lt $monoSize; $x++) {
            $pixel = $mono.GetPixel($x, $y)
            $gray = ([int]($pixel.R * 0.299 + $pixel.G * 0.587 + $pixel.B * 0.114))
            $alpha = if ($gray -lt 200) { 255 } else { 0 }
            if ($alpha -gt 0) {
                $monoBitmap.SetPixel(($size - $monoSize)/2 + $x, ($size - $monoSize)/2 + $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
            }
        }
    }
    $mono.Dispose()
    $g.Dispose()
    
    $monoPath = Join-Path $dirPath "ic_launcher_monochrome.png"
    $monoBitmap.Save($monoPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $monoBitmap.Dispose()
    Write-Host "Generated $dirName/ic_launcher_monochrome.png (${size}x${size})"
}

$logo.Dispose()

# Generate adaptive icon XML files
$anydpiDir = Join-Path $androidResDir "mipmap-anydpi-v26"
if (-not (Test-Path $anydpiDir)) {
    New-Item -ItemType Directory -Path $anydpiDir -Force | Out-Null
}

# ic_launcher.xml
$icLauncherXml = @"
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
"@
$icLauncherXml | Set-Content -Path (Join-Path $anydpiDir "ic_launcher.xml") -Encoding UTF8

# ic_launcher_round.xml
$icLauncherRoundXml = @"
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
"@
$icLauncherRoundXml | Set-Content -Path (Join-Path $anydpiDir "ic_launcher_round.xml") -Encoding UTF8

Write-Host "Generated adaptive icon XML files"
Write-Host "All icons generated successfully!"
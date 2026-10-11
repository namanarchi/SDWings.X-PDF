# Generate Professional Brand Icon for SDWings.X-PDF
Add-Type -AssemblyName System.Drawing

function Draw-SDXIcon([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Scale factors relative to 256px canvas
    $scale = $size / 256.0
    
    # 1. Rounded Rectangle Path (Squircle)
    $pad = [math]::Max(1, [math]::Round(12 * $scale))
    $w = $size - 2 * $pad
    $h = $size - 2 * $pad
    $rad = [math]::Max(2, [math]::Round(48 * $scale))
    
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($pad, $pad, $rad * 2, $rad * 2, 180, 90)
    $path.AddArc($pad + $w - $rad * 2, $pad, $rad * 2, $rad * 2, 270, 90)
    $path.AddArc($pad + $w - $rad * 2, $pad + $h - $rad * 2, $rad * 2, $rad * 2, 0, 90)
    $path.AddArc($pad, $pad + $h - $rad * 2, $rad * 2, $rad * 2, 90, 90)
    $path.CloseFigure()
    
    # 2. Premium Dark Titanium Gradient Fill
    $pt1 = New-Object System.Drawing.PointF([float]$pad, [float]$pad)
    $pt2 = New-Object System.Drawing.PointF([float]($pad + $w), [float]($pad + $h))
    $col1 = [System.Drawing.Color]::FromArgb(255, 30, 41, 59)   # Slate-800
    $col2 = [System.Drawing.Color]::FromArgb(255, 9, 13, 22)    # Obsidian Midnight
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($pt1, $pt2, $col1, $col2)
    $g.FillPath($gradBrush, $path)
    $gradBrush.Dispose()
    
    # 3. Outer Glow / Border (Vibrant Royal Cyan-Blue)
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 59, 130, 246), [math]::Max(1.0, 2.8 * $scale))
    $g.DrawPath($borderPen, $path)
    $borderPen.Dispose()
    
    # 4. Subtle CAD Blueprint Corner Ticks
    $cadPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 96, 165, 250), [math]::Max(1, 1.2 * $scale))
    $tickLen = 14 * $scale
    $g.DrawLine($cadPen, [float]($pad + 18 * $scale), [float]($pad + 26 * $scale), [float]($pad + 18 * $scale + $tickLen), [float]($pad + 26 * $scale))
    $g.DrawLine($cadPen, [float]($pad + 26 * $scale), [float]($pad + 18 * $scale), [float]($pad + 26 * $scale), [float]($pad + 18 * $scale + $tickLen))
    $g.DrawLine($cadPen, [float]($pad + $w - 18 * $scale - $tickLen), [float]($pad + $h - 26 * $scale), [float]($pad + $w - 18 * $scale), [float]($pad + $h - 26 * $scale))
    $g.DrawLine($cadPen, [float]($pad + $w - 26 * $scale), [float]($pad + $h - 18 * $scale - $tickLen), [float]($pad + $w - 26 * $scale), [float]($pad + $h - 18 * $scale))
    $cadPen.Dispose()
    
    # 5. Measure & Draw SDX Typography - Bold, Centered, Large and Prominent
    $fontSize = 88 * $scale
    $fontFamily = "Segoe UI"
    $fontStyle = [System.Drawing.FontStyle]::Bold
    
    try {
        $font = New-Object System.Drawing.Font($fontFamily, $fontSize, $fontStyle, [System.Drawing.GraphicsUnit]::Pixel)
    } catch {
        $font = New-Object System.Drawing.Font("Arial", $fontSize, $fontStyle, [System.Drawing.GraphicsUnit]::Pixel)
    }
    
    $format = [System.Drawing.StringFormat]::GenericTypographic
    $format.FormatFlags = $format.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces
    
    $sizeSD = $g.MeasureString("SD", $font, (New-Object System.Drawing.PointF(0, 0)), $format)
    $sizeX = $g.MeasureString("X", $font, (New-Object System.Drawing.PointF(0, 0)), $format)
    
    $totalTextWidth = $sizeSD.Width + $sizeX.Width
    $mainTextHeight = [math]::Max($sizeSD.Height, $sizeX.Height)
    
    # Subtext: P D F
    $subFontSize = 18 * $scale
    $subFont = New-Object System.Drawing.Font("Segoe UI", $subFontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subText = "P D F"
    $sizeSub = $g.MeasureString($subText, $subFont, (New-Object System.Drawing.PointF(0, 0)), $format)
    
    $gap = 6 * $scale
    $totalBlockHeight = $mainTextHeight + $gap + $sizeSub.Height
    
    $startY = ($size - $totalBlockHeight) / 2.0
    $startX = ($size - $totalTextWidth) / 2.0
    
    # Draw 'SD' in pure brilliant white
    $brushWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $g.DrawString("SD", $font, $brushWhite, [float]$startX, [float]$startY, $format)
    $brushWhite.Dispose()
    
    # Draw 'X' in vibrant royal blue
    $brushBlue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 59, 130, 246))
    $g.DrawString("X", $font, $brushBlue, [float]($startX + $sizeSD.Width), [float]$startY, $format)
    $brushBlue.Dispose()
    
    # Draw 'P D F' tag
    $subX = ($size - $sizeSub.Width) / 2.0
    $subY = $startY + $mainTextHeight + $gap
    $brushSub = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 148, 163, 184)) # Slate-400
    $g.DrawString($subText, $subFont, $brushSub, [float]$subX, [float]$subY, $format)
    $brushSub.Dispose()
    $subFont.Dispose()
    
    $font.Dispose()
    $path.Dispose()
    $g.Dispose()
    
    return $bmp
}

Write-Host "Rendering high-precision 256x256 SDX Master Brand Icon..." -ForegroundColor Cyan
$bmp256 = Draw-SDXIcon 256

# Save PNG master
$bmp256.Save("src-desktop/app-256.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Convert to native Win32 standard DIB ICO format (100% compatible with Inno Setup and WinForms)
$hIcon = $bmp256.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)

$fs = New-Object System.IO.FileStream("src-desktop/app.ico", [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()

# Synchronize app.ico across release and public
if (Test-Path "release/lightweight-win") {
    Copy-Item "src-desktop/app.ico" "release/lightweight-win/app.ico" -Force
}
Copy-Item "src-desktop/app.ico" "public/favicon.ico" -Force

$bmp256.Dispose()

Write-Host "Successfully generated and synchronized src-desktop/app.ico!" -ForegroundColor Green

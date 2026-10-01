package dev.starvelocity.app.ui

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

/**
 * The same palette as the web front end, so the two do not read as different
 * products. Material You is offered but not forced: a brand accent that changes
 * with the user's wallpaper stops being a brand accent.
 */

private val Accent = Color(0xFFCF2070)
private val AccentDark = Color(0xFFFF6FB5)

private val LightColors = lightColorScheme(
    primary = Accent,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFDEAF3),
    onPrimaryContainer = Color(0xFF7A0F40),
    secondary = Color(0xFF6A626E),
    background = Color(0xFFFCF9FB),
    onBackground = Color(0xFF191519),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF191519),
    surfaceVariant = Color(0xFFFAF4F7),
    onSurfaceVariant = Color(0xFF6A626E),
    outline = Color(0xFFDDD0D8),
    outlineVariant = Color(0xFFECE3E8),
    error = Color(0xFFB0362F),
)

private val DarkColors = darkColorScheme(
    primary = AccentDark,
    onPrimary = Color(0xFF3A0620),
    primaryContainer = Color(0xFF2A1523),
    onPrimaryContainer = Color(0xFFFFC7E2),
    secondary = Color(0xFF9198A1),
    background = Color(0xFF0D1117),
    onBackground = Color(0xFFE6EDF3),
    surface = Color(0xFF161B22),
    onSurface = Color(0xFFE6EDF3),
    surfaceVariant = Color(0xFF12161D),
    onSurfaceVariant = Color(0xFF9198A1),
    outline = Color(0xFF3A424F),
    outlineVariant = Color(0xFF2A303A),
    error = Color(0xFFF85149),
)

/** Repo names and figures are monospaced, matching the web. */
val MonoStyle = TextStyle(fontFamily = FontFamily.Monospace)

private val AppTypography = Typography().let { base ->
    base.copy(
        headlineLarge = base.headlineLarge.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold),
    )
}

/** What the user picked, independent of the system setting. */
enum class ThemeChoice { SYSTEM, LIGHT, DARK }

@Composable
fun StarVelocityTheme(
    choice: ThemeChoice = ThemeChoice.SYSTEM,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val dark = when (choice) {
        ThemeChoice.SYSTEM -> isSystemInDarkTheme()
        ThemeChoice.LIGHT -> false
        ThemeChoice.DARK -> true
    }

    val context = LocalContext.current
    val colors = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> DarkColors
        else -> LightColors
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Status-bar icons have to flip with the theme or they vanish
            // against the background.
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !dark
        }
    }

    MaterialTheme(colorScheme = colors, typography = AppTypography, content = content)
}

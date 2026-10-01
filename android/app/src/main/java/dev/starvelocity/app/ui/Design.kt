package dev.starvelocity.app.ui

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.starvelocity.app.R
import java.text.NumberFormat
import java.util.Locale

/**
 * Shared visual pieces and motion, kept in one file so the app reads as one
 * system rather than as a pile of default Material components.
 *
 * The motion rule throughout: springs for anything the user caused (selection,
 * touch) because it should feel physical, and short tweens for anything the app
 * caused (content arriving) because it should stay out of the way.
 */

/** Podium colours. Only the top three earn one. */
val Gold = Color(0xFFD9A441)
val Silver = Color(0xFFA9A6AD)
val Bronze = Color(0xFFBD7A4A)

fun podiumColor(rank: Int): Color? = when (rank) {
    1 -> Gold
    2 -> Silver
    3 -> Bronze
    else -> null
}

/** Grouped digits, in the reader's locale. 510091 is harder to read than 510,091. */
fun grouped(n: Number, locale: Locale = Locale.getDefault()): String =
    NumberFormat.getIntegerInstance(locale).format(n)

/**
 * A stable colour per language, so a language looks the same everywhere. Derived
 * from the name rather than a lookup table, which would go stale.
 */
fun languageColor(language: String?): Color {
    if (language == null) return Silver
    var hash = 0
    for (c in language) hash = (hash * 31 + c.code) % 360
    return Color.hsl(hash.toFloat(), 0.58f, 0.55f)
}

/** The app mark, sharing the launcher icon's artwork so the two never drift. */
@Composable
fun BrandMark(size: Dp = 28.dp, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(size)
            .clip(RoundedCornerShape(size / 3))
            .background(MaterialTheme.colorScheme.primary),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.Image(
            painter = painterResource(R.drawable.ic_launcher_foreground),
            contentDescription = null,
            modifier = Modifier.size(size * 1.55f),
        )
    }
}

/**
 * Segmented control with an indicator that slides between options.
 *
 * The slide is the point: it shows *which way* the selection moved, which a
 * cross-fade cannot. Measured with BoxWithConstraints so the indicator is
 * exactly one segment wide at any screen size.
 */
@Composable
fun SegmentedTabs(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(4.dp),
    ) {
        val segmentWidth = maxWidth / options.size
        val indicatorOffset by animateDpAsState(
            targetValue = segmentWidth * selectedIndex,
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessMediumLow,
            ),
            label = "segment-indicator",
        )

        Box(
            Modifier
                .offset(x = indicatorOffset)
                .width(segmentWidth)
                .height(38.dp)
                .clip(RoundedCornerShape(11.dp))
                .background(MaterialTheme.colorScheme.primary),
        )

        Row(Modifier.fillMaxWidth()) {
            options.forEachIndexed { i, label ->
                val selected = i == selectedIndex
                Box(
                    Modifier
                        .weight(1f)
                        .height(38.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = { onSelect(i) },
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        color = if (selected) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

/**
 * A repository's gain as a share of the fastest climber's.
 *
 * Rendered only when velocity actually exists — an absent bar is how the list
 * says "unknown", which is not the same statement as a bar of zero length.
 */
@Composable
fun VelocityBar(fraction: Float, modifier: Modifier = Modifier) {
    val animated by animateFloatAsState(
        targetValue = fraction.coerceIn(0f, 1f),
        animationSpec = tween(durationMillis = 650),
        label = "velocity-bar",
    )

    Box(
        modifier
            .fillMaxWidth()
            .height(3.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)),
    ) {
        Box(
            Modifier
                .fillMaxWidth(animated)
                .fillMaxHeight()
                .clip(RoundedCornerShape(999.dp))
                .background(MaterialTheme.colorScheme.primary),
        )
    }
}

/**
 * Fades and lifts content into place, staggered by position.
 *
 * The stagger is capped: past the first screenful the delay would only make the
 * list feel slow, and items composed during a scroll should appear immediately.
 */
@Composable
fun AnimatedEntry(index: Int, content: @Composable () -> Unit) {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }

    val progress by animateFloatAsState(
        targetValue = if (shown) 1f else 0f,
        animationSpec = tween(
            durationMillis = 320,
            delayMillis = (index.coerceAtMost(8)) * 35,
        ),
        label = "entry",
    )

    Box(
        Modifier
            .alpha(progress)
            .offset(y = ((1f - progress) * 14).dp),
    ) {
        content()
    }
}

/** Scales slightly while held, so a tap feels like it landed on something. */
@Composable
fun rememberPressScale(interactionSource: MutableInteractionSource): Float {
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.975f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessHigh),
        label = "press-scale",
    )
    return scale
}

/** Convenience so call sites read as one modifier rather than three lines. */
fun Modifier.pressScale(scale: Float): Modifier = this.scale(scale)

/** Muted metadata text, used instead of chips to keep the cards quiet. */
@Composable
fun MetaText(text: String, color: Color? = null) {
    Text(
        text,
        style = MonoStyle.copy(fontSize = 11.5.sp),
        color = color ?: MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

/** Small dot used as a language swatch. */
@Composable
fun Dot(color: Color, size: Dp = 7.dp) {
    Box(
        Modifier
            .size(size)
            .clip(RoundedCornerShape(999.dp))
            .background(color),
    )
}

@Composable
fun MetaRow(content: @Composable () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        content = { content() },
    )
}

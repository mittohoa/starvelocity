package dev.starvelocity.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import dev.starvelocity.app.R
import dev.starvelocity.app.data.Basis
import dev.starvelocity.app.data.LanguageEntry
import dev.starvelocity.app.data.Repo
import dev.starvelocity.app.data.Window
import kotlin.math.abs
import kotlin.math.roundToInt

fun compact(n: Number): String {
    val v = n.toDouble()
    val a = abs(v)
    return when {
        a >= 1_000_000 -> String.format("%.1fM", v / 1_000_000)
        a >= 10_000 -> "${(v / 1_000).roundToInt()}k"
        a >= 1_000 -> String.format("%.1fk", v / 1_000)
        else -> v.roundToInt().toString()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    state: FeedState,
    onWindow: (Window) -> Unit,
    onLanguage: (LanguageEntry?) -> Unit,
    onRefresh: () -> Unit,
    onOpen: (Repo) -> Unit,
    modifier: Modifier = Modifier,
) {
    val windows = Window.entries

    // Every bar is drawn as a share of the fastest climber, so the list shows
    // the shape of the distribution rather than just its order.
    val maxDelta = remember(state.repos) {
        state.repos.mapNotNull { it.delta }.maxOrNull() ?: 0.0
    }

    Column(modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 18.dp).padding(bottom = 14.dp)) {
            state.meta?.let { meta ->
                Text(
                    "${grouped(meta.repos)} ${stringResource(R.string.repos_tracked)} · " +
                        "${meta.snapshotDays} ${stringResource(R.string.days_of_history)}",
                    style = MonoStyle.copy(fontSize = 11.5.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))
            }

            SegmentedTabs(
                options = windows.map {
                    when (it) {
                        Window.DAY -> stringResource(R.string.window_day)
                        Window.WEEK -> stringResource(R.string.window_week)
                        Window.MONTH -> stringResource(R.string.window_month)
                    }
                },
                selectedIndex = windows.indexOf(state.window),
                onSelect = { onWindow(windows[it]) },
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (state.languages.isNotEmpty()) {
            LanguageFilterRow(state.languages, state.languageFilter, onLanguage)
        }

        PullToRefreshBox(
            isRefreshing = state.refreshing,
            onRefresh = onRefresh,
            modifier = Modifier.fillMaxSize(),
        ) {
            when {
                state.loading && state.repos.isEmpty() -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) { CircularProgressIndicator(strokeWidth = 2.dp) }

                state.error != null && state.repos.isEmpty() -> Box(
                    Modifier.fillMaxSize().padding(28.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        stringResource(R.string.error_offline, state.error),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                // Keyed on what was asked for, so switching window or language
                // dissolves between two lists instead of snapping.
                else -> Crossfade(
                    targetState = state.window to state.languageFilter?.slug,
                    animationSpec = tween(220),
                    label = "feed",
                ) { _ ->
                    LazyColumn(
                        contentPadding = PaddingValues(
                            start = 18.dp, end = 18.dp, bottom = 32.dp,
                        ),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        item { StatusBanner(state) }
                        itemsIndexed(state.repos, key = { _, r -> r.id }) { i, repo ->
                            AnimatedEntry(i) {
                                RepoCard(
                                    repo = repo,
                                    rank = i + 1,
                                    basis = state.basis,
                                    window = state.window,
                                    maxDelta = maxDelta,
                                    onClick = { onOpen(repo) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LanguageFilterRow(
    languages: List<LanguageEntry>,
    selected: LanguageEntry?,
    onSelect: (LanguageEntry?) -> Unit,
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(bottom = 14.dp),
    ) {
        item {
            FilterPill(
                label = stringResource(R.string.filter_all),
                selected = selected == null,
                dot = null,
                onClick = { onSelect(null) },
            )
        }
        items(languages, key = { it.slug }) { lang ->
            FilterPill(
                label = lang.language,
                selected = selected?.slug == lang.slug,
                dot = languageColor(lang.language),
                onClick = { onSelect(if (selected?.slug == lang.slug) null else lang) },
            )
        }
    }
}

@Composable
private fun FilterPill(
    label: String,
    selected: Boolean,
    dot: Color?,
    onClick: () -> Unit,
) {
    // Weight and a border carry the selected state; a filled pill next to
    // twenty unfilled ones is louder than the filter deserves.
    val borderAlpha by animateFloatAsState(
        targetValue = if (selected) 1f else 0f,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "pill-border",
    )

    Row(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .border(
                width = 1.5.dp,
                color = MaterialTheme.colorScheme.primary.copy(alpha = borderAlpha),
                shape = RoundedCornerShape(999.dp),
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        if (dot != null) Dot(dot)
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color = if (selected) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * States what the list is actually ordered by, and whether it came from cache.
 * Presenting a stars ranking as velocity would be the one thing this product
 * cannot afford to do.
 */
@Composable
private fun StatusBanner(state: FeedState) {
    val stale = state.staleAgeMillis?.let { it > 6 * 60 * 60 * 1000L } == true
    val visible = state.basis == Basis.STARS || stale

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(240)) + expandVertically(tween(240)),
        exit = fadeOut(tween(160)) + shrinkVertically(tween(160)),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.08f))
                .padding(16.dp),
        ) {
            Box(
                Modifier
                    .width(3.dp)
                    .height(44.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(MaterialTheme.colorScheme.primary),
            )
            Spacer(Modifier.width(14.dp))
            Column {
                if (state.basis == Basis.STARS) {
                    Text(
                        stringResource(R.string.velocity_pending_title),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(5.dp))
                    Text(
                        stringResource(
                            R.string.velocity_pending_body,
                            state.meta?.snapshotDays ?: 0,
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (stale) {
                    val hours = (state.staleAgeMillis ?: 0L) / 3_600_000
                    Text(
                        stringResource(R.string.showing_cached, hours),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun RepoCard(
    repo: Repo,
    rank: Int,
    basis: Basis,
    window: Window,
    maxDelta: Double,
    onClick: () -> Unit,
) {
    val hasVelocity = basis == Basis.VELOCITY && repo.delta != null
    val interaction = remember { MutableInteractionSource() }
    val scale = rememberPressScale(interaction)

    Column(
        Modifier
            .fillMaxWidth()
            .pressScale(scale)
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(
                interactionSource = interaction,
                indication = null,
                onClick = onClick,
            )
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Rank as plain type. A chip around every number is furniture; the
            // podium colours alone carry the top three.
            Text(
                rank.toString().padStart(2, '0'),
                style = MonoStyle.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                color = podiumColor(rank) ?: MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.width(14.dp))

            AsyncImage(
                model = repo.avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)),
            )
            Spacer(Modifier.width(12.dp))

            Column(Modifier.weight(1f)) {
                Text(
                    repo.owner,
                    style = MonoStyle.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    repo.name,
                    style = MonoStyle.copy(fontSize = 16.sp, fontWeight = FontWeight.Bold),
                    maxLines = 1,
                    // Without this a long slug is clipped mid-word and the
                    // repository name disappears entirely.
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Spacer(Modifier.width(10.dp))

            // The one loud element per card: the gain when it exists, an
            // explicit "unknown" when it does not. Never a zero.
            if (hasVelocity) {
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "+${compact(repo.delta!!)}",
                        style = MonoStyle.copy(fontSize = 19.sp, fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        "★ / ${window.label}",
                        style = MonoStyle.copy(fontSize = 9.5.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                Text(
                    stringResource(R.string.not_yet_known),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        repo.description?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(12.dp))
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Spacer(Modifier.height(14.dp))

        MetaRow {
            MetaText("★ ${compact(repo.stars)}")
            MetaText("·")
            MetaText("⑂ ${compact(repo.forks)}")
            repo.language?.let {
                MetaText("·")
                Dot(languageColor(it))
                MetaText(it)
            }
        }

        if (hasVelocity && maxDelta > 0) {
            Spacer(Modifier.height(14.dp))
            VelocityBar(fraction = (repo.delta!! / maxDelta).toFloat())
        }
    }
}

@Composable
fun RepoDetail(repo: Repo, basis: Basis, modifier: Modifier = Modifier) {
    Column(modifier.padding(horizontal = 22.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AsyncImage(
                model = repo.avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(54.dp).clip(RoundedCornerShape(16.dp)),
            )
            Spacer(Modifier.width(14.dp))
            Column {
                Text(
                    repo.owner,
                    style = MonoStyle.copy(fontSize = 12.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    repo.name,
                    style = MonoStyle.copy(fontSize = 21.sp, fontWeight = FontWeight.Bold),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        repo.description?.let {
            Spacer(Modifier.height(16.dp))
            Text(it, style = MaterialTheme.typography.bodyMedium)
        }

        Spacer(Modifier.height(20.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatTile(
                label = stringResource(R.string.stars),
                value = grouped(repo.stars),
                modifier = Modifier.weight(1f),
            )
            StatTile(
                label = stringResource(R.string.velocity_7d),
                value = if (basis == Basis.VELOCITY && repo.delta != null) {
                    "+${compact(repo.delta)}"
                } else {
                    stringResource(R.string.not_yet_known)
                },
                accent = basis == Basis.VELOCITY && repo.delta != null,
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(18.dp))
        Fact(stringResource(R.string.forks), grouped(repo.forks))
        repo.language?.let { Fact(stringResource(R.string.language), it) }
        repo.license?.takeIf { it != "NOASSERTION" }?.let {
            Fact(stringResource(R.string.license), it)
        }

        if (repo.topics.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(repo.topics, key = { it }) { topic ->
                    Text(
                        "#$topic",
                        style = MonoStyle.copy(fontSize = 11.5.sp),
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
        Spacer(Modifier.height(10.dp))
    }
}

@Composable
private fun StatTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    accent: Boolean = false,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(18.dp))
            .background(
                if (accent) MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)
                else MaterialTheme.colorScheme.surfaceVariant,
            )
            .padding(16.dp),
    ) {
        Text(
            value,
            style = MonoStyle.copy(fontSize = 20.sp, fontWeight = FontWeight.Bold),
            color = if (accent) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(3.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun Fact(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(value, style = MonoStyle.copy(fontSize = 13.sp, fontWeight = FontWeight.Medium))
    }
}

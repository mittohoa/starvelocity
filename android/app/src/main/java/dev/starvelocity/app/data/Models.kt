package dev.starvelocity.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire format of the static JSON API emitted by the web build.
 *
 * Nullable numbers are load-bearing: `delta` is null when the collector does not
 * yet have enough history to derive that window. Defaulting it to 0 would tell
 * the user a repository gained nothing, which is a different claim entirely.
 */

@Serializable
data class Repo(
    val id: Long,
    val fullName: String,
    val owner: String,
    val name: String,
    val description: String? = null,
    val language: String? = null,
    val license: String? = null,
    val topics: List<String> = emptyList(),
    val stars: Int,
    val forks: Int,
    val pushedAt: String? = null,
    val delta: Double? = null,
    val ratePerDay: Double? = null,
    val accel: Double? = null,
) {
    val avatarUrl: String get() = "https://github.com/$owner.png?size=120"
    val githubUrl: String get() = "https://github.com/$fullName"
}

/** Which figure the server actually ranked by. */
enum class Basis { VELOCITY, STARS, UNKNOWN }

@Serializable
data class Ranking(
    val window: String,
    @SerialName("basis") val basisRaw: String,
    val snapshotDate: String? = null,
    val repos: List<Repo> = emptyList(),
) {
    val basis: Basis
        get() = when (basisRaw) {
            "velocity" -> Basis.VELOCITY
            "stars" -> Basis.STARS
            else -> Basis.UNKNOWN
        }
}

@Serializable
data class VelocityResolved(
    @SerialName("1d") val d1: Int = 0,
    @SerialName("7d") val d7: Int = 0,
    @SerialName("30d") val d30: Int = 0,
)

@Serializable
data class Meta(
    val apiVersion: Int = 0,
    val generatedAt: String? = null,
    val repos: Int = 0,
    val snapshotDays: Int = 0,
    val firstDay: String? = null,
    val lastDay: String? = null,
    val velocityResolved: VelocityResolved = VelocityResolved(),
)

@Serializable
data class LanguageEntry(
    val language: String,
    val slug: String,
    val repos: Int,
    val stars: Long,
)

@Serializable
data class Languages(
    val generatedAt: String? = null,
    val languages: List<LanguageEntry> = emptyList(),
)

/** The three ranking windows the API publishes. */
enum class Window(val path: String, val label: String) {
    DAY("1d", "1d"),
    WEEK("7d", "7d"),
    MONTH("30d", "30d"),
}

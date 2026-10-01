package dev.starvelocity.app.data

import android.content.Context
import dev.starvelocity.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Fetches the static JSON API, with a cache on disk.
 *
 * Offline-first on purpose: the data only changes twice a day, so a cached copy
 * is almost always current, and a commuter on the underground should still see
 * yesterday's ranking rather than an error screen.
 *
 * HttpURLConnection rather than a client library — there are five GET requests
 * in the whole app, and an extra dependency would not earn its place.
 */
class Repository(context: Context) {

    private val cacheDir = File(context.cacheDir, "api").apply { mkdirs() }

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    /** Where a response came from, so the UI can be honest about staleness. */
    enum class Source { NETWORK, CACHE }

    data class Result<T>(val value: T, val source: Source, val ageMillis: Long)

    private fun cacheFile(path: String) = File(cacheDir, path.replace('/', '_'))

    private fun download(path: String): String {
        val url = URL(BuildConfig.API_BASE.trimEnd('/') + "/" + path)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
        }
        try {
            val code = conn.responseCode
            if (code !in 200..299) throw IOException("HTTP $code for $path")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    /**
     * Returns parsed JSON, preferring the network and falling back to cache.
     * Throws only when there is neither — a stale answer beats no answer.
     */
    private suspend inline fun <reified T> load(path: String, forceRefresh: Boolean): Result<T> =
        withContext(Dispatchers.IO) {
            val file = cacheFile(path)

            if (!forceRefresh && file.exists()) {
                val age = System.currentTimeMillis() - file.lastModified()
                // The collector publishes twice a day; re-fetching more often
                // than every few hours just spends the user's data plan.
                if (age < CACHE_FRESH_MILLIS) {
                    runCatching { json.decodeFromString<T>(file.readText()) }
                        .onSuccess { return@withContext Result(it, Source.CACHE, age) }
                }
            }

            try {
                val body = download(path)
                val parsed = json.decodeFromString<T>(body)
                file.writeText(body)
                Result(parsed, Source.NETWORK, 0L)
            } catch (e: Exception) {
                if (!file.exists()) throw e
                val age = System.currentTimeMillis() - file.lastModified()
                Result(json.decodeFromString<T>(file.readText()), Source.CACHE, age)
            }
        }

    suspend fun meta(forceRefresh: Boolean = false): Result<Meta> =
        load("meta.json", forceRefresh)

    suspend fun trending(window: Window, forceRefresh: Boolean = false): Result<Ranking> =
        load("trending-${window.path}.json", forceRefresh)

    suspend fun languages(forceRefresh: Boolean = false): Result<Languages> =
        load("languages.json", forceRefresh)

    suspend fun byLanguage(slug: String, forceRefresh: Boolean = false): Result<Ranking> =
        load("lang/$slug.json", forceRefresh)

    companion object {
        private const val CACHE_FRESH_MILLIS = 3 * 60 * 60 * 1000L // 3 hours
    }
}

package dev.starvelocity.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import dev.starvelocity.app.data.Basis
import dev.starvelocity.app.data.LanguageEntry
import dev.starvelocity.app.data.Meta
import dev.starvelocity.app.data.Repo
import dev.starvelocity.app.data.Repository
import dev.starvelocity.app.data.Window
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class FeedState(
    val window: Window = Window.WEEK,
    val languageFilter: LanguageEntry? = null,
    val repos: List<Repo> = emptyList(),
    val basis: Basis = Basis.UNKNOWN,
    val meta: Meta? = null,
    val languages: List<LanguageEntry> = emptyList(),
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    /** Set when the list came from cache; null when it is fresh from network. */
    val staleAgeMillis: Long? = null,
    val error: String? = null,
)

class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = Repository(app)

    private val _state = MutableStateFlow(FeedState())
    val state: StateFlow<FeedState> = _state.asStateFlow()

    init {
        load(force = false)
    }

    fun selectWindow(window: Window) {
        if (window == _state.value.window) return
        _state.update { it.copy(window = window, loading = true, error = null) }
        load(force = false)
    }

    fun selectLanguage(language: LanguageEntry?) {
        _state.update { it.copy(languageFilter = language, loading = true, error = null) }
        load(force = false)
    }

    fun refresh() {
        _state.update { it.copy(refreshing = true, error = null) }
        load(force = true)
    }

    private fun load(force: Boolean) = viewModelScope.launch {
        val current = _state.value
        try {
            val ranking = current.languageFilter
                ?.let { repo.byLanguage(it.slug, force) }
                ?: repo.trending(current.window, force)

            val meta = runCatching { repo.meta(force).value }.getOrNull()
            val languages = runCatching { repo.languages(force).value.languages }
                .getOrDefault(current.languages)

            _state.update {
                it.copy(
                    repos = ranking.value.repos,
                    basis = ranking.value.basis,
                    meta = meta ?: it.meta,
                    languages = languages,
                    loading = false,
                    refreshing = false,
                    staleAgeMillis = if (ranking.source == Repository.Source.CACHE) ranking.ageMillis else null,
                    error = null,
                )
            }
        } catch (e: Exception) {
            // Nothing cached and the network failed: the only case where the
            // user genuinely has to see an error rather than stale data.
            _state.update {
                it.copy(
                    loading = false,
                    refreshing = false,
                    error = e.message ?: e::class.simpleName ?: "unknown error",
                )
            }
        }
    }
}

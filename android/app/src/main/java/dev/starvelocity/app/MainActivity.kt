package dev.starvelocity.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.foundation.background
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.starvelocity.app.data.Repo
import dev.starvelocity.app.ui.AppViewModel
import dev.starvelocity.app.ui.BrandMark
import dev.starvelocity.app.ui.FeedScreen
import dev.starvelocity.app.ui.RepoDetail
import dev.starvelocity.app.ui.StarVelocityTheme
import dev.starvelocity.app.ui.ThemeChoice
import dev.starvelocity.app.work.DigestScheduler

class MainActivity : ComponentActivity() {

    private val viewModel: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        DigestScheduler.ensureScheduled(applicationContext)

        setContent {
            // Survives rotation; a real deployment would persist it to
            // DataStore so it survives process death too.
            var themeChoice by rememberSaveable { mutableStateOf(ThemeChoice.SYSTEM) }

            StarVelocityTheme(choice = themeChoice) {
                AppScaffold(
                    viewModel = viewModel,
                    themeChoice = themeChoice,
                    onThemeChoice = { themeChoice = it },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@androidx.compose.runtime.Composable
private fun AppScaffold(
    viewModel: AppViewModel,
    themeChoice: ThemeChoice,
    onThemeChoice: (ThemeChoice) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var selected by remember { mutableStateOf<Repo?>(null) }
    var menuOpen by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    androidx.compose.foundation.layout.Row(
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    ) {
                        BrandMark(size = 30.dp)
                        androidx.compose.foundation.layout.Spacer(Modifier.width(11.dp))
                        Text(
                            stringResource(R.string.app_name),
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                            letterSpacing = (-0.5).sp,
                        )
                    }
                },
                colors = androidx.compose.material3.TopAppBarDefaults.topAppBarColors(
                    containerColor = androidx.compose.ui.graphics.Color.Transparent,
                ),
                actions = {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(
                            painter = androidx.compose.ui.res.painterResource(R.drawable.ic_theme),
                            contentDescription = stringResource(R.string.theme),
                        )
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        listOf(
                            ThemeChoice.SYSTEM to R.string.theme_system,
                            ThemeChoice.LIGHT to R.string.theme_light,
                            ThemeChoice.DARK to R.string.theme_dark,
                        ).forEach { (choice, label) ->
                            DropdownMenuItem(
                                text = { Text(stringResource(label)) },
                                onClick = {
                                    onThemeChoice(choice)
                                    menuOpen = false
                                },
                                trailingIcon = {
                                    if (choice == themeChoice) Text("✓")
                                },
                            )
                        }
                    }
                },
            )
        },
    ) { padding ->
        FeedScreen(
            state = state,
            onWindow = viewModel::selectWindow,
            onLanguage = viewModel::selectLanguage,
            onRefresh = viewModel::refresh,
            onOpen = { selected = it },
            modifier = Modifier.fillMaxSize().padding(padding),
        )
    }

    selected?.let { repo ->
        ModalBottomSheet(onDismissRequest = { selected = null }, sheetState = sheetState) {
            RepoDetail(repo = repo, basis = state.basis)
            DropdownMenuItem(
                text = { Text(stringResource(R.string.open_on_github)) },
                onClick = {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(repo.githubUrl)))
                },
            )
        }
    }
}

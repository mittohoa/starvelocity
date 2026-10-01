import java.util.Properties

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.kotlin.serialization)
}

// Signing material lives outside the repository. Read it if present; leave the
// release build unsigned if not, so a developer without the key can still
// compile. CI supplies the same four values through environment variables.
val keystoreProperties = Properties().apply {
  val file = rootProject.file("keystore.properties")
  if (file.exists()) file.inputStream().use { load(it) }
}

fun signingValue(key: String, env: String): String? =
  (keystoreProperties.getProperty(key) ?: System.getenv(env))?.takeIf { it.isNotBlank() }

val signingStoreFile = signingValue("storeFile", "ANDROID_KEYSTORE_FILE")
val signingStorePassword = signingValue("storePassword", "ANDROID_KEYSTORE_PASSWORD")
val signingKeyAlias = signingValue("keyAlias", "ANDROID_KEY_ALIAS")
val signingKeyPassword = signingValue("keyPassword", "ANDROID_KEY_PASSWORD")
val canSignRelease =
  signingStoreFile != null &&
    signingStorePassword != null &&
    signingKeyAlias != null &&
    signingKeyPassword != null &&
    rootProject.file(signingStoreFile).exists()

android {
  namespace = "dev.starvelocity.app"
  // Compose BOM 2026.09 requires compiling against API 37 or later.
  compileSdk = 37

  defaultConfig {
    applicationId = "dev.starvelocity.app"
    minSdk = 26
    // Google Play requires new releases to target API 36 or later.
    targetSdk = 36
    versionCode = 1
    versionName = "0.1.0"

    // Where the client reads its data. Points at the static JSON the web build
    // emits, so the app needs no server of its own. Override per build type or
    // in a local override when testing against a different deployment.
    buildConfigField(
      "String",
      "API_BASE",
      "\"${project.findProperty("starvelocity.apiBase") ?: "https://starvelocity.example/api/"}\"",
    )
  }

  signingConfigs {
    if (canSignRelease) {
      create("release") {
        storeFile = rootProject.file(signingStoreFile!!)
        storePassword = signingStorePassword
        keyAlias = signingKeyAlias
        keyPassword = signingKeyPassword
        // Play requires v2; v1 is dead weight above minSdk 24.
        enableV1Signing = false
        enableV2Signing = true
      }
    }
  }

  buildTypes {
    debug {
      applicationIdSuffix = ".debug"
    }
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      signingConfig = if (canSignRelease) signingConfigs.getByName("release") else null
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }
}

// Say it once, at configuration time, rather than letting an unsigned bundle be
// discovered at the upload step.
if (!canSignRelease) {
  logger.lifecycle("release signing: no key configured — release output will be unsigned")
}

dependencies {
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.activity.compose)

  implementation(platform(libs.androidx.compose.bom))
  implementation(libs.androidx.ui)
  implementation(libs.androidx.ui.graphics)
  implementation(libs.androidx.ui.tooling.preview)
  implementation(libs.androidx.material3)
  debugImplementation(libs.androidx.ui.tooling)

  implementation(libs.kotlinx.serialization.json)
  implementation(libs.coil.compose)
  implementation(libs.androidx.work.runtime.ktx)
  implementation(libs.androidx.datastore.preferences)
}

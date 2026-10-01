# kotlinx.serialization keeps its descriptors in companion objects that R8
# cannot see are used; without these the release build fails at runtime.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keepclassmembers class dev.starvelocity.app.data.** {
    *** Companion;
}
-keepclasseswithmembers class dev.starvelocity.app.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}

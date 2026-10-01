package dev.starvelocity.app.work

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.starvelocity.app.MainActivity
import dev.starvelocity.app.R
import dev.starvelocity.app.data.Basis
import dev.starvelocity.app.data.Repository
import dev.starvelocity.app.data.Window
import java.util.concurrent.TimeUnit

/**
 * Daily digest.
 *
 * Refreshes the cache in the background — so opening the app is instant — and
 * posts one notification naming the repositories that actually climbed.
 *
 * It stays silent when velocity is not yet derivable. A notification saying
 * "here are the biggest repositories" is not news; it is the same list as
 * yesterday, and that is how an app earns itself a permanent mute.
 */
class DigestWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val repo = Repository(applicationContext)

        val ranking = try {
            repo.trending(Window.DAY, forceRefresh = true).value
        } catch (e: Exception) {
            // Transient network trouble: let WorkManager back off and retry.
            return Result.retry()
        }

        // Warm the rest of the cache while the radio is already awake.
        runCatching { repo.trending(Window.WEEK, forceRefresh = true) }
        runCatching { repo.meta(forceRefresh = true) }

        if (ranking.basis != Basis.VELOCITY || ranking.repos.isEmpty()) return Result.success()

        val top = ranking.repos.take(3)
        val body = top.joinToString(", ") { r ->
            val gained = r.delta?.let { "+${it.toInt()}" } ?: "?"
            "${r.name} $gained★"
        }
        notify(applicationContext, body)
        return Result.success()
    }

    private fun notify(context: Context, body: String) {
        val manager = NotificationManagerCompat.from(context)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    context.getString(R.string.channel_digest),
                    NotificationManager.IMPORTANCE_LOW,
                ).apply { description = context.getString(R.string.channel_digest_desc) },
            )
        }

        // Posting without the runtime permission on API 33+ silently does
        // nothing, so check rather than pretending it worked.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val intent = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.digest_title))
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(intent)
            .setAutoCancel(true)
            .build()

        manager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        const val CHANNEL_ID = "daily_digest"
        const val NOTIFICATION_ID = 1001
    }
}

object DigestScheduler {
    private const val WORK_NAME = "daily_digest"

    /**
     * KEEP rather than UPDATE: re-registering on every launch would reset the
     * period each time and the digest would never actually fire.
     */
    fun ensureScheduled(context: Context) {
        val request = PeriodicWorkRequestBuilder<DigestWorker>(1, TimeUnit.DAYS)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .build()

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }
}

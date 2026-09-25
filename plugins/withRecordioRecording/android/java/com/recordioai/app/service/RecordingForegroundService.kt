package com.recordioai.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.recordioai.app.R
import com.recordioai.app.module.RecordingServiceModule
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RecordingForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "recording_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START_RECORDING = "com.recordioai.app.START_RECORDING"
        const val ACTION_STOP_RECORDING = "com.recordioai.app.STOP_RECORDING"
        const val ACTION_PAUSE_RECORDING = "com.recordioai.app.PAUSE_RECORDING"
        const val ACTION_RESUME_RECORDING = "com.recordioai.app.RESUME_RECORDING"
        const val EXTRA_OUTPUT_PATH = "output_path"
        const val EXTRA_RECORDING_TYPE = "recording_type"
        const val EVENT_RECORDING_STATE = "RecordingState"
        const val EVENT_RECORDING_PROGRESS = "RecordingProgress"
        const val EVENT_RECORDING_COMPLETE = "RecordingComplete"
        const val EVENT_RECORDING_ERROR = "RecordingError"

        @Volatile
        private var currentState: String = "idle"
        @Volatile
        private var currentDuration: Int = 0
        @Volatile
        private var currentPaused: Boolean = false
        @Volatile
        private var currentRecordingType: String = "conversation"

        @JvmStatic
        fun getCurrentState(): String = currentState

        @JvmStatic
        fun getCurrentDuration(): Int = currentDuration

        @JvmStatic
        fun getCurrentPaused(): Boolean = currentPaused

        @JvmStatic
        fun getCurrentRecordingType(): String = currentRecordingType
    }

    private var mediaRecorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startTime: Long = 0
    private var accumulatedDuration: Long = 0
    private var isRecording = false
    private var isPaused = false
    private var recordingType = "conversation"
    private val updateRunnable = object : Runnable {
        override fun run() {
            updateNotification()
            if (isRecording) {
                handler.postDelayed(this, 1000)
            }
        }
    }
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    private fun effectiveDurationMillis(): Long {
        if (!isRecording || isPaused || startTime <= 0) return accumulatedDuration
        return accumulatedDuration + (System.currentTimeMillis() - startTime)
    }

    private fun effectiveDurationSeconds(): Long = effectiveDurationMillis() / 1000

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_NOT_STICKY

        when (intent.action) {
            ACTION_START_RECORDING -> {
                val outputPath = intent.getStringExtra(EXTRA_OUTPUT_PATH)
                recordingType = intent.getStringExtra(EXTRA_RECORDING_TYPE) ?: "conversation"
                startRecording(outputPath)
            }
            ACTION_STOP_RECORDING -> {
                stopRecording()
                stopSelf()
            }
            ACTION_PAUSE_RECORDING -> {
                pauseRecording()
            }
            ACTION_RESUME_RECORDING -> {
                resumeRecording()
            }
        }
        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Recording Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Foreground service for audio recording"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotificationIntent(action: String): PendingIntent {
        val intent = Intent(this, RecordingForegroundService::class.java).apply {
            this.action = action
        }
        return PendingIntent.getService(
            this,
            action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun buildNotification(): Notification {
        val stopIntent = createNotificationIntent(ACTION_STOP_RECORDING)
        val pauseIntent = if (isPaused) {
            createNotificationIntent(ACTION_RESUME_RECORDING)
        } else {
            createNotificationIntent(ACTION_PAUSE_RECORDING)
        }

        val elapsed = if (isRecording) effectiveDurationMillis() else 0L

        val minutes = (elapsed / 1000 / 60) % 60
        val seconds = (elapsed / 1000) % 60
        val timeString = String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds)

        val title = when (recordingType) {
            "phone_call" -> "Recording Phone Call"
            else -> "Recording Conversation"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText("Duration: $timeString")
            .setSmallIcon(R.drawable.ic_notification_recording)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(
                NotificationCompat.Action.Builder(
                    R.drawable.ic_pause,
                    if (isPaused) "Resume" else "Pause",
                    pauseIntent
                ).build()
            )
            .addAction(
                NotificationCompat.Action.Builder(
                    R.drawable.ic_stop,
                    "Stop",
                    stopIntent
                ).build()
            )
            .build()
    }

    private fun updateNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification())
        sendProgressEvent()
    }

    private fun startRecording(outputPath: String?) {
        if (isRecording) return

        try {
            val directory = if (outputPath != null) {
                File(outputPath).parentFile
            } else {
                getExternalFilesDir(android.os.Environment.DIRECTORY_MUSIC)
            }

            if (directory != null && !directory.exists()) {
                directory.mkdirs()
            }

            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val fileName = "recording_${recordingType}_$timestamp.m4a"
            outputFile = File(directory!!, fileName)

            mediaRecorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setOutputFile(outputFile!!.absolutePath)
                prepare()
                start()
            }

            isRecording = true
            isPaused = false
            startTime = System.currentTimeMillis()
            accumulatedDuration = 0
            currentState = "recording"
            currentDuration = 0
            currentPaused = false
            currentRecordingType = recordingType

            startForeground(NOTIFICATION_ID, buildNotification())
            sendStateEvent("recording")
            handler.postDelayed(updateRunnable, 1000)

            Log.d("RecordingService", "Recording started: ${outputFile!!.absolutePath}")

        } catch (e: IOException) {
            Log.e("RecordingService", "Failed to start recording", e)
            sendErrorEvent("Failed to start recording: ${e.message}")
            stopSelf()
        } catch (e: Exception) {
            Log.e("RecordingService", "Unexpected error starting recording", e)
            sendErrorEvent("Unexpected error: ${e.message}")
            stopSelf()
        }
    }

    private fun pauseRecording() {
        if (!isRecording || isPaused) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            mediaRecorder?.pause()
            if (startTime > 0) {
                accumulatedDuration += System.currentTimeMillis() - startTime
                startTime = 0
            }
            isPaused = true
            currentPaused = true
            currentState = "paused"
            sendStateEvent("paused")
            updateNotification()
        }
    }

    private fun resumeRecording() {
        if (!isRecording || !isPaused) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            mediaRecorder?.resume()
            isPaused = false
            currentPaused = false
            currentState = "recording"
            startTime = System.currentTimeMillis()
            sendStateEvent("recording")
            updateNotification()
        }
    }

    private fun stopRecording() {
        if (!isRecording) return

        handler.removeCallbacks(updateRunnable)

        try {
            mediaRecorder?.stop()
            mediaRecorder?.reset()
            mediaRecorder?.release()
            mediaRecorder = null

            isRecording = false
            isPaused = false
            val filePath = outputFile?.absolutePath
            val duration = effectiveDurationSeconds()
            startTime = 0
            accumulatedDuration = 0
            currentState = "stopped"
            currentPaused = false

            stopForeground(true)
            sendStateEvent("stopped")
            sendCompleteEvent(filePath, duration)

            Log.d("RecordingService", "Recording stopped: $filePath, duration: ${duration}s")

        } catch (e: Exception) {
            Log.e("RecordingService", "Error stopping recording", e)
            sendErrorEvent("Error stopping recording: ${e.message}")
        }
    }

    private fun sendStateEvent(state: String) {
        val params = Arguments.createMap().apply {
            putString("state", state)
            putString("recordingType", recordingType)
        }
        sendEvent(EVENT_RECORDING_STATE, params)
    }

    private fun sendProgressEvent() {
        currentDuration = effectiveDurationSeconds().toInt()

        val params = Arguments.createMap().apply {
            putInt("duration", currentDuration)
            putBoolean("isPaused", isPaused)
            putString("recordingType", recordingType)
        }
        sendEvent(EVENT_RECORDING_PROGRESS, params)
    }

    private fun sendCompleteEvent(filePath: String?, duration: Long) {
        val params = Arguments.createMap().apply {
            putString("filePath", filePath ?: "")
            putInt("duration", duration.toInt())
            putString("recordingType", recordingType)
        }
        sendEvent(EVENT_RECORDING_COMPLETE, params)
    }

    private fun sendErrorEvent(error: String) {
        val params = Arguments.createMap().apply {
            putString("error", error)
            putString("recordingType", recordingType)
        }
        sendEvent(EVENT_RECORDING_ERROR, params)
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        val reactContext = RecordingServiceModule.getReactContext()
        if (reactContext != null) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler.removeCallbacks(updateRunnable)
        if (isRecording) {
            stopRecording()
        }
        super.onDestroy()
    }
}
package nz.org.jwtalk.teleprompter.speech

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Permission
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class StartArgs {
    var locale: String? = "en-US"
}

@TauriPlugin(
    permissions = [Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")]
)
class SpeechRecognitionPlugin(private val activity: Activity) : Plugin(activity), RecognitionListener {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var recognitionIntent: Intent? = null
    private var shouldListen = false
    private var paused = false
    private var destroyed = false

    @Command
    fun isAvailable(invoke: Invoke) {
        val response = JSObject()
        response.put("available", SpeechRecognizer.isRecognitionAvailable(activity))
        invoke.resolve(response)
    }

    @Command
    fun start(invoke: Invoke) {
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            invoke.reject("Microphone permission is required for voice following.")
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            invoke.reject("No Android speech recognition service is available.")
            return
        }

        val args = invoke.parseArgs(StartArgs::class.java)
        shouldListen = true
        paused = false
        destroyed = false
        mainHandler.post {
            createRecognizer(args.locale ?: "en-US")
            beginListening()
        }
        invoke.resolve(operationResponse(true))
    }

    @Command
    fun stop(invoke: Invoke) {
        shouldListen = false
        mainHandler.removeCallbacksAndMessages(null)
        mainHandler.post {
            recognizer?.cancel()
            recognizer?.destroy()
            recognizer = null
            emitStatus("off")
        }
        invoke.resolve(operationResponse(false))
    }

    override fun onPause() {
        paused = true
        mainHandler.removeCallbacksAndMessages(null)
        if (shouldListen) recognizer?.cancel()
    }

    override fun onResume() {
        paused = false
        if (shouldListen) scheduleRestart(250)
    }

    override fun onDestroy(activity: androidx.appcompat.app.AppCompatActivity) {
        destroyed = true
        shouldListen = false
        mainHandler.removeCallbacksAndMessages(null)
        recognizer?.destroy()
        recognizer = null
    }

    private fun createRecognizer(locale: String) {
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(activity).also {
            it.setRecognitionListener(this)
        }
        recognitionIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1200L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 700L)
        }
    }

    private fun beginListening() {
        if (!shouldListen || paused || destroyed) return
        try {
            recognizer?.startListening(recognitionIntent)
            emitStatus("listening")
        } catch (error: RuntimeException) {
            emitError("Could not start speech recognition: ${error.message ?: "unknown error"}")
            scheduleRestart(900)
        }
    }

    private fun scheduleRestart(delayMs: Long = 350) {
        if (!shouldListen || paused || destroyed) return
        mainHandler.removeCallbacksAndMessages(null)
        mainHandler.postDelayed({ beginListening() }, delayMs)
    }

    private fun emitTranscript(bundle: Bundle?, isFinal: Boolean) {
        val alternatives = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val transcript = alternatives?.firstOrNull()?.trim().orEmpty()
        if (transcript.isEmpty()) return
        val payload = JSObject()
        payload.put("transcript", transcript)
        payload.put("isFinal", isFinal)
        trigger("result", payload)
    }

    private fun emitStatus(status: String) {
        val payload = JSObject()
        payload.put("status", status)
        trigger("status", payload)
    }

    private fun emitError(message: String) {
        val payload = JSObject()
        payload.put("message", message)
        trigger("error", payload)
    }

    private fun operationResponse(active: Boolean): JSObject {
        val response = JSObject()
        response.put("active", active)
        return response
    }

    override fun onReadyForSpeech(params: Bundle?) = emitStatus("listening")
    override fun onBeginningOfSpeech() = emitStatus("hearing")
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() = emitStatus("processing")
    override fun onPartialResults(partialResults: Bundle?) = emitTranscript(partialResults, false)
    override fun onResults(results: Bundle?) {
        emitTranscript(results, true)
        scheduleRestart()
    }
    override fun onEvent(eventType: Int, params: Bundle?) = Unit

    override fun onError(error: Int) {
        when (error) {
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> scheduleRestart(
                if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) 700 else 250
            )
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> {
                shouldListen = false
                emitError("Microphone permission was denied.")
            }
            else -> {
                emitStatus("uncertain")
                scheduleRestart(700)
            }
        }
    }
}

package com.axonhk.axoncase

import android.app.Activity
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Opens the rear camera, takes one still as soon as ready, and finishes.
 * No second shutter / confirm — field WebView shutter stays one tap.
 */
class StillCaptureActivity : AppCompatActivity() {
    private var imageCapture: ImageCapture? = null
    private var cameraExecutor: ExecutorService? = null
    private var capturing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val path = intent.getStringExtra(EXTRA_OUTPUT_PATH)
        if (path.isNullOrBlank()) {
            setResult(Activity.RESULT_CANCELED)
            finish()
            return
        }
        val outFile = File(path)

        val previewView =
            PreviewView(this).apply {
                layoutParams =
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT,
                    )
                scaleType = PreviewView.ScaleType.FILL_CENTER
                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            }
        setContentView(previewView)

        cameraExecutor = Executors.newSingleThreadExecutor()
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener(
            {
                try {
                    bindAndShoot(cameraProviderFuture.get(), previewView, outFile)
                } catch (e: Exception) {
                    Log.e(TAG, "camera bind failed", e)
                    fail()
                }
            },
            ContextCompat.getMainExecutor(this),
        )
    }

    private fun bindAndShoot(
        cameraProvider: ProcessCameraProvider,
        previewView: PreviewView,
        outFile: File,
    ) {
        val preview =
            Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }
        imageCapture =
            ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

        cameraProvider.unbindAll()
        try {
            cameraProvider.bindToLifecycle(
                this,
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                imageCapture,
            )
        } catch (e: Exception) {
            Log.e(TAG, "bindToLifecycle failed", e)
            fail()
            return
        }

        previewView.postDelayed({ takeStill(outFile) }, 320)
    }

    private fun takeStill(outFile: File) {
        if (capturing) return
        val capture = imageCapture ?: return fail()
        capturing = true
        outFile.parentFile?.mkdirs()

        val options = ImageCapture.OutputFileOptions.Builder(outFile).build()
        capture.takePicture(
            options,
            cameraExecutor ?: ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    runOnUiThread {
                        setResult(Activity.RESULT_OK, intent)
                        finish()
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.e(TAG, "capture failed", exception)
                    runOnUiThread { fail() }
                }
            },
        )
    }

    private fun fail() {
        setResult(Activity.RESULT_CANCELED)
        finish()
    }

    override fun onDestroy() {
        cameraExecutor?.shutdown()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "StillCapture"
        const val EXTRA_OUTPUT_PATH = "com.axonhk.axoncase.EXTRA_OUTPUT_PATH"

        fun outputUriExtra(): String = android.provider.MediaStore.EXTRA_OUTPUT
    }
}

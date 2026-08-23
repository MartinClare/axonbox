package com.axonhk.axoncase

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.axonhk.axoncase.databinding.ActivityMainBinding
import java.io.File

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    internal lateinit var phoneGeo: PhoneGeo
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraOutputUri: Uri? = null
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null

    private val startUrl: String
        get() = BuildConfig.AXON_BASE_URL.trimEnd('/') + BuildConfig.AXON_START_PATH

    private val hostAllowed: String
        get() = Uri.parse(BuildConfig.AXON_BASE_URL).host.orEmpty()

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback
            filePathCallback = null
            if (callback == null) return@registerForActivityResult
            val fromPicker = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            when {
                result.resultCode != RESULT_OK -> callback.onReceiveValue(null)
                !fromPicker.isNullOrEmpty() -> callback.onReceiveValue(fromPicker)
                cameraOutputUri != null -> callback.onReceiveValue(arrayOf(cameraOutputUri!!))
                else -> callback.onReceiveValue(null)
            }
            cameraOutputUri = null
        }

    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (!granted) {
                Toast.makeText(this, R.string.camera_permission_needed, Toast.LENGTH_SHORT).show()
            }
        }

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            val ok = grants.values.any { it }
            phoneGeo.permissionDenied = !ok
            if (ok) {
                phoneGeo.startCompass()
                phoneGeo.startLocation()
            }
            pendingGeoCallback?.invoke(pendingGeoOrigin, ok, ok)
            pendingGeoCallback = null
            pendingGeoOrigin = null
            if (!ok) {
                Toast.makeText(this, R.string.location_permission_needed, Toast.LENGTH_SHORT).show()
            }
        }

    private val runtimePermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { /* WebView retries */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        phoneGeo = PhoneGeo(this)
        setupWebView()
        if (savedInstanceState != null) {
            binding.webView.restoreState(savedInstanceState)
        } else {
            binding.webView.loadUrl(startUrl)
        }
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (binding.webView.canGoBack()) binding.webView.goBack() else finish()
                }
            },
        )
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        binding.webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        phoneGeo.startCompass()
        if (phoneGeo.hasLocationPermission()) phoneGeo.startLocation()
    }

    override fun onPause() {
        phoneGeo.stop()
        super.onPause()
    }

    override fun onDestroy() {
        phoneGeo.stop()
        binding.webView.destroy()
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(binding.webView, true)

        binding.webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            setGeolocationEnabled(true)
            userAgentString = "$userAgentString AxonCaseAndroid/${BuildConfig.VERSION_NAME}"
        }
        binding.webView.addJavascriptInterface(AxonJsBridge(this), "AxonNative")

        binding.webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val scheme = uri.scheme.orEmpty()
                if (scheme == "tel" || scheme == "mailto" || scheme == "sms") {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
                val host = uri.host.orEmpty()
                if (host.isNotEmpty() && host != hostAllowed && !host.endsWith(".railway.app")) {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
                return false
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                if (request.isForMainFrame) {
                    Toast.makeText(this@MainActivity, R.string.offline_title, Toast.LENGTH_LONG).show()
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                binding.progressBar.visibility = View.GONE
            }
        }

        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                binding.progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                binding.progressBar.progress = newProgress
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                val needed = mutableListOf<String>()
                if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
                    !hasPermission(Manifest.permission.CAMERA)
                ) {
                    needed += Manifest.permission.CAMERA
                }
                if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
                    !hasPermission(Manifest.permission.RECORD_AUDIO)
                ) {
                    needed += Manifest.permission.RECORD_AUDIO
                }
                if (needed.isNotEmpty()) {
                    runtimePermissionLauncher.launch(needed.toTypedArray())
                }
                request.grant(request.resources)
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback,
            ) {
                if (phoneGeo.hasLocationPermission()) {
                    phoneGeo.startLocation()
                    callback.invoke(origin, true, true)
                    return
                }
                pendingGeoOrigin = origin
                pendingGeoCallback = callback
                ensureLocationPermission()
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                if (!hasPermission(Manifest.permission.CAMERA)) {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
                return launchChooser(fileChooserParams)
            }
        }

        binding.webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                addRequestHeader("User-Agent", userAgent)
                val cookies = CookieManager.getInstance().getCookie(url)
                if (!cookies.isNullOrBlank()) addRequestHeader("Cookie", cookies)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
                setTitle(name)
            }
            val manager = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
            manager.enqueue(request)
        })
    }

    private fun launchChooser(params: WebChromeClient.FileChooserParams?): Boolean {
        // Shutter uses <input capture> → open the camera app only.
        // Album uses a plain file input → open the picker only.
        // Never show the Camera/Files chooser sheet.
        val intent =
            if (params?.isCaptureEnabled == true) {
                cameraIntent()
            } else {
                cameraOutputUri = null
                params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }
            }
        if (intent == null) {
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null
            return false
        }
        return try {
            fileChooserLauncher.launch(intent)
            true
        } catch (_: Exception) {
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null
            cameraOutputUri = null
            false
        }
    }

    private fun cameraIntent(): Intent? {
        val photo = File(cacheDir, "capture-${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(this, "$packageName.files", photo)
        cameraOutputUri = uri
        // One-shot CameraX capture — no system camera shutter/confirm.
        return Intent(this, StillCaptureActivity::class.java).apply {
            putExtra(StillCaptureActivity.EXTRA_OUTPUT_PATH, photo.absolutePath)
            putExtra(android.provider.MediaStore.EXTRA_OUTPUT, uri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    fun ensureLocationPermission() {
        if (phoneGeo.hasLocationPermission()) {
            phoneGeo.permissionDenied = false
            phoneGeo.startCompass()
            phoneGeo.startLocation()
            return
        }
        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ),
        )
    }

    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }
}

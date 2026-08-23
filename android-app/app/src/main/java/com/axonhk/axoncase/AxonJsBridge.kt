package com.axonhk.axoncase

import android.webkit.JavascriptInterface

class AxonJsBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun latestGeo(): String = activity.phoneGeo.snapshotJson()

    @JavascriptInterface
    fun hasLocationPermission(): Boolean = activity.phoneGeo.hasLocationPermission()

    @JavascriptInterface
    fun requestLocationPermission() {
        activity.runOnUiThread { activity.ensureLocationPermission() }
    }
}

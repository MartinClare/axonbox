package com.axonhk.axoncase

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.view.Surface
import android.view.WindowManager
import androidx.core.content.ContextCompat
import org.json.JSONObject
import kotlin.math.roundToInt

/** GPS position plus the direction the phone / rear camera is pointing. */
class PhoneGeo(private val context: Context) : LocationListener, SensorEventListener {
    @Volatile var lat: Double? = null
        private set
    @Volatile var lng: Double? = null
        private set
    @Volatile var headingDeg: Int? = null
        private set
    @Volatile var permissionDenied: Boolean = false

    private val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val rotationVector = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    private val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

    private val rotationMatrix = FloatArray(9)
    private val remapped = FloatArray(9)
    private val orientation = FloatArray(3)
    private val accelValues = FloatArray(3)
    private val magnetValues = FloatArray(3)
    private var hasAccel = false
    private var hasMagnet = false
    private var locating = false
    private var sensing = false

    fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    fun startCompass() {
        if (sensing) return
        sensing = true
        if (rotationVector != null) {
            sensorManager.registerListener(this, rotationVector, SensorManager.SENSOR_DELAY_UI)
        } else {
            accelerometer?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI) }
            magnetometer?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI) }
        }
    }

    fun startLocation() {
        if (!hasLocationPermission()) return
        permissionDenied = false
        if (locating) return
        locating = true
        try {
            val last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            last?.let { applyLocation(it) }
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    800L,
                    0.5f,
                    this,
                    Looper.getMainLooper(),
                )
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    1500L,
                    2f,
                    this,
                    Looper.getMainLooper(),
                )
            }
        } catch (_: SecurityException) {
            locating = false
        }
    }

    fun stop() {
        if (locating) {
            locationManager.removeUpdates(this)
            locating = false
        }
        if (sensing) {
            sensorManager.unregisterListener(this)
            sensing = false
        }
    }

    fun snapshotJson(): String {
        val o = JSONObject()
        o.put("lat", lat ?: JSONObject.NULL)
        o.put("lng", lng ?: JSONObject.NULL)
        o.put("headingDeg", headingDeg ?: JSONObject.NULL)
        o.put("denied", permissionDenied)
        return o.toString()
    }

    override fun onLocationChanged(location: Location) {
        applyLocation(location)
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

    override fun onProviderEnabled(provider: String) = Unit

    override fun onProviderDisabled(provider: String) = Unit

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR -> {
                SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
                applyHeadingFromMatrix(rotationMatrix)
            }
            Sensor.TYPE_ACCELEROMETER -> {
                System.arraycopy(event.values, 0, accelValues, 0, 3)
                hasAccel = true
                if (hasMagnet && SensorManager.getRotationMatrix(rotationMatrix, null, accelValues, magnetValues)) {
                    applyHeadingFromMatrix(rotationMatrix)
                }
            }
            Sensor.TYPE_MAGNETIC_FIELD -> {
                System.arraycopy(event.values, 0, magnetValues, 0, 3)
                hasMagnet = true
                if (hasAccel && SensorManager.getRotationMatrix(rotationMatrix, null, accelValues, magnetValues)) {
                    applyHeadingFromMatrix(rotationMatrix)
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun applyLocation(location: Location) {
        lat = location.latitude
        lng = location.longitude
    }

    private fun applyHeadingFromMatrix(matrix: FloatArray) {
        val rotation = displayRotation()
        val (axisX, axisY) = when (rotation) {
            Surface.ROTATION_90 -> SensorManager.AXIS_Z to SensorManager.AXIS_MINUS_X
            Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_MINUS_Z
            Surface.ROTATION_270 -> SensorManager.AXIS_MINUS_Z to SensorManager.AXIS_X
            else -> SensorManager.AXIS_X to SensorManager.AXIS_Z
        }
        SensorManager.remapCoordinateSystem(matrix, axisX, axisY, remapped)
        SensorManager.getOrientation(remapped, orientation)
        var azimuth = Math.toDegrees(orientation[0].toDouble())
        if (azimuth < 0) azimuth += 360.0
        headingDeg = azimuth.roundToInt() % 360
    }

    private fun displayRotation(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            context.display?.rotation ?: Surface.ROTATION_0
        } else {
            @Suppress("DEPRECATION")
            (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.rotation
        }
    }
}

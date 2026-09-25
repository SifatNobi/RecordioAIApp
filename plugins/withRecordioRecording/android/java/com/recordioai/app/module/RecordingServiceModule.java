package com.recordioai.app.module;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.recordioai.app.service.RecordingForegroundService;

public class RecordingServiceModule extends ReactContextBaseJavaModule {

    private static final int PERMISSION_REQUEST_CODE = 1001;

    private static ReactApplicationContext sReactContext;

    public RecordingServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        sReactContext = reactContext;
    }

    public static ReactApplicationContext getReactContext() {
        return sReactContext;
    }

    @Override
    public String getName() {
        return "RecordingServiceModule";
    }

    @ReactMethod
    public void startRecording(String outputPath, String recordingType, Promise promise) {
        try {
            if (!hasRecordAudioPermission()) {
                promise.resolve(successMap(false, "RECORD_AUDIO permission not granted"));
                return;
            }

            Intent serviceIntent = new Intent(getReactApplicationContext(), RecordingForegroundService.class);
            serviceIntent.setAction(RecordingForegroundService.ACTION_START_RECORDING);
            if (outputPath != null && !outputPath.isEmpty()) {
                serviceIntent.putExtra(RecordingForegroundService.EXTRA_OUTPUT_PATH, outputPath);
            }
            if (recordingType != null && !recordingType.isEmpty()) {
                serviceIntent.putExtra(RecordingForegroundService.EXTRA_RECORDING_TYPE, recordingType);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getReactApplicationContext().startForegroundService(serviceIntent);
            } else {
                getReactApplicationContext().startService(serviceIntent);
            }

            promise.resolve(successMap(true, null));
        } catch (Exception e) {
            promise.resolve(successMap(false, e.getMessage()));
        }
    }

    @ReactMethod
    public void stopRecording(Promise promise) {
        try {
            Intent serviceIntent = new Intent(getReactApplicationContext(), RecordingForegroundService.class);
            serviceIntent.setAction(RecordingForegroundService.ACTION_STOP_RECORDING);
            getReactApplicationContext().startService(serviceIntent);
            promise.resolve(successMap(true, null));
        } catch (Exception e) {
            promise.resolve(successMap(false, e.getMessage()));
        }
    }

    @ReactMethod
    public void pauseRecording(Promise promise) {
        try {
            Intent serviceIntent = new Intent(getReactApplicationContext(), RecordingForegroundService.class);
            serviceIntent.setAction(RecordingForegroundService.ACTION_PAUSE_RECORDING);
            getReactApplicationContext().startService(serviceIntent);
            promise.resolve(successMap(true, null));
        } catch (Exception e) {
            promise.resolve(successMap(false, e.getMessage()));
        }
    }

    @ReactMethod
    public void resumeRecording(Promise promise) {
        try {
            Intent serviceIntent = new Intent(getReactApplicationContext(), RecordingForegroundService.class);
            serviceIntent.setAction(RecordingForegroundService.ACTION_RESUME_RECORDING);
            getReactApplicationContext().startService(serviceIntent);
            promise.resolve(successMap(true, null));
        } catch (Exception e) {
            promise.resolve(successMap(false, e.getMessage()));
        }
    }

    @ReactMethod
    public void getRecordingState(Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putString("state", RecordingForegroundService.getCurrentState());
        map.putInt("duration", RecordingForegroundService.getCurrentDuration());
        map.putBoolean("isPaused", RecordingForegroundService.getCurrentPaused());
        map.putString("recordingType", RecordingForegroundService.getCurrentRecordingType());
        promise.resolve(map);
    }

    @ReactMethod
    public void requestPermissions(Promise promise) {
        if (hasRecordAudioPermission()) {
            promise.resolve(permissionMap(true, null));
            return;
        }
        promise.resolve(permissionMap(false, "Use PermissionsAndroid from JS to request microphone access"));
    }

    private boolean hasRecordAudioPermission() {
        Context context = getReactApplicationContext();
        return ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private static WritableMap successMap(boolean success, String error) {
        WritableMap map = Arguments.createMap();
        map.putBoolean("success", success);
        if (error != null) {
            map.putString("error", error);
        }
        return map;
    }

    private static WritableMap permissionMap(boolean granted, String error) {
        WritableMap map = Arguments.createMap();
        map.putBoolean("granted", granted);
        if (error != null) {
            map.putString("error", error);
        }
        return map;
    }
}
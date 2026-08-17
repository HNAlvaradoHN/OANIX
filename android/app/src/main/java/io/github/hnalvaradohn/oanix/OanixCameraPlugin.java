package io.github.hnalvaradohn.oanix;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@CapacitorPlugin(name = "OanixCamera")
public class OanixCameraPlugin extends Plugin {
    private static final long MAX_CAPTURE_BYTES = 24L * 1024L * 1024L;
    private static final String CAPTURE_PREFIX = "oanix-camera-";
    private static final String CAPTURE_SUFFIX = ".jpg";
    private static final int URI_FLAGS = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
    private static final String STATE_CAPTURE_PATH = "oanixCameraCapturePath";
    private static final String STATE_CAPTURE_URI = "oanixCameraCaptureUri";

    private File pendingCaptureFile;
    private Uri pendingCaptureUri;
    private boolean captureActive = false;

    @Override
    public void load() {
        cleanupStaleCaptures();
    }

    private void cleanupStaleCaptures() {
        File cacheDir = getContext().getCacheDir();
        File[] files = cacheDir.listFiles((dir, name) -> name.startsWith(CAPTURE_PREFIX) && name.endsWith(CAPTURE_SUFFIX));
        if (files == null) return;

        long cutoff = System.currentTimeMillis() - (24L * 60L * 60L * 1000L);
        for (File file : files) {
            if (file.lastModified() < cutoff) {
                // Best-effort cleanup only. Cache files contain no data that OANIX relies on after import.
                file.delete();
            }
        }
    }

    private File createCaptureFile() throws IOException {
        return File.createTempFile(CAPTURE_PREFIX, CAPTURE_SUFFIX, getContext().getCacheDir());
    }

    private Uri uriForCapture(File file) {
        return FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            file
        );
    }

    private boolean isOwnedCaptureFile(File file) {
        try {
            File cacheDir = getContext().getCacheDir().getCanonicalFile();
            File candidate = file.getCanonicalFile();
            return cacheDir.equals(candidate.getParentFile())
                && candidate.getName().startsWith(CAPTURE_PREFIX)
                && candidate.getName().endsWith(CAPTURE_SUFFIX);
        } catch (IOException error) {
            return false;
        }
    }

    private void grantCameraUri(Intent intent, Uri uri) {
        intent.addFlags(URI_FLAGS);
        intent.setClipData(ClipData.newRawUri("OANIX camera capture", uri));

        PackageManager packageManager = getContext().getPackageManager();
        List<ResolveInfo> activities = packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
        for (ResolveInfo resolveInfo : activities) {
            getContext().grantUriPermission(resolveInfo.activityInfo.packageName, uri, URI_FLAGS);
        }
    }

    private void revokeCameraUri() {
        if (pendingCaptureUri == null) return;
        try {
            getContext().revokeUriPermission(pendingCaptureUri, URI_FLAGS);
        } catch (Exception ignored) {
            // The temporary URI is scoped to OANIX and the file is removed below.
        }
    }

    private void cleanupPendingCapture() {
        revokeCameraUri();
        if (pendingCaptureFile != null && pendingCaptureFile.exists() && isOwnedCaptureFile(pendingCaptureFile)) {
            pendingCaptureFile.delete();
        }
        pendingCaptureFile = null;
        pendingCaptureUri = null;
        captureActive = false;
    }

    private byte[] readCaptureBytes(File file) throws IOException {
        long length = file.length();
        if (!isOwnedCaptureFile(file) || length <= 0 || length > MAX_CAPTURE_BYTES) {
            throw new IOException("Captured image size or location is invalid.");
        }

        try (
            FileInputStream input = new FileInputStream(file);
            ByteArrayOutputStream output = new ByteArrayOutputStream((int) Math.min(length, Integer.MAX_VALUE))
        ) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            long total = 0;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_CAPTURE_BYTES) {
                    Arrays.fill(buffer, (byte) 0);
                    throw new IOException("Captured image exceeds the OANIX camera limit.");
                }
                output.write(buffer, 0, read);
            }
            Arrays.fill(buffer, (byte) 0);
            return output.toByteArray();
        }
    }

    @Override
    protected Bundle saveInstanceState() {
        Bundle state = super.saveInstanceState();
        if (state == null) state = new Bundle();

        if (pendingCaptureFile != null && isOwnedCaptureFile(pendingCaptureFile)) {
            state.putString(STATE_CAPTURE_PATH, pendingCaptureFile.getAbsolutePath());
        }
        if (pendingCaptureUri != null) {
            state.putString(STATE_CAPTURE_URI, pendingCaptureUri.toString());
        }
        return state;
    }

    @Override
    protected void restoreState(Bundle state) {
        super.restoreState(state);
        if (state == null) return;

        String restoredPath = state.getString(STATE_CAPTURE_PATH);
        String restoredUri = state.getString(STATE_CAPTURE_URI);
        if (restoredPath == null || restoredUri == null) return;

        File restoredFile = new File(restoredPath);
        if (!restoredFile.exists() || !isOwnedCaptureFile(restoredFile)) return;

        pendingCaptureFile = restoredFile;
        pendingCaptureUri = Uri.parse(restoredUri);
        captureActive = true;
    }

    @PluginMethod
    public void takePhoto(PluginCall call) {
        if (captureActive) {
            call.reject("Ya hay una captura de cámara en curso.");
            return;
        }

        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("Este dispositivo no tiene una aplicación de cámara disponible.");
            return;
        }

        try {
            pendingCaptureFile = createCaptureFile();
            pendingCaptureUri = uriForCapture(pendingCaptureFile);
            grantCameraUri(intent, pendingCaptureUri);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, pendingCaptureUri);
            captureActive = true;
            startActivityForResult(call, intent, "cameraResult");
        } catch (Exception error) {
            cleanupPendingCapture();
            call.reject("No se pudo abrir la cámara de OANIX.", error);
        }
    }

    @ActivityCallback
    private void cameraResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            cleanupPendingCapture();
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK) {
            cleanupPendingCapture();
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        if (pendingCaptureFile == null || !pendingCaptureFile.exists()) {
            cleanupPendingCapture();
            call.reject("La cámara no devolvió una foto válida.");
            return;
        }

        byte[] bytes = null;
        try {
            bytes = readCaptureBytes(pendingCaptureFile);
            JSObject response = new JSObject();
            response.put("cancelled", false);
            response.put("mimeType", "image/jpeg");
            response.put("byteLength", bytes.length);
            response.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("No se pudo leer la foto capturada.", error);
        } finally {
            if (bytes != null) Arrays.fill(bytes, (byte) 0);
            cleanupPendingCapture();
        }
    }

    @Override
    protected void handleOnDestroy() {
        // Normal teardown should not leave a plaintext capture in the app cache. Android can
        // persist/restore the pending path and URI before recreation through saveInstanceState().
        cleanupPendingCapture();
    }
}

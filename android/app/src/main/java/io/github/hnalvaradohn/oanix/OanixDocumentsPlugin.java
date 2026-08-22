package io.github.hnalvaradohn.oanix;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.UUID;

@CapacitorPlugin(name = "OanixDocuments")
public class OanixDocumentsPlugin extends Plugin {
    private static final String BACKUP_MIME_TYPE = "application/vnd.oanix.encrypted-backup+json";
    private static final int MAX_CHUNK_BYTES = 512 * 1024;

    private OutputStream activeOutput;
    private Uri activeOutputUri;
    private String activeSessionId;
    private long activeBytesWritten;

    private boolean hasActiveWrite() {
        return activeOutput != null || activeOutputUri != null || activeSessionId != null;
    }

    private void clearActiveWriteReferences() {
        activeOutput = null;
        activeOutputUri = null;
        activeSessionId = null;
        activeBytesWritten = 0;
    }

    private void closeActiveWrite(boolean deleteDocument) {
        OutputStream output = activeOutput;
        Uri uri = activeOutputUri;
        clearActiveWriteReferences();

        if (output != null) {
            try {
                output.close();
            } catch (Exception ignored) {
                // Best effort. A failed export never becomes OANIX's source of truth.
            }
        }

        if (deleteDocument && uri != null) {
            try {
                getContext().getContentResolver().delete(uri, null, null);
            } catch (Exception ignored) {
                // Some providers do not allow deletion. The user can remove a partial file manually.
            }
        }
    }

    private boolean requireSession(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (
            sessionId == null
            || activeSessionId == null
            || activeOutput == null
            || activeOutputUri == null
            || !activeSessionId.equals(sessionId)
        ) {
            call.reject("La sesión de guardado de OANIX ya no está disponible.");
            return false;
        }
        return true;
    }

    private JSObject selectedDocument(Uri uri) {
        ContentResolver resolver = getContext().getContentResolver();
        String displayName = "OANIX-backup.oanixbackup";
        long byteLength = -1L;

        try (Cursor cursor = resolver.query(
            uri,
            new String[]{ OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE },
            null,
            null,
            null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameIndex >= 0 && !cursor.isNull(nameIndex)) displayName = cursor.getString(nameIndex);
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) byteLength = cursor.getLong(sizeIndex);
            }
        } catch (Exception ignored) {
            // The URI itself remains usable even if a provider omits optional metadata.
        }

        JSObject response = new JSObject();
        response.put("cancelled", false);
        response.put("uri", uri.toString());
        response.put("name", displayName);
        response.put("mimeType", resolver.getType(uri));
        if (byteLength >= 0) response.put("byteLength", byteLength);
        return response;
    }

    private boolean validFileName(String fileName) {
        return fileName != null
            && !fileName.isBlank()
            && fileName.length() <= 180
            && !fileName.contains("/")
            && !fileName.contains("\\");
    }

    private String normalizedMimeType(String mimeType) {
        if (mimeType == null || mimeType.isBlank() || mimeType.length() > 120 || !mimeType.contains("/")) {
            return "application/octet-stream";
        }
        return mimeType.trim();
    }

    private void beginSaveDocument(PluginCall call, String fileName, String mimeType, String callbackName) {
        if (hasActiveWrite()) {
            call.reject("Ya hay un archivo de OANIX guardándose.");
            return;
        }
        if (!validFileName(fileName)) {
            call.reject("El nombre del archivo no es válido.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(normalizedMimeType(mimeType));
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);

        try {
            startActivityForResult(call, intent, callbackName);
        } catch (Exception error) {
            call.reject("No se pudo abrir el selector para guardar el archivo.", error);
        }
    }

    private void prepareSelectedOutput(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();

        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        if (!"content".equalsIgnoreCase(uri.getScheme())) {
            call.reject("Android devolvió una ubicación de guardado no compatible.");
            return;
        }

        try {
            OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w");
            if (output == null) throw new IllegalStateException("Document provider returned no output stream.");

            activeOutput = output;
            activeOutputUri = uri;
            activeSessionId = UUID.randomUUID().toString();
            activeBytesWritten = 0;

            JSObject response = new JSObject();
            response.put("cancelled", false);
            response.put("sessionId", activeSessionId);
            call.resolve(response);
        } catch (Exception error) {
            closeActiveWrite(true);
            call.reject("No se pudo preparar el archivo seleccionado.", error);
        }
    }

    @PluginMethod
    public void openBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
            BACKUP_MIME_TYPE,
            "application/json",
            "application/octet-stream",
            "text/json",
            "text/plain"
        });
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        try {
            startActivityForResult(call, intent, "openBackupResult");
        } catch (Exception error) {
            call.reject("No se pudo abrir el selector de archivos de Android.", error);
        }
    }

    @ActivityCallback
    private void openBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();

        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        if (!"content".equalsIgnoreCase(uri.getScheme())) {
            call.reject("Android devolvió una ubicación de archivo no compatible.");
            return;
        }

        call.resolve(selectedDocument(uri));
    }

    @PluginMethod
    public void beginSaveBackup(PluginCall call) {
        beginSaveDocument(call, call.getString("fileName"), BACKUP_MIME_TYPE, "createBackupResult");
    }

    @ActivityCallback
    private void createBackupResult(PluginCall call, ActivityResult result) {
        prepareSelectedOutput(call, result);
    }

    @PluginMethod
    public void beginSaveFile(PluginCall call) {
        beginSaveDocument(call, call.getString("fileName"), call.getString("mimeType"), "createFileResult");
    }

    @ActivityCallback
    private void createFileResult(PluginCall call, ActivityResult result) {
        prepareSelectedOutput(call, result);
    }

    @PluginMethod
    public void writeBackupChunk(PluginCall call) {
        if (!requireSession(call)) return;
        String chunk = call.getString("chunk");
        if (chunk == null || chunk.isEmpty()) {
            call.reject("El fragmento de backup está vacío.");
            return;
        }

        byte[] bytes = chunk.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_CHUNK_BYTES) {
            Arrays.fill(bytes, (byte) 0);
            call.reject("El fragmento de backup supera el límite del bridge.");
            return;
        }

        try {
            activeOutput.write(bytes);
            activeBytesWritten += bytes.length;
            JSObject response = new JSObject();
            response.put("bytesWritten", activeBytesWritten);
            call.resolve(response);
        } catch (Exception error) {
            closeActiveWrite(true);
            call.reject("No se pudo escribir el backup en la ubicación seleccionada.", error);
        } finally {
            Arrays.fill(bytes, (byte) 0);
        }
    }

    @PluginMethod
    public void writeFileChunk(PluginCall call) {
        if (!requireSession(call)) return;
        String chunkBase64 = call.getString("chunkBase64");
        if (chunkBase64 == null || chunkBase64.isEmpty()) {
            call.reject("El fragmento del archivo está vacío.");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(chunkBase64, Base64.NO_WRAP);
        } catch (Exception error) {
            call.reject("El fragmento del archivo no usa Base64 válido.");
            return;
        }
        if (bytes.length <= 0 || bytes.length > MAX_CHUNK_BYTES) {
            Arrays.fill(bytes, (byte) 0);
            call.reject("El fragmento del archivo supera el límite del bridge.");
            return;
        }

        try {
            activeOutput.write(bytes);
            activeBytesWritten += bytes.length;
            JSObject response = new JSObject();
            response.put("bytesWritten", activeBytesWritten);
            call.resolve(response);
        } catch (Exception error) {
            closeActiveWrite(true);
            call.reject("No se pudo escribir el archivo recuperado.", error);
        } finally {
            Arrays.fill(bytes, (byte) 0);
        }
    }

    private void finishActiveWrite(PluginCall call, boolean includeUri) {
        if (!requireSession(call)) return;
        long byteLength = activeBytesWritten;
        Uri uri = activeOutputUri;

        try {
            activeOutput.flush();
            activeOutput.close();
            clearActiveWriteReferences();
            JSObject response = new JSObject();
            response.put("saved", true);
            response.put("byteLength", byteLength);
            if (includeUri && uri != null) response.put("uri", uri.toString());
            call.resolve(response);
        } catch (Exception error) {
            closeActiveWrite(true);
            call.reject("No se pudo finalizar el archivo en Android.", error);
        }
    }

    @PluginMethod
    public void finishSaveBackup(PluginCall call) {
        finishActiveWrite(call, false);
    }

    @PluginMethod
    public void finishSaveFile(PluginCall call) {
        finishActiveWrite(call, true);
    }

    @PluginMethod
    public void openSavedFile(PluginCall call) {
        String rawUri = call.getString("uri");
        String mimeType = normalizedMimeType(call.getString("mimeType"));
        if (rawUri == null || rawUri.isBlank()) {
            call.reject("No se recibió la ubicación del archivo recuperado.");
            return;
        }

        Uri uri;
        try {
            uri = Uri.parse(rawUri);
        } catch (Exception error) {
            call.reject("La ubicación del archivo recuperado no es válida.");
            return;
        }
        if (!"content".equalsIgnoreCase(uri.getScheme())) {
            call.reject("Android rechazó una ubicación de archivo no segura.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, mimeType);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            JSObject response = new JSObject();
            response.put("opened", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("No hay una aplicación disponible para abrir este archivo.", error);
        }
    }

    @PluginMethod
    public void abortSaveBackup(PluginCall call) {
        abortActiveWrite(call);
    }

    @PluginMethod
    public void abortSaveFile(PluginCall call) {
        abortActiveWrite(call);
    }

    private void abortActiveWrite(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (activeSessionId != null && activeSessionId.equals(sessionId)) {
            closeActiveWrite(true);
        }
        JSObject response = new JSObject();
        response.put("aborted", true);
        call.resolve(response);
    }

    @Override
    protected void handleOnDestroy() {
        if (hasActiveWrite()) closeActiveWrite(true);
    }
}

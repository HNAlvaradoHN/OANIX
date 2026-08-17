package io.github.hnalvaradohn.oanix;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "OanixShare")
public class OanixSharePlugin extends Plugin {
    private static final long MAX_IMAGE_BYTES = 50L * 1024L * 1024L;
    private static final long MAX_TOTAL_BYTES = 120L * 1024L * 1024L;
    private static final int MAX_IMAGE_COUNT = 10;
    private static final int MAX_TEXT_CHARS = 250_000;
    private static final long STALE_SHARE_MS = 60L * 60L * 1000L;
    private static final String SHARE_PREFIX = "oanix-share-";

    private final ArrayList<File> pendingFiles = new ArrayList<>();

    @Override
    public void load() {
        cleanupStaleShareFiles();
    }

    private void cleanupStaleShareFiles() {
        File[] files = getContext().getCacheDir().listFiles((dir, name) -> name.startsWith(SHARE_PREFIX));
        if (files == null) return;

        long cutoff = System.currentTimeMillis() - STALE_SHARE_MS;
        for (File file : files) {
            if (file.lastModified() < cutoff) file.delete();
        }
    }

    private void cleanupPendingFiles() {
        for (File file : pendingFiles) {
            if (file != null && file.exists() && isOwnedShareFile(file)) file.delete();
        }
        pendingFiles.clear();
    }

    private boolean isOwnedShareFile(File file) {
        try {
            File cacheDir = getContext().getCacheDir().getCanonicalFile();
            File candidate = file.getCanonicalFile();
            return cacheDir.equals(candidate.getParentFile())
                && candidate.getName().startsWith(SHARE_PREFIX);
        } catch (IOException error) {
            return false;
        }
    }

    private boolean isShareIntent(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        return Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action);
    }

    private void clearIncomingShareIntent(Activity activity) {
        Intent cleared = new Intent(Intent.ACTION_MAIN);
        activity.setIntent(cleared);
    }

    private String textExtra(Intent intent, String key) {
        CharSequence value = intent.getCharSequenceExtra(key);
        return value == null ? "" : value.toString();
    }

    @SuppressWarnings("deprecation")
    private Uri getSingleStream(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        }
        return intent.getParcelableExtra(Intent.EXTRA_STREAM);
    }

    @SuppressWarnings("deprecation")
    private ArrayList<Uri> getMultipleStreams(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class);
        }
        return intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
    }

    private ArrayList<Uri> collectSharedUris(Intent intent) {
        Set<Uri> uniqueUris = new LinkedHashSet<>();

        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            Uri single = getSingleStream(intent);
            if (single != null) uniqueUris.add(single);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
            ArrayList<Uri> multiple = getMultipleStreams(intent);
            if (multiple != null) uniqueUris.addAll(multiple);
        }

        ClipData clipData = intent.getClipData();
        if (clipData != null) {
            for (int index = 0; index < clipData.getItemCount(); index += 1) {
                Uri uri = clipData.getItemAt(index).getUri();
                if (uri != null) uniqueUris.add(uri);
            }
        }

        return new ArrayList<>(uniqueUris);
    }

    private String normalizeImageMimeType(String rawMimeType) {
        if (rawMimeType == null) return null;
        String mimeType = rawMimeType.trim().toLowerCase(Locale.ROOT);
        if ("image/jpg".equals(mimeType)) return "image/jpeg";
        if (
            "image/jpeg".equals(mimeType)
                || "image/png".equals(mimeType)
                || "image/webp".equals(mimeType)
                || "image/gif".equals(mimeType)
        ) {
            return mimeType;
        }
        return null;
    }

    private String displayNameFor(Uri uri, int index, String mimeType) {
        ContentResolver resolver = getContext().getContentResolver();
        try (Cursor cursor = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) {
                    String name = cursor.getString(column);
                    if (name != null) {
                        String sanitized = name.trim().replace('/', '_').replace('\\', '_');
                        if (!sanitized.isEmpty()) return sanitized.length() > 160 ? sanitized.substring(0, 160) : sanitized;
                    }
                }
            }
        } catch (Exception ignored) {
            // A display name is optional. OANIX can safely create its own fallback name.
        }

        String extension = "image/png".equals(mimeType)
            ? ".png"
            : "image/webp".equals(mimeType)
                ? ".webp"
                : "image/gif".equals(mimeType)
                    ? ".gif"
                    : ".jpg";
        return "Imagen-compartida-" + (index + 1) + extension;
    }

    private String tempSuffix(String mimeType) {
        if ("image/png".equals(mimeType)) return ".png";
        if ("image/webp".equals(mimeType)) return ".webp";
        if ("image/gif".equals(mimeType)) return ".gif";
        return ".jpg";
    }

    private long copySharedImage(Uri source, File destination) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        try (
            InputStream input = resolver.openInputStream(source);
            FileOutputStream output = new FileOutputStream(destination)
        ) {
            if (input == null) throw new IOException("No se pudo abrir la imagen compartida.");

            byte[] buffer = new byte[64 * 1024];
            long copied = 0L;
            int read;
            while ((read = input.read(buffer)) != -1) {
                copied += read;
                if (copied > MAX_IMAGE_BYTES) {
                    throw new IOException("La imagen compartida supera el límite de 50 MB.");
                }
                output.write(buffer, 0, read);
            }
            output.flush();
            return copied;
        }
    }

    private JSObject cacheSharedImage(Uri source, String intentMimeType, int index) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        String mimeType = normalizeImageMimeType(resolver.getType(source));
        if (mimeType == null) mimeType = normalizeImageMimeType(intentMimeType);
        if (mimeType == null) {
            throw new IOException("OANIX solo admite imágenes JPEG, PNG, WebP o GIF al compartir.");
        }

        File destination = File.createTempFile(SHARE_PREFIX, tempSuffix(mimeType), getContext().getCacheDir());
        pendingFiles.add(destination);
        long byteLength = copySharedImage(source, destination);
        if (byteLength <= 0 || !isOwnedShareFile(destination)) {
            throw new IOException("La imagen compartida está vacía o no es válida.");
        }

        Uri privateUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            destination
        );

        JSObject image = new JSObject();
        image.put("uri", privateUri.toString());
        image.put("mimeType", mimeType);
        image.put("name", displayNameFor(source, index, mimeType));
        image.put("byteLength", byteLength);
        return image;
    }

    @PluginMethod
    public void consumePendingShare(PluginCall call) {
        Activity activity = getActivity();
        Intent intent = activity == null ? null : activity.getIntent();
        JSObject response = new JSObject();

        if (activity == null || !isShareIntent(intent)) {
            response.put("available", false);
            call.resolve(response);
            return;
        }

        cleanupPendingFiles();

        try {
            String text = textExtra(intent, Intent.EXTRA_TEXT).trim();
            String subject = textExtra(intent, Intent.EXTRA_SUBJECT).trim();
            if (text.length() > MAX_TEXT_CHARS) {
                throw new IOException("El texto compartido supera el límite seguro de OANIX.");
            }

            ArrayList<Uri> uris = collectSharedUris(intent);
            if (uris.size() > MAX_IMAGE_COUNT) {
                throw new IOException("OANIX admite hasta 10 imágenes por envío compartido.");
            }

            JSArray images = new JSArray();
            long totalBytes = 0L;
            String intentMimeType = intent.getType();
            for (int index = 0; index < uris.size(); index += 1) {
                JSObject image = cacheSharedImage(uris.get(index), intentMimeType, index);
                totalBytes += image.optLong("byteLength", 0L);
                if (totalBytes > MAX_TOTAL_BYTES) {
                    throw new IOException("El conjunto de imágenes compartidas supera el límite temporal de OANIX.");
                }
                images.put(image);
            }

            clearIncomingShareIntent(activity);

            if (text.isEmpty() && images.length() == 0) {
                cleanupPendingFiles();
                response.put("available", false);
                call.resolve(response);
                return;
            }

            response.put("available", true);
            response.put("text", text);
            response.put("subject", subject);
            response.put("images", images);
            call.resolve(response);
        } catch (Exception error) {
            clearIncomingShareIntent(activity);
            cleanupPendingFiles();
            call.reject(
                error.getMessage() == null ? "No se pudo preparar el contenido compartido para OANIX." : error.getMessage(),
                error
            );
        }
    }

    @PluginMethod
    public void finishShare(PluginCall call) {
        cleanupPendingFiles();
        JSObject response = new JSObject();
        response.put("finished", true);
        call.resolve(response);
    }
}

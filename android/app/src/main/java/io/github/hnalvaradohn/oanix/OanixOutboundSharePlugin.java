package io.github.hnalvaradohn.oanix;

import android.content.ClipData;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "OanixOutboundShare")
public class OanixOutboundSharePlugin extends Plugin {
    private static final int MAX_SHARE_CHARS = 300_000;
    private static final int MAX_FILE_CHARS = 5_000_000;
    private static final int MAX_PDF_PAGES = 250;
    private static final long EXPORT_MAX_AGE_MS = 24L * 60L * 60L * 1000L;
    private static final int PDF_WIDTH = 595;
    private static final int PDF_HEIGHT = 842;
    private static final float PDF_MARGIN = 36f;
    private static final float PDF_BODY_SIZE = 10f;
    private static final float PDF_LINE_HEIGHT = 14f;

    @PluginMethod
    public void shareText(PluginCall call) {
        String title = normalizedTitle(call.getString("title"), "Nota de OANIX");
        String text = normalizedText(call.getString("text"));

        if (text.trim().isEmpty()) {
            call.reject("La nota no tiene contenido legible para compartir.");
            return;
        }
        if (text.length() > MAX_SHARE_CHARS) {
            call.reject("La nota es demasiado extensa para compartir como texto en una sola operación.");
            return;
        }

        try {
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("text/plain");
            sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            sendIntent.putExtra(Intent.EXTRA_TEXT, text);

            Intent chooser = Intent.createChooser(sendIntent, "Compartir nota");
            getActivity().startActivity(chooser);

            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo abrir el menú para compartir la nota.", error);
        }
    }

    @PluginMethod
    public void shareTextFile(PluginCall call) {
        String title = normalizedTitle(call.getString("title"), "Texto de OANIX");
        String text = normalizedText(call.getString("text"));
        String fileName = safeFileName(call.getString("fileName"), "oanix-texto.txt", ".txt");

        if (!validateFileText(call, text)) return;

        runExport(call, () -> {
            File file = exportFile(fileName);
            try (OutputStreamWriter writer = new OutputStreamWriter(
                    new FileOutputStream(file, false),
                    StandardCharsets.UTF_8
            )) {
                writer.write(text);
            }
            return new ExportResult(file, "text/plain", title);
        });
    }

    @PluginMethod
    public void sharePdfText(PluginCall call) {
        String title = normalizedTitle(call.getString("title"), "PDF de OANIX");
        String text = normalizedText(call.getString("text"));
        String fileName = safeFileName(call.getString("fileName"), "oanix-texto.pdf", ".pdf");

        if (!validateFileText(call, text)) return;

        runExport(call, () -> {
            File file = exportFile(fileName);
            writePdf(file, title, text);
            return new ExportResult(file, "application/pdf", title);
        });
    }

    private boolean validateFileText(PluginCall call, String text) {
        if (text.isEmpty()) {
            call.reject("El bloque no tiene contenido para exportar.");
            return false;
        }
        if (text.length() > MAX_FILE_CHARS) {
            call.reject("El bloque es demasiado grande para esta exportación. Usa un archivo adjunto o divide el contenido.");
            return false;
        }
        return true;
    }

    private void runExport(PluginCall call, ExportTask task) {
        new Thread(() -> {
            try {
                cleanupOldExports();
                ExportResult result = task.run();
                getActivity().runOnUiThread(() -> openShareSheet(call, result));
            } catch (Exception error) {
                call.reject("No se pudo preparar el archivo para compartir.", error);
            }
        }, "oanix-export").start();
    }

    private void openShareSheet(PluginCall call, ExportResult result) {
        try {
            Uri uri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    result.file
            );

            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType(result.mimeType);
            sendIntent.putExtra(Intent.EXTRA_SUBJECT, result.title);
            sendIntent.putExtra(Intent.EXTRA_STREAM, uri);
            sendIntent.setClipData(ClipData.newRawUri(result.file.getName(), uri));
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(sendIntent, "Compartir archivo");
            getActivity().startActivity(chooser);

            JSObject response = new JSObject();
            response.put("opened", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("No se pudo abrir el menú para compartir el archivo.", error);
        }
    }

    private File exportFile(String fileName) throws Exception {
        File directory = new File(getContext().getCacheDir(), "shared_exports");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new Exception("No se pudo preparar la carpeta temporal de exportación.");
        }
        return new File(directory, fileName);
    }

    private void cleanupOldExports() {
        File directory = new File(getContext().getCacheDir(), "shared_exports");
        File[] files = directory.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - EXPORT_MAX_AGE_MS;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff) file.delete();
        }
    }

    private void writePdf(File file, String title, String text) throws Exception {
        PdfDocument document = new PdfDocument();
        Paint headerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        headerPaint.setColor(Color.BLACK);
        headerPaint.setTextSize(12f);
        headerPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        Paint bodyPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bodyPaint.setColor(Color.BLACK);
        bodyPaint.setTextSize(PDF_BODY_SIZE);
        bodyPaint.setTypeface(Typeface.MONOSPACE);

        PdfDocument.Page page = null;
        Canvas canvas = null;
        float y = 0f;
        int pageNumber = 0;
        float availableWidth = PDF_WIDTH - PDF_MARGIN * 2f;
        float bottom = PDF_HEIGHT - PDF_MARGIN;

        try {
            String[] logicalLines = text.split("\\r\\n|\\n|\\r", -1);
            for (String rawLine : logicalLines) {
                String remaining = rawLine.replace("\t", "    ");
                boolean emitted = false;

                do {
                    if (page == null || y + PDF_LINE_HEIGHT > bottom) {
                        if (page != null) document.finishPage(page);
                        pageNumber += 1;
                        if (pageNumber > MAX_PDF_PAGES) {
                            throw new Exception("El bloque supera " + MAX_PDF_PAGES + " páginas de PDF. Usa Exportar TXT para textos tan extensos.");
                        }

                        PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(
                                PDF_WIDTH,
                                PDF_HEIGHT,
                                pageNumber
                        ).create();
                        page = document.startPage(info);
                        canvas = page.getCanvas();
                        canvas.drawColor(Color.WHITE);
                        canvas.drawText(title, PDF_MARGIN, PDF_MARGIN, headerPaint);
                        y = PDF_MARGIN + 28f;
                    }

                    if (remaining.isEmpty()) {
                        y += PDF_LINE_HEIGHT;
                        emitted = true;
                        continue;
                    }

                    int count = bodyPaint.breakText(remaining, true, availableWidth, null);
                    if (count <= 0) count = 1;
                    String visible = remaining.substring(0, count);
                    canvas.drawText(visible, PDF_MARGIN, y, bodyPaint);
                    y += PDF_LINE_HEIGHT;
                    remaining = remaining.substring(count);
                    emitted = true;
                } while (!remaining.isEmpty() || !emitted);
            }

            if (page == null) {
                PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(PDF_WIDTH, PDF_HEIGHT, 1).create();
                page = document.startPage(info);
                canvas = page.getCanvas();
                canvas.drawColor(Color.WHITE);
                canvas.drawText(title, PDF_MARGIN, PDF_MARGIN, headerPaint);
            }
            document.finishPage(page);

            try (FileOutputStream output = new FileOutputStream(file, false)) {
                document.writeTo(output);
            }
        } finally {
            document.close();
        }
    }

    private static String normalizedTitle(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private static String normalizedText(String value) {
        return value == null ? "" : value;
    }

    private static String safeFileName(String value, String fallback, String extension) {
        String candidate = value == null ? "" : value.trim();
        if (candidate.isEmpty()) candidate = fallback;
        candidate = candidate.replaceAll("[^A-Za-z0-9._-]", "-");
        while (candidate.contains("..")) candidate = candidate.replace("..", ".");
        if (!candidate.toLowerCase().endsWith(extension)) candidate += extension;
        if (candidate.length() > 96) {
            int suffixLength = extension.length();
            candidate = candidate.substring(0, 96 - suffixLength) + extension;
        }
        return candidate;
    }

    private interface ExportTask {
        ExportResult run() throws Exception;
    }

    private static class ExportResult {
        final File file;
        final String mimeType;
        final String title;

        ExportResult(File file, String mimeType, String title) {
            this.file = file;
            this.mimeType = mimeType;
            this.title = title;
        }
    }
}

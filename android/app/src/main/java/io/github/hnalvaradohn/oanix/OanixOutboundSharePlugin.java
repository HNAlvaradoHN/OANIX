package io.github.hnalvaradohn.oanix;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OanixOutboundShare")
public class OanixOutboundSharePlugin extends Plugin {
    private static final int MAX_SHARE_CHARS = 300_000;

    @PluginMethod
    public void shareText(PluginCall call) {
        String title = call.getString("title", "Nota de OANIX");
        String text = call.getString("text", "");

        if (text == null || text.trim().isEmpty()) {
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
            sendIntent.putExtra(Intent.EXTRA_SUBJECT, title == null ? "Nota de OANIX" : title);
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
}

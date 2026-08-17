package io.github.hnalvaradohn.oanix;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OanixAuth")
public class OanixAuthPlugin extends Plugin {
    private static final String CALLBACK_SCHEME = "oanix";
    private static final String CALLBACK_HOST = "auth-callback";

    private String pendingCallbackUrl = null;

    private boolean isAuthCallback(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        Uri data = intent.getData();
        return data != null
            && CALLBACK_SCHEME.equalsIgnoreCase(data.getScheme())
            && CALLBACK_HOST.equalsIgnoreCase(data.getHost());
    }

    private void rememberCallback(Intent intent) {
        if (!isAuthCallback(intent)) return;
        Uri data = intent.getData();
        if (data == null) return;
        synchronized (this) {
            // OAuth callbacks contain short-lived session material. Keep only the latest callback
            // in process memory; never persist it in SharedPreferences, saved state or files.
            pendingCallbackUrl = data.toString();
        }
    }

    private void clearActivityCallbackIntent(Activity activity) {
        if (activity == null || !isAuthCallback(activity.getIntent())) return;
        activity.setIntent(new Intent(Intent.ACTION_MAIN));
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (!isAuthCallback(intent)) return;

        rememberCallback(intent);
        JSObject signal = new JSObject();
        signal.put("pending", true);
        // Do not broadcast the callback URL itself because it may contain OAuth tokens.
        notifyListeners("authCallback", signal, false);
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (this) {
            pendingCallbackUrl = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        String rawUrl = call.getString("url");
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            call.reject("Falta la URL segura de autenticación.");
            return;
        }

        try {
            Uri uri = Uri.parse(rawUrl);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                call.reject("OANIX solo abre autenticación externa mediante HTTPS.");
                return;
            }

            Activity activity = getActivity();
            if (activity == null) {
                call.reject("Android no tiene una Activity disponible para abrir Google.");
                return;
            }

            Intent browserIntent = new Intent(Intent.ACTION_VIEW, uri);
            activity.startActivity(browserIntent);

            JSObject response = new JSObject();
            response.put("opened", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("No se pudo abrir el navegador seguro para autenticar.", error);
        }
    }

    @PluginMethod
    public void consumePendingAuthCallback(PluginCall call) {
        Activity activity = getActivity();

        synchronized (this) {
            if (pendingCallbackUrl == null && activity != null && isAuthCallback(activity.getIntent())) {
                rememberCallback(activity.getIntent());
            }

            JSObject response = new JSObject();
            if (pendingCallbackUrl == null) {
                response.put("available", false);
                call.resolve(response);
                return;
            }

            String callbackUrl = pendingCallbackUrl;
            pendingCallbackUrl = null;
            clearActivityCallbackIntent(activity);

            response.put("available", true);
            response.put("url", callbackUrl);
            call.resolve(response);
        }
    }
}

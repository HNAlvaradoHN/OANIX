package io.github.hnalvaradohn.oanix;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentSender;
import android.os.Bundle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "OanixDriveAuth", requestCodes = { OanixDriveAuthPlugin.REQUEST_AUTHORIZE })
public class OanixDriveAuthPlugin extends Plugin {
    static final int REQUEST_AUTHORIZE = 9137;
    private static final String DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    private static final long FALLBACK_TOKEN_LIFETIME_SECONDS = 45L * 60L;
    private static final long MAX_TOKEN_LIFETIME_SECONDS = 60L * 60L;

    private boolean authorizationActive = false;

    @PluginMethod
    public void authorize(PluginCall call) {
        if (authorizationActive) {
            call.reject("Ya hay una autorización de Google Drive en curso.");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Android no tiene una Activity disponible para autorizar Google Drive.");
            return;
        }

        authorizationActive = true;
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_APPDATA_SCOPE)))
            .setOptOutIncludingGrantedScopes(true)
            .setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)
            .build();

        AuthorizationClient client = Identity.getAuthorizationClient(activity);
        client.authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    PendingIntent pendingIntent = result.getPendingIntent();
                    if (pendingIntent == null) {
                        authorizationActive = false;
                        call.reject("Google Drive pidió interacción pero no devolvió una resolución válida.");
                        return;
                    }

                    try {
                        saveCall(call);
                        activity.startIntentSenderForResult(
                            pendingIntent.getIntentSender(),
                            REQUEST_AUTHORIZE,
                            null,
                            0,
                            0,
                            0
                        );
                    } catch (IntentSender.SendIntentException error) {
                        authorizationActive = false;
                        freeSavedCallSafely();
                        call.reject("Android no pudo abrir la autorización de Google Drive.", error);
                    }
                    return;
                }

                authorizationActive = false;
                resolveAuthorization(call, result);
            })
            .addOnFailureListener(error -> {
                authorizationActive = false;
                call.reject("Google Drive no pudo iniciar la autorización en este dispositivo.", error);
            });
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        if (authorizationActive) {
            call.reject("Ya hay una autorización de Google Drive en curso.");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Android no tiene una Activity disponible para renovar Google Drive.");
            return;
        }

        authorizationActive = true;
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_APPDATA_SCOPE)))
            .setOptOutIncludingGrantedScopes(true)
            .build();

        Identity.getAuthorizationClient(activity).authorize(request)
            .addOnSuccessListener(result -> {
                authorizationActive = false;
                if (result == null || result.hasResolution()) {
                    JSObject response = new JSObject();
                    response.put("cancelled", true);
                    response.put("interactionRequired", true);
                    call.resolve(response);
                    return;
                }
                resolveAuthorization(call, result);
            })
            .addOnFailureListener(error -> {
                authorizationActive = false;
                call.reject("Google Drive no pudo renovar la autorización silenciosamente.", error);
            });
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_AUTHORIZE) {
            super.handleOnActivityResult(requestCode, resultCode, data);
            return;
        }

        PluginCall call = getSavedCall();
        authorizationActive = false;
        if (call == null) return;

        if (resultCode != Activity.RESULT_OK || data == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            freeSavedCallSafely();
            return;
        }

        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity())
                .getAuthorizationResultFromIntent(data);
            resolveAuthorization(call, result);
        } catch (ApiException error) {
            call.reject("Google Drive no devolvió una autorización válida.", error);
        } finally {
            freeSavedCallSafely();
        }
    }

    private void resolveAuthorization(PluginCall call, AuthorizationResult result) {
        if (result == null || result.hasResolution()) {
            call.reject("Google Drive no completó la autorización.");
            return;
        }

        List<String> scopes = result.getGrantedScopes();
        if (scopes == null || !scopes.contains(DRIVE_APPDATA_SCOPE)) {
            call.reject("Google no concedió el permiso privado de almacenamiento solicitado por OANIX.");
            return;
        }

        String token = result.getAccessToken();
        if (token == null || token.trim().isEmpty() || token.matches(".*\\s+.*")) {
            call.reject("Google Drive no devolvió un token de acceso válido.");
            return;
        }

        JSObject response = new JSObject();
        response.put("cancelled", false);
        response.put("interactionRequired", false);
        response.put("accessToken", token.trim());
        response.put("expiresInSeconds", tokenLifetimeSeconds(result));
        response.put("scope", DRIVE_APPDATA_SCOPE);
        call.resolve(response);
    }

    private long tokenLifetimeSeconds(AuthorizationResult result) {
        Bundle params = result.getTokenResponseParams();
        if (params != null && params.containsKey("expires_in")) {
            Object raw = params.get("expires_in");
            try {
                long parsed = raw instanceof Number
                    ? ((Number) raw).longValue()
                    : Long.parseLong(String.valueOf(raw));
                if (parsed > 120L) return Math.min(parsed, MAX_TOKEN_LIFETIME_SECONDS);
            } catch (Exception ignored) {
                // Fall back to a conservative in-memory lease below.
            }
        }
        return FALLBACK_TOKEN_LIFETIME_SECONDS;
    }

    private void freeSavedCallSafely() {
        try {
            if (getSavedCall() != null) freeSavedCall();
        } catch (Exception ignored) {
            // Best effort: no authorization credential is persisted by this plugin.
        }
    }

    @Override
    protected void handleOnDestroy() {
        authorizationActive = false;
        freeSavedCallSafely();
        super.handleOnDestroy();
    }
}

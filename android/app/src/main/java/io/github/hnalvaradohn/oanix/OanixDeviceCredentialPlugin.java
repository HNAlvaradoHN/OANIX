package io.github.hnalvaradohn.oanix;

import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.util.Base64;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.concurrent.Executor;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "OanixDeviceCredential")
public class OanixDeviceCredentialPlugin extends Plugin {
    private static final String PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "oanix.biometric-vault.v2";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int VAULT_KEY_BYTES = 32;
    private static final int ENVELOPE_VERSION = 2;
    private static final int MIN_API = Build.VERSION_CODES.R;

    private static final String PREFS_NAME = "oanix.biometric-vault";
    private static final String PREF_VERSION = "version";
    private static final String PREF_IV = "iv";
    private static final String PREF_CIPHERTEXT = "ciphertext";
    private static final String PREF_BINDING = "binding";
    private static final String AAD_PREFIX = "OANIX:biometric-vault:v2:";

    private boolean promptActive = false;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
    }

    private KeyStore keyStore() throws Exception {
        KeyStore store = KeyStore.getInstance(PROVIDER);
        store.load(null);
        return store;
    }

    private boolean platformSupported() {
        return Build.VERSION.SDK_INT >= MIN_API;
    }

    private boolean deviceCredentialAvailable() {
        return platformSupported()
            && BiometricManager.from(getContext()).canAuthenticate(
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            ) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    private boolean hasStoredEnvelope() {
        SharedPreferences prefs = preferences();
        return prefs.getInt(PREF_VERSION, 0) == ENVELOPE_VERSION
            && prefs.getString(PREF_IV, null) != null
            && prefs.getString(PREF_CIPHERTEXT, null) != null
            && prefs.getString(PREF_BINDING, null) != null;
    }

    private byte[] aadForBinding(String binding) {
        return (AAD_PREFIX + binding).getBytes(StandardCharsets.UTF_8);
    }

    private SecretKey requireExistingKey() throws Exception {
        KeyStore.Entry existing = keyStore().getEntry(KEY_ALIAS, null);
        if (!(existing instanceof KeyStore.SecretKeyEntry)) {
            throw new IllegalStateException("No existe una clave de acceso rápido activa.");
        }
        return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
    }

    private FragmentActivity requireActivity() {
        if (!(getActivity() instanceof FragmentActivity)) {
            throw new IllegalStateException("OANIX device credential requires a FragmentActivity.");
        }
        return (FragmentActivity) getActivity();
    }

    private JSObject fallbackResult(String reason) {
        JSObject result = new JSObject();
        result.put("unlocked", false);
        result.put("requiresPassword", true);
        result.put("reason", reason);
        return result;
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            boolean supported = deviceCredentialAvailable();
            boolean enabled = supported && hasStoredEnvelope() && keyStore().containsAlias(KEY_ALIAS);

            JSObject result = new JSObject();
            result.put("supported", supported);
            result.put("enabled", enabled);
            result.put("minimumApi", MIN_API);
            if (hasStoredEnvelope()) {
                result.put("vaultBinding", preferences().getString(PREF_BINDING, null));
            }
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo comprobar el PIN o patrón del dispositivo.", error);
        }
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        String binding = call.getString("vaultBinding");
        if (binding == null || binding.isBlank()) {
            call.reject("Falta identificar la bóveda local.");
            return;
        }
        if (!deviceCredentialAvailable()) {
            call.resolve(fallbackResult("unsupported"));
            return;
        }
        if (!hasStoredEnvelope() || !binding.equals(preferences().getString(PREF_BINDING, null))) {
            call.resolve(fallbackResult("vault-mismatch"));
            return;
        }
        if (promptActive) {
            call.reject("Ya hay una autenticación del dispositivo en curso.");
            return;
        }

        SharedPreferences prefs = preferences();
        final byte[] iv;
        final byte[] ciphertext;
        try {
            iv = Base64.decode(prefs.getString(PREF_IV, ""), Base64.NO_WRAP);
            ciphertext = Base64.decode(prefs.getString(PREF_CIPHERTEXT, ""), Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            call.resolve(fallbackResult("damaged-envelope"));
            return;
        }

        try {
            final SecretKey key = requireExistingKey();
            FragmentActivity activity = requireActivity();
            Executor executor = ContextCompat.getMainExecutor(getContext());

            BiometricPrompt prompt = new BiometricPrompt(
                activity,
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult authenticationResult) {
                        super.onAuthenticationSucceeded(authenticationResult);
                        promptActive = false;
                        byte[] plaintext = null;
                        try {
                            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
                            cipher.updateAAD(aadForBinding(binding));
                            plaintext = cipher.doFinal(ciphertext);
                            if (plaintext.length != VAULT_KEY_BYTES) {
                                throw new IllegalStateException("Invalid vault key length.");
                            }

                            JSObject result = new JSObject();
                            result.put("unlocked", true);
                            result.put("vaultKey", Base64.encodeToString(plaintext, Base64.NO_WRAP));
                            call.resolve(result);
                        } catch (KeyPermanentlyInvalidatedException | AEADBadTagException error) {
                            call.resolve(fallbackResult("key-invalidated"));
                        } catch (Exception error) {
                            call.resolve(fallbackResult("unavailable"));
                        } finally {
                            if (plaintext != null) Arrays.fill(plaintext, (byte) 0);
                            Arrays.fill(iv, (byte) 0);
                            Arrays.fill(ciphertext, (byte) 0);
                        }
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        promptActive = false;
                        Arrays.fill(iv, (byte) 0);
                        Arrays.fill(ciphertext, (byte) 0);

                        JSObject result = new JSObject();
                        result.put("unlocked", false);
                        result.put("cancelled", true);
                        result.put("reason", "cancelled");
                        call.resolve(result);
                    }
                }
            );

            BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Desbloquear OANIX")
                .setSubtitle("Usa el PIN, patrón o contraseña de tu teléfono")
                .setAllowedAuthenticators(BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .build();

            promptActive = true;
            activity.runOnUiThread(() -> prompt.authenticate(promptInfo));
        } catch (Exception error) {
            promptActive = false;
            Arrays.fill(iv, (byte) 0);
            Arrays.fill(ciphertext, (byte) 0);
            call.resolve(fallbackResult("unavailable"));
        }
    }
}

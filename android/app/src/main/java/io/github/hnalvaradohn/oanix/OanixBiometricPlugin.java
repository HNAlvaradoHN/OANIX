package io.github.hnalvaradohn.oanix;

import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
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

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "OanixBiometric")
public class OanixBiometricPlugin extends Plugin {
    private static final String PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "oanix.biometric-vault.v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int KEY_SIZE_BITS = 256;
    private static final int GCM_TAG_BITS = 128;
    private static final int VAULT_KEY_BYTES = 32;
    private static final int ENVELOPE_VERSION = 1;
    private static final int MIN_BIOMETRIC_API = Build.VERSION_CODES.R;

    private static final String PREFS_NAME = "oanix.biometric-vault";
    private static final String PREF_VERSION = "version";
    private static final String PREF_IV = "iv";
    private static final String PREF_CIPHERTEXT = "ciphertext";
    private static final String PREF_BINDING = "binding";
    private static final String AAD_PREFIX = "OANIX:biometric-vault:v1:";

    private boolean promptActive = false;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
    }

    private KeyStore keyStore() throws Exception {
        KeyStore store = KeyStore.getInstance(PROVIDER);
        store.load(null);
        return store;
    }

    private int allowedAuthenticators() {
        return BiometricManager.Authenticators.BIOMETRIC_STRONG
            | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    }

    private boolean platformSupportsAuthenticatedCrypto() {
        return Build.VERSION.SDK_INT >= MIN_BIOMETRIC_API;
    }

    private int authenticationAvailability() {
        if (!platformSupportsAuthenticatedCrypto()) return -1;
        return BiometricManager.from(getContext()).canAuthenticate(allowedAuthenticators());
    }

    private boolean hasStoredEnvelope() {
        SharedPreferences prefs = preferences();
        return prefs.getInt(PREF_VERSION, 0) == ENVELOPE_VERSION
            && prefs.getString(PREF_IV, null) != null
            && prefs.getString(PREF_CIPHERTEXT, null) != null
            && prefs.getString(PREF_BINDING, null) != null;
    }

    private String storedBinding() {
        return preferences().getString(PREF_BINDING, null);
    }

    private byte[] aadForBinding(String binding) {
        return (AAD_PREFIX + binding).getBytes(StandardCharsets.UTF_8);
    }

    private SecretKey requireBiometricKey() throws Exception {
        KeyStore store = keyStore();
        KeyStore.Entry existing = store.getEntry(KEY_ALIAS, null);
        if (existing instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
        }

        if (!platformSupportsAuthenticatedCrypto()) {
            throw new IllegalStateException("Biometric vault unlock requires Android 11 or newer.");
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER);
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setKeySize(KEY_SIZE_BITS)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setUserAuthenticationRequired(true)
            .setUserAuthenticationParameters(
                0,
                KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL
            )
            .build();

        generator.init(spec);
        return generator.generateKey();
    }

    private void clearBiometricState() {
        preferences().edit().clear().apply();
        try {
            KeyStore store = keyStore();
            if (store.containsAlias(KEY_ALIAS)) store.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) {
            // The encrypted envelope is already removed. Password unlock remains available.
        }
    }

    private FragmentActivity requireActivity() {
        if (!(getActivity() instanceof FragmentActivity)) {
            throw new IllegalStateException("OANIX biometric authentication requires a FragmentActivity.");
        }
        return (FragmentActivity) getActivity();
    }

    private BiometricPrompt.PromptInfo promptInfo(String title, String subtitle) {
        return new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(allowedAuthenticators())
            .build();
    }

    private boolean isCancellation(int errorCode) {
        return errorCode == BiometricPrompt.ERROR_CANCELED
            || errorCode == BiometricPrompt.ERROR_USER_CANCELED
            || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
            || errorCode == BiometricPrompt.ERROR_TIMEOUT;
    }

    private JSObject passwordFallbackResult(String reason) {
        JSObject result = new JSObject();
        result.put("unlocked", false);
        result.put("requiresPassword", true);
        result.put("reason", reason);
        return result;
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            int availability = authenticationAvailability();
            boolean supported = platformSupportsAuthenticatedCrypto()
                && availability == BiometricManager.BIOMETRIC_SUCCESS;
            boolean keyExists = keyStore().containsAlias(KEY_ALIAS);
            boolean enabled = supported && keyExists && hasStoredEnvelope();

            JSObject result = new JSObject();
            result.put("supported", supported);
            result.put("enabled", enabled);
            result.put("minimumApi", MIN_BIOMETRIC_API);
            result.put("availability", availability);
            if (hasStoredEnvelope()) result.put("vaultBinding", storedBinding());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo comprobar el acceso biométrico de OANIX.", error);
        }
    }

    @PluginMethod
    public void enable(PluginCall call) {
        String encodedVaultKey = call.getString("vaultKey");
        String binding = call.getString("vaultBinding");
        if (encodedVaultKey == null || binding == null || binding.isBlank() || binding.length() > 512) {
            call.reject("Faltan datos para activar el acceso rápido de OANIX.");
            return;
        }
        if (!platformSupportsAuthenticatedCrypto()
            || authenticationAvailability() != BiometricManager.BIOMETRIC_SUCCESS) {
            JSObject result = new JSObject();
            result.put("enabled", false);
            result.put("unsupported", true);
            call.resolve(result);
            return;
        }
        if (promptActive) {
            call.reject("Ya hay una autenticación del dispositivo en curso.");
            return;
        }

        final byte[] vaultKeyBytes;
        try {
            vaultKeyBytes = Base64.decode(encodedVaultKey, Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            call.reject("La clave temporal de la bóveda no es válida.");
            return;
        }
        if (vaultKeyBytes.length != VAULT_KEY_BYTES) {
            Arrays.fill(vaultKeyBytes, (byte) 0);
            call.reject("La clave temporal de la bóveda tiene un tamaño inválido.");
            return;
        }

        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            try {
                cipher.init(Cipher.ENCRYPT_MODE, requireBiometricKey());
            } catch (KeyPermanentlyInvalidatedException invalidated) {
                clearBiometricState();
                cipher.init(Cipher.ENCRYPT_MODE, requireBiometricKey());
            }
            cipher.updateAAD(aadForBinding(binding));

            FragmentActivity activity = requireActivity();
            Executor executor = ContextCompat.getMainExecutor(getContext());
            BiometricPrompt prompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult authenticationResult) {
                    super.onAuthenticationSucceeded(authenticationResult);
                    promptActive = false;
                    byte[] ciphertext = null;
                    try {
                        BiometricPrompt.CryptoObject cryptoObject = authenticationResult.getCryptoObject();
                        Cipher authenticatedCipher = cryptoObject == null ? null : cryptoObject.getCipher();
                        if (authenticatedCipher == null) throw new IllegalStateException("Authenticated cipher missing.");

                        ciphertext = authenticatedCipher.doFinal(vaultKeyBytes);
                        preferences().edit()
                            .putInt(PREF_VERSION, ENVELOPE_VERSION)
                            .putString(PREF_IV, Base64.encodeToString(authenticatedCipher.getIV(), Base64.NO_WRAP))
                            .putString(PREF_CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                            .putString(PREF_BINDING, binding)
                            .apply();

                        JSObject result = new JSObject();
                        result.put("enabled", true);
                        call.resolve(result);
                    } catch (Exception error) {
                        clearBiometricState();
                        call.reject("No se pudo activar el acceso rápido de OANIX.", error);
                    } finally {
                        Arrays.fill(vaultKeyBytes, (byte) 0);
                        if (ciphertext != null) Arrays.fill(ciphertext, (byte) 0);
                    }
                }

                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    super.onAuthenticationError(errorCode, errString);
                    promptActive = false;
                    Arrays.fill(vaultKeyBytes, (byte) 0);
                    if (isCancellation(errorCode)) {
                        JSObject result = new JSObject();
                        result.put("enabled", false);
                        result.put("cancelled", true);
                        call.resolve(result);
                    } else {
                        call.reject("No se pudo confirmar la identidad para activar el acceso rápido: " + errString);
                    }
                }
            });

            promptActive = true;
            activity.runOnUiThread(() -> prompt.authenticate(
                promptInfo(
                    "Activar acceso rápido de OANIX",
                    "Confirma con tu huella, rostro o bloqueo del dispositivo"
                ),
                new BiometricPrompt.CryptoObject(cipher)
            ));
        } catch (Exception error) {
            promptActive = false;
            Arrays.fill(vaultKeyBytes, (byte) 0);
            call.reject("No se pudo preparar el acceso rápido de OANIX.", error);
        }
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        String binding = call.getString("vaultBinding");
        if (binding == null || binding.isBlank()) {
            call.reject("Falta identificar la bóveda local.");
            return;
        }
        if (!platformSupportsAuthenticatedCrypto()) {
            call.resolve(passwordFallbackResult("unsupported"));
            return;
        }
        if (!hasStoredEnvelope() || !binding.equals(storedBinding())) {
            call.resolve(passwordFallbackResult("vault-mismatch"));
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
            clearBiometricState();
            call.resolve(passwordFallbackResult("damaged-envelope"));
            return;
        }

        try {
            if (!keyStore().containsAlias(KEY_ALIAS)) {
                Arrays.fill(iv, (byte) 0);
                Arrays.fill(ciphertext, (byte) 0);
                clearBiometricState();
                call.resolve(passwordFallbackResult("missing-key"));
                return;
            }

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            try {
                cipher.init(Cipher.DECRYPT_MODE, requireBiometricKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            } catch (KeyPermanentlyInvalidatedException invalidated) {
                Arrays.fill(iv, (byte) 0);
                Arrays.fill(ciphertext, (byte) 0);
                clearBiometricState();
                call.resolve(passwordFallbackResult("key-invalidated"));
                return;
            }
            cipher.updateAAD(aadForBinding(binding));

            FragmentActivity activity = requireActivity();
            Executor executor = ContextCompat.getMainExecutor(getContext());
            BiometricPrompt prompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult authenticationResult) {
                    super.onAuthenticationSucceeded(authenticationResult);
                    promptActive = false;
                    byte[] plaintext = null;
                    try {
                        BiometricPrompt.CryptoObject cryptoObject = authenticationResult.getCryptoObject();
                        Cipher authenticatedCipher = cryptoObject == null ? null : cryptoObject.getCipher();
                        if (authenticatedCipher == null) throw new IllegalStateException("Authenticated cipher missing.");

                        plaintext = authenticatedCipher.doFinal(ciphertext);
                        if (plaintext.length != VAULT_KEY_BYTES) {
                            throw new IllegalStateException("Invalid vault key length.");
                        }

                        JSObject result = new JSObject();
                        result.put("unlocked", true);
                        result.put("vaultKey", Base64.encodeToString(plaintext, Base64.NO_WRAP));
                        call.resolve(result);
                    } catch (Exception error) {
                        clearBiometricState();
                        call.resolve(passwordFallbackResult("decrypt-failed"));
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
                    if (isCancellation(errorCode)) {
                        JSObject result = new JSObject();
                        result.put("unlocked", false);
                        result.put("cancelled", true);
                        call.resolve(result);
                    } else {
                        call.reject("No se pudo autenticar el acceso a OANIX: " + errString);
                    }
                }
            });

            promptActive = true;
            activity.runOnUiThread(() -> prompt.authenticate(
                promptInfo(
                    "Desbloquear OANIX",
                    "Usa tu huella, rostro o bloqueo del dispositivo"
                ),
                new BiometricPrompt.CryptoObject(cipher)
            ));
        } catch (Exception error) {
            promptActive = false;
            Arrays.fill(iv, (byte) 0);
            Arrays.fill(ciphertext, (byte) 0);
            call.resolve(passwordFallbackResult("unavailable"));
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        clearBiometricState();
        JSObject result = new JSObject();
        result.put("disabled", true);
        call.resolve(result);
    }
}

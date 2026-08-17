package io.github.hnalvaradohn.oanix;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "OanixKeystore")
public class OanixKeystorePlugin extends Plugin {
    private static final String PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "oanix.device-seal.v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int KEY_SIZE_BITS = 256;
    private static final int GCM_TAG_BITS = 128;
    private static final int MAX_PLAINTEXT_BYTES = 4096;

    private KeyStore keyStore() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(PROVIDER);
        keyStore.load(null);
        return keyStore;
    }

    private SecretKey requireKey() throws Exception {
        KeyStore store = keyStore();
        KeyStore.Entry existing = store.getEntry(KEY_ALIAS, null);
        if (existing instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
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
            // Step 3 establishes the non-exportable device key only. Step 4 will replace
            // this with a user-authenticated key after the biometric/device-credential UX is defined.
            .setUserAuthenticationRequired(false)
            .build();

        generator.init(spec);
        return generator.generateKey();
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            KeyStore store = keyStore();
            boolean exists = store.containsAlias(KEY_ALIAS);
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("keyExists", exists);
            result.put("aliasVersion", 1);

            if (exists) {
                SecretKey key = ((KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null)).getSecretKey();
                KeyInfo keyInfo = (KeyInfo) SecretKeyFactory.getInstance(key.getAlgorithm(), PROVIDER)
                    .getKeySpec(key, KeyInfo.class);
                result.put("securityLevel", keyInfo.getSecurityLevel());
                result.put("userAuthenticationRequired", keyInfo.isUserAuthenticationRequired());
            }

            call.resolve(result);
        } catch (Exception error) {
            call.reject("Android Keystore no está disponible en este dispositivo.", error);
        }
    }

    @PluginMethod
    public void ensureKey(PluginCall call) {
        try {
            requireKey();
            JSObject result = new JSObject();
            result.put("created", true);
            result.put("aliasVersion", 1);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo crear la clave protegida del dispositivo.", error);
        }
    }

    @PluginMethod
    public void seal(PluginCall call) {
        String plaintext = call.getString("plaintext");
        String purpose = call.getString("purpose");
        if (plaintext == null || purpose == null || purpose.isBlank()) {
            call.reject("Faltan datos para proteger.");
            return;
        }

        byte[] plaintextBytes = plaintext.getBytes(StandardCharsets.UTF_8);
        if (plaintextBytes.length == 0 || plaintextBytes.length > MAX_PLAINTEXT_BYTES) {
            call.reject("El material a proteger tiene un tamaño inválido.");
            return;
        }

        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, requireKey());
            cipher.updateAAD(purpose.getBytes(StandardCharsets.UTF_8));
            byte[] ciphertext = cipher.doFinal(plaintextBytes);

            JSObject result = new JSObject();
            result.put("version", 1);
            result.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
            result.put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo proteger el material con Android Keystore.", error);
        } finally {
            java.util.Arrays.fill(plaintextBytes, (byte) 0);
        }
    }

    @PluginMethod
    public void open(PluginCall call) {
        String ivEncoded = call.getString("iv");
        String ciphertextEncoded = call.getString("ciphertext");
        String purpose = call.getString("purpose");
        Integer version = call.getInt("version");
        if (version == null || version != 1 || ivEncoded == null || ciphertextEncoded == null || purpose == null || purpose.isBlank()) {
            call.reject("La envoltura protegida no es válida.");
            return;
        }

        byte[] plaintext = null;
        try {
            byte[] iv = Base64.decode(ivEncoded, Base64.NO_WRAP);
            byte[] ciphertext = Base64.decode(ciphertextEncoded, Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, requireKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD(purpose.getBytes(StandardCharsets.UTF_8));
            plaintext = cipher.doFinal(ciphertext);

            JSObject result = new JSObject();
            result.put("plaintext", new String(plaintext, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo abrir el material protegido de este dispositivo.", error);
        } finally {
            if (plaintext != null) java.util.Arrays.fill(plaintext, (byte) 0);
        }
    }

    @PluginMethod
    public void deleteKey(PluginCall call) {
        try {
            KeyStore store = keyStore();
            if (store.containsAlias(KEY_ALIAS)) store.deleteEntry(KEY_ALIAS);
            call.resolve();
        } catch (Exception error) {
            call.reject("No se pudo eliminar la clave protegida del dispositivo.", error);
        }
    }
}

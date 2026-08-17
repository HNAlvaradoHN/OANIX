package io.github.hnalvaradohn.oanix;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OanixKeystorePlugin.class);
        registerPlugin(OanixBiometricPlugin.class);
        registerPlugin(OanixDeviceCredentialPlugin.class);
        registerPlugin(OanixBackPlugin.class);
        registerPlugin(OanixCameraPlugin.class);
        registerPlugin(OanixDocumentsPlugin.class);
        registerPlugin(OanixSharePlugin.class);
        registerPlugin(OanixOutboundSharePlugin.class);
        registerPlugin(OanixAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        if (intent != null) setIntent(intent);
        super.onNewIntent(intent);
    }
}

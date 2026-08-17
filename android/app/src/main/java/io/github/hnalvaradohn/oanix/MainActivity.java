package io.github.hnalvaradohn.oanix;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OanixKeystorePlugin.class);
        registerPlugin(OanixBiometricPlugin.class);
        registerPlugin(OanixCameraPlugin.class);
        registerPlugin(OanixDocumentsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

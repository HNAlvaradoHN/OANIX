package io.github.hnalvaradohn.oanix;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OanixKeystorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

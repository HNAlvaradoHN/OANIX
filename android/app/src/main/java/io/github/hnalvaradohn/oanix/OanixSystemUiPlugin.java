package io.github.hnalvaradohn.oanix;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OanixSystemUi")
public class OanixSystemUiPlugin extends Plugin {
    @PluginMethod
    public void applyTheme(PluginCall call) {
        String background = call.getString("background", "#0A0F18");
        Boolean lightValue = call.getBoolean("light", false);
        final boolean lightSurface = Boolean.TRUE.equals(lightValue);
        final int color;

        try {
            color = Color.parseColor(background);
        } catch (IllegalArgumentException error) {
            call.reject("Invalid system bar color");
            return;
        }

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            View decorView = window.getDecorView();

            // Keep the area behind gesture/navigation chrome visually continuous with OANIX.
            decorView.setBackgroundColor(color);
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setBackgroundColor(color);
            }

            window.setStatusBarColor(color);
            window.setNavigationBarColor(color);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                window.setNavigationBarDividerColor(color);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setNavigationBarContrastEnforced(false);
                window.setStatusBarContrastEnforced(false);
            }

            int flags = decorView.getSystemUiVisibility();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (lightSurface) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                } else {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (lightSurface) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                } else {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
            }
            decorView.setSystemUiVisibility(flags);

            call.resolve(new JSObject());
        });
    }
}

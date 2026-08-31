package io.github.hnalvaradohn.oanix;

import android.os.Build;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import androidx.activity.OnBackPressedCallback;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OanixBack")
public class OanixBackPlugin extends Plugin {
    private OnBackPressedCallback legacyCallback;
    private OnBackInvokedCallback modernCallback;
    private boolean modernCallbackRegistered;

    @Override
    public void load() {
        FragmentActivity activity = requireActivity();

        legacyCallback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                emitBackPressed();
            }
        };
        activity.getOnBackPressedDispatcher().addCallback(activity, legacyCallback);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            modernCallback = this::emitBackPressed;
        }
    }

    private FragmentActivity requireActivity() {
        if (!(getActivity() instanceof FragmentActivity)) {
            throw new IllegalStateException("OANIX back handling requires a FragmentActivity.");
        }
        return (FragmentActivity) getActivity();
    }

    private void emitBackPressed() {
        JSObject payload = new JSObject();
        payload.put("pressed", true);
        notifyListeners("backPressed", payload, false);
    }

    private void setNativeBackEnabled(FragmentActivity activity, boolean enabled) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            OnBackInvokedDispatcher dispatcher = activity.getOnBackInvokedDispatcher();
            if (enabled && !modernCallbackRegistered && modernCallback != null) {
                dispatcher.registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    modernCallback
                );
                modernCallbackRegistered = true;
            } else if (!enabled && modernCallbackRegistered && modernCallback != null) {
                dispatcher.unregisterOnBackInvokedCallback(modernCallback);
                modernCallbackRegistered = false;
            }
            if (legacyCallback != null) legacyCallback.setEnabled(false);
            return;
        }

        if (legacyCallback != null) legacyCallback.setEnabled(enabled);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        FragmentActivity activity = requireActivity();

        activity.runOnUiThread(() -> {
            setNativeBackEnabled(activity, enabled);
            JSObject result = new JSObject();
            result.put("enabled", enabled);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void exitApp(PluginCall call) {
        FragmentActivity activity = requireActivity();
        call.resolve();
        activity.runOnUiThread(activity::finish);
    }

    @Override
    protected void handleOnDestroy() {
        FragmentActivity activity = getActivity() instanceof FragmentActivity
            ? (FragmentActivity) getActivity()
            : null;

        if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (modernCallbackRegistered && modernCallback != null) {
                activity.getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(modernCallback);
            }
        }
        modernCallbackRegistered = false;
        modernCallback = null;

        if (legacyCallback != null) {
            legacyCallback.remove();
            legacyCallback = null;
        }
        super.handleOnDestroy();
    }
}

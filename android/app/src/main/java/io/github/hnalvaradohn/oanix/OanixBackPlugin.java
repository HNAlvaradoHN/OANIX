package io.github.hnalvaradohn.oanix;

import androidx.activity.OnBackPressedCallback;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OanixBack")
public class OanixBackPlugin extends Plugin {
    private OnBackPressedCallback callback;

    @Override
    public void load() {
        FragmentActivity activity = requireActivity();
        callback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                JSObject payload = new JSObject();
                payload.put("pressed", true);
                notifyListeners("backPressed", payload, false);
            }
        };
        activity.getOnBackPressedDispatcher().addCallback(activity, callback);
    }

    private FragmentActivity requireActivity() {
        if (!(getActivity() instanceof FragmentActivity)) {
            throw new IllegalStateException("OANIX back handling requires a FragmentActivity.");
        }
        return (FragmentActivity) getActivity();
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (callback == null) {
            call.reject("El control de regreso de OANIX todavía no está disponible.");
            return;
        }

        callback.setEnabled(enabled);
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void exitApp(PluginCall call) {
        FragmentActivity activity = requireActivity();
        call.resolve();
        activity.runOnUiThread(activity::finish);
    }

    @Override
    protected void handleOnDestroy() {
        if (callback != null) {
            callback.remove();
            callback = null;
        }
        super.handleOnDestroy();
    }
}

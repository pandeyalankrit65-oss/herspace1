package app.herspace;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Disguised mode can also change the app's icon and name on the home screen to "Calculator".
// The manifest has two launcher entries (activity-aliases) for the same activity; one is enabled
// at a time. Android removes the old entry's icon from the home screen when they switch, so she
// adds the calculator one back from the app list.
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    private static final String NORMAL = "app.herspace.LauncherHerSpace";
    private static final String CALCULATOR = "app.herspace.LauncherCalculator";

    static boolean isCalculator(Context context) {
        int state = context.getPackageManager().getComponentEnabledSetting(new ComponentName(context, CALCULATOR));
        return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
    }

    // The name shown for the app in the list of recent apps follows the icon.
    static void updateTaskName(Activity activity) {
        String label = activity.getString(isCalculator(activity) ? R.string.calculator_name : R.string.app_name);
        activity.setTaskDescription(
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? new ActivityManager.TaskDescription.Builder().setLabel(label).build()
                : legacyTaskDescription(label)
        );
    }

    @SuppressWarnings("deprecation")
    private static ActivityManager.TaskDescription legacyTaskDescription(String label) {
        return new ActivityManager.TaskDescription(label);
    }

    @Override
    public void load() {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> updateTaskName(activity));
    }

    @PluginMethod
    public void get(PluginCall call) {
        JSObject result = new JSObject();
        result.put("calculator", isCalculator(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void set(PluginCall call) {
        boolean calculator = Boolean.TRUE.equals(call.getBoolean("calculator", false));
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        // Enable the new entry before disabling the old one, so there's always a way to open the app.
        pm.setComponentEnabledSetting(
            new ComponentName(context, calculator ? CALCULATOR : NORMAL),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP
        );
        pm.setComponentEnabledSetting(
            new ComponentName(context, calculator ? NORMAL : CALCULATOR),
            calculator ? PackageManager.COMPONENT_ENABLED_STATE_DISABLED : PackageManager.COMPONENT_ENABLED_STATE_DEFAULT,
            PackageManager.DONT_KILL_APP
        );
        Activity activity = getActivity();
        activity.runOnUiThread(() -> updateTaskName(activity));
        JSObject result = new JSObject();
        result.put("calculator", calculator);
        call.resolve(result);
    }
}

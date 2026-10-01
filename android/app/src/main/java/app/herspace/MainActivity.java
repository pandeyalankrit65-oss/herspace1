package app.herspace;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins that live in this app (not in npm packages) must be registered before the bridge starts.
        registerPlugin(PrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package app.herspace;

import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// window.print() does nothing in Android's WebView, so pages like the evidence pack ask
// Android's print service to print the WebView instead. Its dialog includes "Save as PDF",
// and the page's print stylesheet still applies.
@CapacitorPlugin(name = "Print")
public class PrintPlugin extends Plugin {

    // The app's dark WebView background would show in the page margins, so it is white while
    // printing (the page itself covers the WebView, so nothing changes on screen).
    private static final int APP_BACKGROUND = Color.parseColor("#121216");

    @PluginMethod
    public void print(PluginCall call) {
        String title = call.getString("title", "HerSpace");
        getActivity().runOnUiThread(() -> {
            PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            if (manager == null) {
                call.reject("Printing isn't available on this phone.");
                return;
            }
            WebView webView = getBridge().getWebView();
            webView.setBackgroundColor(Color.WHITE);
            PrintDocumentAdapter adapter = new RestoreBackground(webView.createPrintDocumentAdapter(title), webView);
            PrintAttributes attributes = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
            manager.print(title, adapter, attributes);
            call.resolve();
        });
    }

    // Passes everything to the WebView's adapter, and puts the background back when done.
    private static class RestoreBackground extends PrintDocumentAdapter {
        private final PrintDocumentAdapter inner;
        private final WebView webView;

        RestoreBackground(PrintDocumentAdapter inner, WebView webView) {
            this.inner = inner;
            this.webView = webView;
        }

        @Override
        public void onStart() {
            inner.onStart();
        }

        @Override
        public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancel, LayoutResultCallback callback, Bundle extras) {
            inner.onLayout(oldAttributes, newAttributes, cancel, callback, extras);
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancel, WriteResultCallback callback) {
            inner.onWrite(pages, destination, cancel, callback);
        }

        @Override
        public void onFinish() {
            inner.onFinish();
            webView.post(() -> webView.setBackgroundColor(APP_BACKGROUND));
        }
    }
}

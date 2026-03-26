package com.himmelfisk.documentation;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    protected void load() {
        super.load();

        // Replace the default WebView client with one that intercepts
        // redirects back to the app origin.  When an external page such as
        // the Microsoft login page redirects to https://localhost (the
        // Capacitor app origin), a normal in-WebView navigation can fail
        // with ERR_CONNECTION_REFUSED because the local asset server does
        // not handle redirects from foreign origins.  Re-issuing the
        // navigation via loadUrl() follows the same code-path as the
        // initial app load, which Capacitor handles correctly.
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();

                if ("localhost".equals(url.getHost()) && "https".equals(url.getScheme())) {
                    view.post(() -> view.loadUrl(url.toString()));
                    return true;
                }

                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}

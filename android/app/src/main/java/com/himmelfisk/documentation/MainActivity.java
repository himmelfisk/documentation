package com.himmelfisk.documentation;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void load() {
        super.load();

        // After navigating to an external identity-provider page (e.g.
        // login.microsoftonline.com) the redirect back to https://localhost
        // can fail with ERR_CONNECTION_REFUSED because the WebView bypasses
        // Capacitor's shouldInterceptRequest for the main-frame redirect.
        // Intercept the navigation and use loadUrl() which follows the
        // normal Capacitor asset-serving path.
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("localhost".equals(url.getHost()) && "https".equals(url.getScheme())) {
                    String urlStr = url.toString();
                    view.post(() -> view.loadUrl(urlStr));
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}

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

        /*
         * Replace the default BridgeWebViewClient so we can intercept
         * navigations back to https://localhost after the Microsoft
         * identity-provider redirect.
         *
         * Problem
         * -------
         * After the user authenticates on login.microsoftonline.com,
         * Azure AD redirects the WebView to https://localhost/#code=…
         * Capacitor's WebViewLocalServer normally serves local assets
         * via shouldInterceptRequest, but for cross-origin redirects
         * (from the external login page back to localhost) the WebView
         * may attempt a real HTTPS connection, which fails with
         * ERR_CONNECTION_REFUSED because there is no TLS server on the
         * device.
         *
         * Fix
         * ---
         * Intercept the navigation in shouldOverrideUrlLoading and
         * call view.loadUrl(url) instead.  loadUrl() follows the same
         * code path as the initial page load, where shouldInterceptRequest
         * reliably serves index.html from the app assets.
         *
         * The hash fragment (#code=…&state=…) IS preserved by
         * WebResourceRequest.getUrl() inside shouldOverrideUrlLoading
         * (unlike shouldInterceptRequest, which strips it because the
         * fragment is not part of an HTTP request).  view.loadUrl()
         * with a fragment sets window.location.hash, allowing MSAL's
         * handleRedirectPromise() to read and process the auth response.
         *
         * The sessionStorage → localStorage mirror in auth.js ensures
         * that MSAL's temporary interaction state (PKCE code-verifier,
         * request params, interaction status) survives the loadUrl()
         * page reload, because MSAL's getTemporaryCache() falls back
         * to localStorage when cacheLocation is 'localStorage'.
         */
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("localhost".equals(url.getHost())
                        && "https".equals(url.getScheme())) {
                    // Re-load through the standard Capacitor asset-serving path.
                    // view.post() avoids re-entrancy from within this callback.
                    view.post(() -> view.loadUrl(url.toString()));
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}

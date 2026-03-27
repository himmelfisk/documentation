package com.himmelfisk.documentation;

import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    @Override
    protected void load() {
        super.load();
        bridge.setWebViewClient(new AuthRedirectWebViewClient(bridge));
    }

    /**
     * Custom WebView client that fixes MSAL auth-redirect handling on Android.
     *
     * After authenticating with Microsoft the browser redirects to
     * {@code https://localhost/#code=…}.  Capacitor's local-asset server may
     * fail to intercept the root-URL request, causing ERR_CONNECTION_REFUSED.
     *
     * Three layers of defence:
     * <ol>
     *   <li>{@code shouldOverrideUrlLoading} – intercepts the redirect
     *       <em>before</em> the WebView makes a network request.  Extracts the
     *       hash fragment (MSAL auth response) and re-loads the app through
     *       {@code view.loadUrl()} which follows Capacitor's working
     *       initial-load path.  (Called for server redirects on API 24+.)</li>
     *   <li>{@code shouldInterceptRequest} fallback – serves {@code index.html}
     *       from assets when the default handler misses the root localhost URL.</li>
     *   <li>{@code onReceivedError} fallback – if the request still fails,
     *       extracts the hash from the request URL and reloads.</li>
     * </ol>
     */
    private static class AuthRedirectWebViewClient extends BridgeWebViewClient {

        private final Bridge bridge;
        private boolean errorRecoveryAttempted = false;

        AuthRedirectWebViewClient(Bridge bridge) {
            super(bridge);
            this.bridge = bridge;
        }

        // ---- Layer 1: intercept BEFORE the network request (API 24+) ----

        @Override
        public boolean shouldOverrideUrlLoading(WebView view,
                                                WebResourceRequest request) {
            Uri url = request.getUrl();
            if (isLocalhostRoot(url)) {
                // Re-load through view.loadUrl() which uses Capacitor's
                // shouldInterceptRequest path.  Preserve the hash fragment
                // so MSAL can process the auth response.
                view.post(() -> view.loadUrl(buildLocalhostUrl(url)));
                return true;
            }
            return super.shouldOverrideUrlLoading(view, request);
        }

        // ---- Layer 2: serve index.html for root localhost URL ----

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view,
                                                          WebResourceRequest request) {
            WebResourceResponse response = super.shouldInterceptRequest(view, request);

            if (response == null && isLocalhostRoot(request.getUrl())) {
                try {
                    InputStream is = view.getContext()
                            .getAssets()
                            .open("public/index.html");
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Content-Type", "text/html; charset=UTF-8");
                    return new WebResourceResponse(
                            "text/html", "UTF-8", 200, "OK", headers, is);
                } catch (IOException e) {
                    android.util.Log.w("MainActivity",
                            "Failed to serve index.html fallback", e);
                }
            }

            return response;
        }

        // ---- Layer 3: recover from a failed navigation ----

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request,
                                    WebResourceError error) {
            if (request.isForMainFrame() && isLocalhostRoot(request.getUrl())
                    && !errorRecoveryAttempted) {
                errorRecoveryAttempted = true;
                view.post(() -> view.loadUrl(buildLocalhostUrl(request.getUrl())));
                return;
            }
            super.onReceivedError(view, request, error);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            errorRecoveryAttempted = false;
        }

        /**
         * Build a localhost URL preserving the hash fragment from the
         * given URI (if present).
         */
        private static String buildLocalhostUrl(Uri url) {
            String fragment = url.getFragment();
            if (fragment != null && !fragment.isEmpty()) {
                return "https://localhost/#" + fragment;
            }
            return "https://localhost/";
        }

        private static boolean isLocalhostRoot(Uri url) {
            if (!"https".equals(url.getScheme()) || !"localhost".equals(url.getHost())) {
                return false;
            }
            String path = url.getPath();
            return path == null || path.isEmpty() || "/".equals(path);
        }
    }
}

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
     * Two layers of defence:
     * <ol>
     *   <li>{@code shouldInterceptRequest} fallback – serves {@code index.html}
     *       from assets when the default handler misses the root localhost URL.</li>
     *   <li>{@code onReceivedError} fallback – if the request still fails,
     *       captures the hash fragment (MSAL auth response) into
     *       {@code localStorage} and reloads the app via Capacitor's working
     *       initial-load path.</li>
     * </ol>
     */
    private static class AuthRedirectWebViewClient extends BridgeWebViewClient {

        private final Bridge bridge;

        AuthRedirectWebViewClient(Bridge bridge) {
            super(bridge);
            this.bridge = bridge;
        }

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

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request,
                                    WebResourceError error) {
            if (request.isForMainFrame() && isLocalhostRoot(request.getUrl())) {
                // The redirect to localhost failed.  Try to capture the MSAL
                // hash fragment and reload through Capacitor's local server.
                view.evaluateJavascript(
                    "(function(){" +
                        "var h=window.location.hash;" +
                        "if(h){try{" +
                            "localStorage.setItem('__msal_hash',h);" +
                            "localStorage.setItem('__msal_hash_ts',Date.now().toString());" +
                        "}catch(e){console.error('msal-hash save failed',e);}}" +
                        "return h||'';" +
                    "})()",
                    hash -> view.post(() -> bridge.reload())
                );
                return;
            }
            super.onReceivedError(view, request, error);
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

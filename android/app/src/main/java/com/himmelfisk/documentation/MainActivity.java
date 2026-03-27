package com.himmelfisk.documentation;

import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    /**
     * Holds the auth-response hash fragment captured from a redirect to
     * https://localhost after Microsoft login.  It is injected into the
     * WebView once the app page has finished reloading.
     */
    private String pendingAuthFragment = null;

    @Override
    protected void load() {
        super.load();

        /*
         * Replace the default BridgeWebViewClient to handle the MSAL
         * auth redirect back to https://localhost on Android.
         *
         * Problem
         * -------
         * After authenticating on login.microsoftonline.com, Azure AD
         * redirects the WebView to  https://localhost/#code=…&state=…
         * For cross-origin redirects the WebView may bypass Capacitor's
         * shouldInterceptRequest and attempt a real HTTPS connection to
         * localhost, which fails with ERR_CONNECTION_REFUSED.
         *
         * Previous attempts that called view.loadUrl(fullUrl) directly
         * from shouldOverrideUrlLoading did not resolve the issue on
         * all devices.
         *
         * Fix
         * ---
         * Two-layer interception:
         *
         * 1. shouldOverrideUrlLoading (primary) – captures the hash
         *    fragment from the redirect URL, then reloads the app via
         *    bridge.reload() which follows the same code-path as the
         *    initial page load.
         *
         * 2. onReceivedError (fallback) – on devices / WebView versions
         *    where shouldOverrideUrlLoading is not invoked for HTTP 302
         *    redirects, the request reaches the network stack and fails.
         *    We catch the error here and reload the app.
         *
         * After the app reloads, onPageFinished injects the saved hash
         * fragment via evaluateJavascript, and the JavaScript side waits
         * for it before calling MSAL's handleRedirectPromise().
         */
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {

            /* ---- primary: intercept navigation-level redirects ---- */

            @Override
            public boolean shouldOverrideUrlLoading(WebView view,
                    WebResourceRequest request) {
                Uri url = request.getUrl();
                if (isLocalhostAuthRedirect(url)) {
                    pendingAuthFragment = url.getFragment();
                    view.post(() -> bridge.reload());
                    return true;   // cancel the original navigation
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            /* ---- fallback: network-level error after a 302 ---- */

            @Override
            public void onReceivedError(WebView view,
                    WebResourceRequest request, WebResourceError error) {
                if (pendingAuthFragment == null
                        && request.isForMainFrame()
                        && "localhost".equals(request.getUrl().getHost())
                        && "https".equals(request.getUrl().getScheme())) {
                    // Try to get the fragment from the request URL.
                    // Some WebView versions include it, others strip it.
                    String frag = request.getUrl().getFragment();
                    // Empty string = "we know a redirect happened but lost the
                    // hash"; onPageFinished will skip the injection and the JS
                    // side will fall through to the cached-session check.
                    pendingAuthFragment = (frag != null) ? frag : "";
                    view.post(() -> bridge.reload());
                    return;   // skip super to avoid loading an error page
                }
                super.onReceivedError(view, request, error);
            }

            /* ---- inject saved hash after the app page reloads ---- */

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);

                if (pendingAuthFragment != null) {
                    String frag = pendingAuthFragment;
                    pendingAuthFragment = null;

                    if (!frag.isEmpty()) {
                        // Use JSONObject.quote to safely escape the fragment
                        // for JavaScript injection (prevents XSS via crafted URLs).
                        String escaped = JSONObject.quote(frag);
                        view.evaluateJavascript(
                                "window.location.hash='#'+"+escaped+";",
                                null);
                    }
                }
            }
        });
    }

    /** True when the URI looks like an MSAL auth redirect to localhost. */
    private static boolean isLocalhostAuthRedirect(Uri url) {
        String frag = url.getFragment();
        return "localhost".equals(url.getHost())
                && "https".equals(url.getScheme())
                && frag != null
                && frag.contains("code=")
                && frag.contains("state=");
    }
}

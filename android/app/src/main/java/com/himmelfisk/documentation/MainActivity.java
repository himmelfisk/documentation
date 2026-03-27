package com.himmelfisk.documentation;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /*
     * No custom shouldOverrideUrlLoading needed.
     *
     * Capacitor's default BridgeWebViewClient already handles the redirect
     * from the Microsoft identity provider back to https://localhost:
     *
     *   1. shouldOverrideUrlLoading → launchIntent() returns false for
     *      localhost (same-origin), so the WebView handles the navigation.
     *   2. shouldInterceptRequest → WebViewLocalServer serves the local
     *      index.html from the app assets.
     *   3. The URL hash fragment (#code=…&state=…) is preserved in
     *      window.location.hash, allowing MSAL's handleRedirectPromise()
     *      to complete the authentication flow.
     *
     * A previous override intercepted localhost URLs and called
     * view.loadUrl(), but WebResourceRequest.getUrl() strips the hash
     * fragment, which contains the MSAL auth response.  This caused
     * handleRedirectPromise() to return null and the login screen to
     * reappear after a successful sign-in.
     */
}

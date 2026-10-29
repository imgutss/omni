package net.omnigate.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.floatingactionbutton.FloatingActionButton

/**
 * Omni · v0.1.0 — پنل Omni در قالب اپ برنددار.
 * WebView امن (بدون file-access، بدون محتوای mixed) + دریافت کانفیگ از بیرون + فهرست کانفیگ‌ها.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var progress: ProgressBar
    private var offline = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.web)
        progress = findViewById(R.id.progress)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportZoom(false)
        }

        // پل بازگشت از صفحهٔ آفلاین
        web.addJavascriptInterface(object {
            @JavascriptInterface
            fun go() {
                runOnUiThread { loadPanel() }
            }
        }, "OmniRetry")

        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
            }
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme?.lowercase() ?: return false
                // داخل پنل: همان WebView
                if ((scheme == "https" || scheme == "http") && uri.host == HOST) return false
                // هر لینک بیرونی (تلگرام، …) در اپلیکیشن مربوطه باز شود
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: Exception) {
                    true
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    offline = true
                    progress.visibility = View.GONE
                    web.loadUrl("file:///android_asset/offline.html")
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                offline = url?.startsWith("file:///android_asset") == true
            }
        }

        findViewById<FloatingActionButton>(R.id.fabImports).setOnClickListener {
            startActivity(Intent(this, ConfigsActivity::class.java))
        }

        val link = intent?.data
        if (link != null && link.host == HOST) {
            web.loadUrl(link.toString())
        } else {
            loadPanel()
        }

        if (intent?.getBooleanExtra("imported", false) == true) {
            Toast.makeText(this, getString(R.string.import_added), Toast.LENGTH_SHORT).show()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val link = intent?.data
        if (link != null && link.host == HOST) web.loadUrl(link.toString())
        if (intent?.getBooleanExtra("imported", false) == true) {
            Toast.makeText(this, getString(R.string.import_added), Toast.LENGTH_SHORT).show()
        }
    }

    private fun loadPanel() {
        offline = false
        web.loadUrl(PANEL_URL)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (!offline && web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    companion object {
        const val HOST = "omni.omni-swift-43a3.workers.dev"
        const val PANEL_URL = "https://$HOST/"
    }
}

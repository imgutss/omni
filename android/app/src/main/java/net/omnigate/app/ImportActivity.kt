package net.omnigate.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray

/**
 * دریافت کانفیگ از بیرون (لینک‌های vless://، aether:// و … از بات یا هر اپ دیگر).
 * ذخیره در SharedPreferences (نسخهٔ v0.1 — سمت سرور بعداً).
 */
class ImportActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val raw = intent?.data?.toString()
        val scheme = intent?.data?.scheme?.lowercase()

        if (raw.isNullOrBlank() || scheme == null || scheme !in SCHEMES) {
            Toast.makeText(this, R.string.import_bad, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val stored = readImports(prefs)
        val exists = stored.contains(raw)
        if (!exists) {
            val next = ArrayList(stored)
            next.add(0, raw)
            writeImports(prefs, next)
        }

        Toast.makeText(
            this,
            if (exists) R.string.import_dup else R.string.import_added,
            Toast.LENGTH_SHORT
        ).show()

        startActivity(
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("imported", true)
            }
        )
        finish()
    }

    companion object {
        val SCHEMES = setOf(
            "vless", "vmess", "trojan", "ss", "hysteria2", "hy2",
            "tuic", "wireguard", "aether", "omni"
        )
        const val PREFS = "omni.imports"
        const val KEY = "items"

        fun readImports(prefs: android.content.SharedPreferences): List<String> {
            val arr = JSONArray(prefs.getString(KEY, "[]") ?: "[]")
            return (0 until arr.length()).map { arr.getString(it) }
        }

        fun writeImports(prefs: android.content.SharedPreferences, items: List<String>) {
            val arr = JSONArray()
            items.forEach { arr.put(it) }
            prefs.edit().putString(KEY, arr.toString()).apply()
        }
    }
}

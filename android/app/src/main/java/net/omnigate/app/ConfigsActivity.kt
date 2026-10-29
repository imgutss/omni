package net.omnigate.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * فهرست کانفیگ‌های دریافت‌شده — کپی / اشتراک / حذف.
 */
class ConfigsActivity : AppCompatActivity() {

    private lateinit var container: LinearLayout
    private lateinit var empty: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_configs)
        container = findViewById(R.id.container)
        empty = findViewById(R.id.empty)
        refresh()
    }

    private fun prefs() = getSharedPreferences(ImportActivity.PREFS, Context.MODE_PRIVATE)

    private fun refresh() {
        val items = ImportActivity.readImports(prefs())
        container.removeAllViews()
        empty.visibility = if (items.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE

        items.forEachIndexed { index, uri ->
            container.addView(row(index, uri))
        }
    }

    private fun row(index: Int, uri: String) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        val pad = (16 * resources.displayMetrics.density).toInt()
        setPadding(pad, pad, pad, pad)
        setBackgroundColor(ContextCompat.getColor(this@ConfigsActivity, R.color.surface))

        val lp = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = pad }
        layoutParams = lp

        addView(TextView(this@ConfigsActivity).apply {
            text = uri
            textSize = 12f
            gravity = Gravity.START
            maxLines = 3
            ellipsize = android.text.TextUtils.TruncateAt.END
            setTextColor(ContextCompat.getColor(this@ConfigsActivity, R.color.text_dim))
        })

        addView(LinearLayout(this@ConfigsActivity).apply {
            orientation = LinearLayout.HORIZONTAL
            val btnLp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { marginStart = 8 }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 8 }

            addView(smallBtn(getString(R.string.copy)) {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("omni", uri))
                Toast.makeText(this@ConfigsActivity, R.string.copied, Toast.LENGTH_SHORT).show()
            }, btnLp)

            addView(smallBtn(getString(R.string.share)) {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, uri)
                }
                startActivity(Intent.createChooser(send, getString(R.string.share)))
            }, btnLp)

            addView(smallBtn(getString(R.string.delete)) {
                val items = ArrayList(ImportActivity.readImports(prefs()))
                if (index in items.indices) {
                    items.removeAt(index)
                    ImportActivity.writeImports(prefs(), items)
                    refresh()
                }
            }, btnLp)
        })
    }

    private fun smallBtn(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        textSize = 12f
        isAllCaps = false
        setOnClickListener { onClick() }
    }
}

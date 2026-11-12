package com.bertmarti.lazo;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * «Compartir → Lazo» con texto plano. La web pide el texto con take() al arrancar (app cerrada) y escucha «share»
 * (app abierta, launchMode singleTask). Cada texto se entrega una vez; como mucho 2 MB, igual que el pegado.
 */
@CapacitorPlugin(name = "LazoShare")
public class SharePlugin extends Plugin {
    private static final int MAX = 2_000_000;

    @PluginMethod
    public void take(PluginCall call) {
        JSObject r = new JSObject();
        String text = consume(getActivity().getIntent());
        if (text != null) r.put("text", text);
        call.resolve(r);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String text = consume(intent);
        if (text == null) return;
        JSObject d = new JSObject();
        d.put("text", text);
        notifyListeners("share", d, true);
    }

    private static String consume(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction()) || intent.getType() == null || !intent.getType().startsWith("text/plain")) return null;
        CharSequence cs = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        intent.setAction(Intent.ACTION_MAIN); // entregado: no se repite al girar la pantalla
        if (cs == null) return null;
        String text = cs.toString();
        return text.length() > MAX ? text.substring(0, MAX) : text;
    }
}

package com.bertmarti.lazo;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // V11-3: si Android recrea la actividad (proceso muerto, o reabierta desde Recientes) vuelve a dar el intent
        // original. Lo compartido ya se entregó la primera vez: no se repite.
        if (savedInstanceState != null || (getIntent().getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) {
            setIntent(new Intent(Intent.ACTION_MAIN));
        }
        registerPlugin(SharePlugin.class); // «Compartir → Lazo» (importar lista de Amazon)
        super.onCreate(savedInstanceState);
    }
}

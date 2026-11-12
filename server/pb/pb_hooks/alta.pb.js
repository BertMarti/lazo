/// <reference path="../pb_data/types.d.ts" />
// Alta del organizador en una instalación nueva (no hay alta pública):
//   pocketbase lazo-alta "Alberto" "Navidad en familia" [AAAA-MM-DD]
// Crea su cuenta y el grupo, y deja un código de 60 minutos para entrar desde el móvil («Tengo un código»).
$app.rootCmd.addCommand(
  new Command({
    use: 'lazo-alta <nombre> <grupo> [AAAA-MM-DD]',
    short: 'Crea la cuenta del organizador y su grupo, y da un código para entrar',
    runE: (cmd, args) => {
      const [name, groupName, date] = (args || []).map((a) => String(a).trim());
      if (!name || !groupName || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
        throw new Error('Uso: pocketbase lazo-alta "Alberto" "Navidad en familia" [AAAA-MM-DD]');
      }
      const L = require(`${__hooks}/lib/lazo.cjs`);
      const code = $security.randomStringWithAlphabet(8, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'); // el de device-code
      $app.runInTransaction((tx) => {
        const user = L.newUser(tx, name, 0);
        const g = new Record(tx.findCollectionByNameOrId('groups'));
        g.set('name', groupName.slice(0, 80));
        g.set('occasion', 'navidad');
        if (date) g.set('date', date);
        g.set('owner', user.id);
        g.set('admins', [user.id]);
        g.set('members', [user.id]);
        g.set('buyMode', 'mixto');
        g.set('currency', 'EUR');
        g.set('allowNewNames', true);
        for (const f of ['treasurer', 'deputy', 'revealAskedBy']) g.set(f, '');
        g.set('revealedAt', 0);
        g.set('drawRounds', 0);
        tx.save(g); // onRecordCreate de groups crea la plaza del creador
        const dc = new Record(tx.findCollectionByNameOrId('deviceCodes'));
        dc.set('user', user.id);
        dc.set('codeHash', $security.sha256(code));
        dc.set('expiresAt', Date.now() + 60 * 60000);
        tx.save(dc);
      });
      console.log(`Listo: grupo «${groupName}» creado para ${name}.`);
      console.log(`Abre Lazo en tu móvil → "Tengo un código" → escribe ${code}`);
      console.log('El código vale 60 minutos y una sola vez.');
    },
  }),
);

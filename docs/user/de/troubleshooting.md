# Fehlerbehebung

## Der Fernseher zeigt nichts, oder kein Ton

- **Schalte den Fernseher ein und wähle seinen HDMI-Eingang**, vor oder nach dem Start der Box; beides geht. Die Box
  braucht nach dem Einschalten etwa eine Minute, bis der Warte-Bildschirm erscheint.
- **Probier ein anderes HDMI-Kabel oder einen anderen Anschluss** am Fernseher. Adapter auf VGA oder DVI funktionieren
  oft nicht.
- **Kein Ton:** Prüfe die Lautstärke des Fernsehers und dass er nicht stumm ist. Prüfe *Ton* auf der Spielseite: Die
  Lautstärke dort gilt für alle Anzeigen. Ein Fernseher, der nach der Box eingeschaltet wurde, bekommt seinen Ton nach
  ein paar Sekunden von selbst zurück.
- **Eine zweite Anzeige an einem Laptop hat keinen Ton** und zeigt *Klicken, um den Ton einzuschalten*: Klicke einmal in
  dieses Fenster. Browser spielen Ton erst nach einem Klick ab.

## Mein Gerät findet das WLAN nicht oder kann sich nicht verbinden

- Warte nach dem Einschalten der Box eine Minute; ihr WLAN kommt, sobald sie gestartet ist.
- Prüfe den Namen: Er ist `BuzzerBoxNetwork`, es sei denn, jemand hat ihn
  [geändert](box-settings-and-updates.md#die-einstellungen-der-box).
- **Dein Handy meldet, dass das WLAN kein Internet hat**, und wechselt zurück zu mobilen Daten oder einem anderen WLAN:
  Sag ihm, dass es verbunden bleiben soll. Schalte bei manchen Handys für das Spiel die mobilen Daten aus.
- **`buzzer.box` öffnet sich nicht:** Tippe `http://buzzer.box` mit `http://` ein, oder nimm die Adresse
  `http://10.0.0.5`. Manche Browser suchen nach `buzzer.box`, statt es zu öffnen. Auch ein VPN oder eine Einstellung
  „privates DNS“ auf dem Gerät kann stören; schalte sie aus.
- Geh näher an die Box heran. Wände und eine Box in einem Metallgehäuse schwächen ihr WLAN stark.

## Die Spielleitung verbindet sich nicht, oder meldet, dass ein anderes Gerät steuert

- *Warte auf Verbindung zum Server* heißt, das Gerät hat die Box erreicht, aber nicht ihre Spielsoftware. Warte ein paar
  Sekunden; es versucht es weiter. Direkt nach einem Update oder Stromausfall dauert das bis zu einer Minute.
- *Ein anderes Gerät steuert gerade die BuzzerBox*: Es kann nur ein Gerät die Spielleitung sein. War das dein eigenes
  Gerät und hat es nur das WLAN verloren oder neu geladen, macht es nach ein paar Sekunden von selbst weiter. Sonst
  tippe auf **Steuerung übernehmen**; ein laufendes Spiel geht auf deinem Gerät weiter.
- Alles scheint zu hängen: **Server zurücksetzen** auf der Startseite lässt alle Geräte von vorne anfangen. Deine Spiele
  und Spielstände bleiben erhalten. Als letzter Ausweg: Schalte die Box aus und wieder ein; **Spiel fortsetzen** spielt
  dann ein Spiel weiter, das lief.

## Ein Buzzer reagiert nicht

**Kabelgebundene Buzzer:**

- Prüfe, dass das Spiel mit den **analogen Buzzern** gespielt wird und dass dieser Buzzer ein Team hat. Ein Buzzer ohne
  Team zählt nicht.
- Sind die Buzzer **gesperrt**? Nach einem Buzzern bleiben sie gesperrt, bis du die Antwort bewertest oder sie
  freigibst. Der große Knopf in der Mitte der Spielseite zeigt es.
- Steck den Buzzer in eine andere Buchse, um zu sehen, ob der Buzzer oder die Buchse das Problem ist.
- Leuchtet der Punkt der Anzeige an der Box, hat die Buzzer-Platine der Box die Verbindung zur Spielsoftware verloren;
  schalte die Box aus und wieder ein.

**Funkbuzzer:** siehe [Wenn ein Buzzer offline ist](wireless-buzzers.md#wenn-ein-buzzer-offline-ist). Kurz gesagt:
Drück seinen Knopf, um ihn zu wecken, schau auf sein Licht, lade ihn, oder übernimm ihn erneut über USB.

**Zwei Teams haben gleichzeitig gebuzzert:** Die Box nimmt das, das zuerst gedrückt hat, auch bei Funkbuzzern, deren
Drücken etwas später ankommt.

## Ein Video ruckelt, läuft nicht oder läuft ohne Bild

Die BuzzerBox spielt **H.264-Videos in `.mp4`-Dateien bis 1080p und 30 Bilder pro Sekunde** flüssig ab. Videos von
iPhones (HEVC/H.265), 4K-Videos und Videos mit 60 Bildern pro Sekunde ruckeln oft oder laufen nicht. Wandle sie um wie
unter [Spiele erstellen](creating-games.md#welche-dateien-funktionieren) beschrieben, und probier sie vor dem Spiel auf
der Box aus.

Ein Video läuft auf dem Fernseher, aber nicht auf einer zweiten Anzeige an einem Laptop: Diesem Browser fehlt
vielleicht der Codec; was zählt, ist der Fernseher an der Box.

## Eine Frage zeigt kein Bild oder Video

Dem Spiel fehlt die Datei. Beim Vorbereiten des Spiels listet die Seite die fehlenden Medien auf. Sie fehlen, wenn:

- sie auf einem **USB-Stick** waren, der nicht eingesteckt ist, bei einem Spiel, das auf diesem Stick liegt, oder
- das Spiel **ohne seine Medien** importiert wurde, aus einer `.json`-Datei.

Lade Dateien mit denselben Namen in die Medien des Spiels hoch (*Spiele verwalten* → das Spiel → *Medien*), oder
importiere stattdessen das ganze Spiel (`.buzzerbox.tar.gz`).

## Der Spielstand ist weg, oder das Speichern schlägt fehl

- Das Wolkensymbol in der Werkzeugleiste meldet *Speichern fehlgeschlagen*, wenn der Spielstand auf einem **USB-Stick
  liegt, der abgezogen wurde**. Steck ihn wieder ein; die Box versucht es weiter.
- **Spiel verwerfen** löscht den Spielstand; **Spiel pausieren** behält ihn. Ein verworfenes Spiel lässt sich nicht
  zurückholen.
- Ein Spielstand liegt dort, wo sein Spiel liegt: Schau in **Spiel fortsetzen** unter dem anderen Speicherort (der Box
  oder dem Stick).

## Die Uhr der Box geht falsch

Die Box hat keine eigene Uhr. Sie nimmt die Zeit vom Gerät der Spielleitung, also stimmen die Zeiten der Spielstände,
solange die Zeit dieses Geräts stimmt.

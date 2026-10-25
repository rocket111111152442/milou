# Veille Ondes

Logiciel qui tourne **uniquement sur votre ordinateur** et qui fait l'inventaire des ondes radio que
l'ordinateur (ou un récepteur branché) peut capter, cherche des caméras, vérifie votre réseau, et cherche des
signes de piratage de l'ordinateur et d'un téléphone Android.
Il produit un rapport en français qui dit, pour chaque point, si c'est normal ou non, et quoi faire.

Aucune donnée n'est envoyée sur Internet. Les résultats restent dans le dossier `donnees/`.

## Ce que le logiciel vérifie

| Module | Ce qui est mesuré | Matériel nécessaire |
|---|---|---|
| Wi-Fi | Tous les réseaux Wi-Fi visibles, leur puissance, leur sécurité ; un éventuel faux réseau qui imite le vôtre ; une estimation du champ (V/m) comparée à la limite légale | Carte Wi-Fi (déjà présente sur un portable) |
| Bluetooth | Tous les appareils Bluetooth basse consommation à portée, avec repérage des traceurs (AirTag, SmartTag, Tile, traceurs Google) | Bluetooth (déjà présent sur un portable) |
| Réseau local | Les appareils connectés à votre box, avec alerte si un appareil inconnu apparaît | Rien |
| Ordinateur | Logiciels de prise de contrôle à distance (TeamViewer, AnyDesk, VNC…), accès à distance ouverts, programmes au démarrage, antivirus Windows | Rien |
| Caméras | Caméras et enregistreurs vidéo branchés sur votre box (protocoles RTSP / ONVIF, pages de connexion), mini-caméras Wi-Fi qui créent leur propre réseau | Rien (détecteur de lentilles conseillé pour l'inspection physique) |
| Téléphone Android | Applications installées comparées à la liste publique de 644 logiciels espions connus, droits typiques des logiciels espions (accessibilité, administrateur, notifications, pas d'icône), root, mises à jour ; désactivation ou désinstallation d'une application | Câble USB + outil gratuit adb de Google |
| iPhone | Guide de contrôle pas à pas (un ordinateur ne peut pas inspecter un iPhone) | Rien |
| Radio et micro-ondes | Émissions jusqu'à 5,3 GHz avec un tinySA Ultra (dont la bande des fours à micro-ondes, 2,45 GHz, avec estimation en V/m et comparaison avec votre propre four), jusqu'à 6 GHz avec un HackRF, ou 24-1 700 MHz avec une clé RTL-SDR | **Optionnel**, voir [MATERIEL.md](MATERIEL.md) |

Les analyses sont conservées : le rapport compare les pièces entre elles et les heures (jour / nuit).

## Ce que le logiciel ne peut pas faire

Il faut le savoir avant d'interpréter les résultats :

- **Un ordinateur ne capte pas « toutes les ondes ».** Sa carte Wi-Fi ne voit que le Wi-Fi, sa puce
  Bluetooth que le Bluetooth. Sans récepteur radio, la bande des micro-ondes en tant que telle, la 4G/5G,
  la TNT et le reste sont invisibles. Même avec un tinySA, rien n'est mesuré au-delà d'environ 5,3 GHz.
- **Les valeurs en V/m sont des ordres de grandeur** (incertitude d'un facteur 3 environ), pas une mesure
  qui fait foi. La mesure officielle et gratuite de l'ANFR est expliquée dans le rapport.
- **Téléphone :** un Android branché en USB est analysé (logiciels espions grand public). Les logiciels
  espions d'État (type Pegasus) ne sont pas détectables ainsi. Un iPhone ne peut pas être inspecté par un
  ordinateur : seulement un guide de contrôle.
- **Caméras :** une caméra qui enregistre sur carte mémoire, en 4G, ou éteinte n'est visible que par une
  inspection physique (guide fourni, détecteur de lentilles conseillé).
- **« Rien d'anormal » ne veut dire que « rien d'anormal dans ce qui a été vérifié ».**

## Interpréter les résultats honnêtement

- Voir des dizaines de réseaux Wi-Fi et d'appareils Bluetooth est **normal**, surtout en immeuble :
  ces signaux traversent les murs et sont émis dans toutes les directions, en permanence.
- Le logiciel n'affiche « Important » ou « À vérifier » que pour des faits concrets et vérifiables :
  Wi-Fi sans mot de passe, réseau qui copie le nom du vôtre, appareil inconnu sur votre box, logiciel
  de prise de contrôle à distance, traceur proche qui revient d'une analyse à l'autre, émission radio
  hors des bandes connues. Il ne fabrique pas d'alertes à partir de choses normales.
- Pour savoir si un signal vient d'un endroit précis, faites une analyse **dans chaque pièce** (champ
  « Lieu ») et regardez le tableau « Comparaison des pièces » du rapport.

## Installation

### Windows

1. Installez Python 3.10 ou plus récent depuis <https://www.python.org/downloads/>.
   **Cochez la case « Add python.exe to PATH »** pendant l'installation.
2. Double-cliquez sur `lancer_windows.bat`. La première fois, il installe ce qu'il faut (une minute).
   Si « Contrôle intelligent des applications » bloque le fichier (fichier venu d'Internet) :
   supprimez le dossier décompressé, faites un clic droit sur le **.zip** > Propriétés > cochez
   **Débloquer** > OK, puis décompressez à nouveau. Ou bien, sans le `.bat` : clic droit dans le dossier >
   « Ouvrir dans le Terminal », puis tapez `py -m venv .venv`,
   `.venv\Scripts\python -m pip install -r requirements.txt` et `.venv\Scripts\python -m veille_ondes`.
   Ne désactivez pas le Contrôle intelligent des applications : on ne peut pas le réactiver sans réinstaller Windows.
3. Windows 11 : pour lister les réseaux Wi-Fi, Windows exige que la localisation soit activée :
   Paramètres > Confidentialité et sécurité > Localisation > activer « Services de localisation » et
   « Autoriser les applications de bureau à accéder à votre position ». Le logiciel vous le signale si besoin.

### macOS

1. Installez Python depuis <https://www.python.org/downloads/> (cette version inclut l'interface graphique).
2. Double-cliquez sur `lancer_mac.command`. La première fois, macOS peut bloquer le fichier :
   clic droit > Ouvrir. S'il ne s'ouvre pas, dans le Terminal : `bash lancer_mac.command`.
3. Autorisez le Terminal à utiliser le Bluetooth et la localisation quand macOS le demande
   (sans la localisation, macOS masque les noms des réseaux Wi-Fi).

### Linux

```bash
sudo apt install python3-venv python3-tk network-manager bluez   # Debian / Ubuntu
./lancer_linux.sh
```

## Utilisation

1. Indiquez le **nom de votre Wi-Fi** (il est sur l'étiquette de votre box) et la **pièce** où vous êtes.
2. Cliquez **« Lancer une analyse »**. Le rapport s'ouvre dans le navigateur (environ 30 secondes).
3. Vérifiez la liste des appareils connectés à votre box. S'ils sont tous à vous, cliquez
   **« Enregistrer mes appareils comme référence »** : les analyses suivantes signaleront tout nouvel appareil.
4. Refaites une analyse dans chaque pièce, puis lancez la **surveillance** pour la nuit
   (par exemple une analyse toutes les 15 minutes pendant 8 heures, ordinateur branché sur secteur).
5. Le rapport (`donnees/rapport.html`) contient l'historique et la comparaison des pièces.
   Les anciens rapports sont dans `donnees/rapports/`.

### En ligne de commande

```bash
python -m veille_ondes analyser --lieu chambre --mon-wifi "Livebox-1234"
python -m veille_ondes surveiller --intervalle 15 --duree 8 --lieu chambre
python -m veille_ondes reference          # mémoriser les appareils actuels de la box
python -m veille_ondes analyser --sdr     # avec un tinySA, un HackRF ou une clé RTL-SDR branché
python -m veille_ondes analyser --sdr --lieu "test micro-ondes"   # référence : votre four en marche, à 1 m
python -m veille_ondes analyser --seulement telephone             # téléphone Android branché en USB
python -m veille_ondes telephone desactiver com.exemple.appli     # aussi : reactiver, desinstaller
python -m veille_ondes analyser --sdr-csv balayage.csv   # analyser un fichier rtl_power / hackrf_sweep
python -m veille_ondes --help
```

## Confidentialité

- Le logiciel ne contacte aucun serveur. Seule exception, uniquement si vous la lancez vous-même :
  `python -m veille_ondes mettre-a-jour-indicateurs` télécharge la dernière liste des logiciels espions connus.
- Vos données ne quittent jamais l'ordinateur. Les seules sondes envoyées vont aux adresses de **votre
  propre réseau local**, pour que les appareils et les caméras connectés à la box se signalent. L'option
  `--sans-balayage` désactive le balayage des adresses, et `--sans-cameras` la recherche de caméras.
- Il ne modifie rien sur l'ordinateur : il lit des informations, il ne supprime et ne bloque rien. Sur le
  téléphone, il ne désactive ou ne désinstalle une application que si vous le demandez, application par
  application, et jamais une application du système.
- Le dossier `donnees/` contient vos analyses. Vous pouvez le supprimer à tout moment.

## Tests

```bash
pip install pytest
python -m pytest
```

## Crédits

Liste des logiciels espions connus : [Echap, stalkerware-indicators](https://github.com/AssoEchap/stalkerware-indicators),
licence CC BY 4.0 (extraite le 25/10/2026, fichier `veille_ondes/indicateurs/logiciels_espions.json`).

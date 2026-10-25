# Matériel à acheter (ou pas)

Résumé : **pour commencer, rien.** Le Wi-Fi, le Bluetooth, les caméras sur votre réseau, l'ordinateur et un
téléphone Android se vérifient avec ce que vous avez déjà. Si vous n'achetez qu'une chose, prenez un
**tinySA Ultra** (ondes jusqu'à environ 5 GHz, dont celles des micro-ondes) et un **détecteur de lentilles**
(caméras cachées) : environ 150 à 220 € en tout.

## 1. Gratuit : ce qui marche déjà

| Besoin | Solution | Prix |
|---|---|---|
| Wi-Fi, Bluetooth, réseau local, caméras sur votre réseau, ordinateur | Le logiciel + un ordinateur portable | 0 € |
| Analyser un téléphone **Android** | Le câble USB du téléphone + l'outil adb de Google (voir plus bas) | 0 € |
| Contrôler un **iPhone** | Guide pas à pas du logiciel (bouton « Guides ») | 0 € |
| Mesure d'exposition qui fait foi, toutes fréquences | Mesure ANFR : formulaire Cerfa n° 15003 (service-public.fr), signé par la mairie qui le transmet à l'ANFR ; un laboratoire accrédité vient chez vous | 0 € |
| Chercher un traceur (AirTag…) sur vous | iPhone : alerte automatique ; Android : Paramètres > Sécurité > Alertes de traceurs inconnus, ou l'application AirGuard | 0 € |
| Repérer une caméra à l'œil | Lampe du téléphone + caméra avant du téléphone (guide du logiciel) | 0 € |

## 2. Ondes comme celles d'un four à micro-ondes (2,45 GHz) et au-delà

Un four à micro-ondes émet à 2 450 MHz, dans la même bande que le Wi-Fi et le Bluetooth. Une carte Wi-Fi ne
« voit » que des réseaux Wi-Fi : pour voir **toute** l'énergie présente dans cette bande, il faut un analyseur de
spectre.

| Pièce | Ce qu'elle apporte | Prix indicatif |
|---|---|---|
| **tinySA Ultra / Ultra+ (ZS-405 ou ZS-406)** — recommandé | Analyseur de spectre de poche avec écran, jusqu'à environ 5,3 GHz en mode « Ultra » ; niveaux en dBm étalonnés, donc estimation du champ en V/m ; s'utilise seul en se déplaçant dans la maison (le signal augmente près de la source) ou branché au logiciel | environ 130 à 180 € |
| HackRF One — pour utilisateur averti | Récepteur radio de 1 MHz à 6 GHz, balayage rapide, mais niveaux non étalonnés (comparaisons seulement) | 300 € et plus |
| Clé RTL-SDR Blog V4 | 24 à 1 766 MHz seulement : **ne voit pas les micro-ondes** ni le Wi-Fi | 40 à 90 € |

À savoir :

- Achetez le tinySA chez un distributeur officiel (liste sur tinysa.org) : les copies sont nombreuses et souvent
  défectueuses.
- Branchement : câble USB-C ; Windows le reconnaît tout seul comme port série et le logiciel le détecte.
  Activez le mode « Ultra » dans le menu CONFIG (voir la notice ou le wiki tinysa.org) pour dépasser 800 MHz.
- **Faites la mesure de référence** : votre propre four en marche (tasse d'eau dedans), récepteur à 1 m, lieu
  « test micro-ondes ». Toutes les mesures suivantes y seront comparées.
- HackRF : installez les outils « hackrf » (programme `hackrf_sweep`) et placez-les dans le dossier `outils`.

## 3. Téléphone

| Pièce | Pourquoi | Prix |
|---|---|---|
| Câble USB **de données** adapté au téléphone | Certains câbles ne servent qu'à charger : si le téléphone n'est pas détecté, essayez un autre câble | 0 à 10 € |
| Outil « SDK Platform-Tools » de Google | Permet au logiciel de lire la liste des applications et leurs droits | gratuit |

Préparation d'un téléphone Android (une seule fois) :

1. Téléchargez « SDK Platform-Tools pour Windows » sur developer.android.com (page *platform-tools*),
   décompressez-le dans un dossier `outils` à créer à côté de `lancer_windows.bat` (le logiciel trouve
   `adb.exe` même s'il est dans un sous-dossier).
2. Sur le téléphone : Paramètres > À propos du téléphone > (Informations sur le logiciel) > touchez **7 fois**
   « Numéro de version ». Les « Options pour les développeurs » apparaissent.
3. Paramètres > Options pour les développeurs > activez **Débogage USB**.
4. Branchez le téléphone, déverrouillez-le, acceptez « Autoriser le débogage USB ». Dans Veille Ondes :
   « Analyser le téléphone ».
5. À la fin, désactivez le Débogage USB.

Si Windows ne voit pas le téléphone, installez le pilote USB du fabricant (Samsung : « Samsung Android USB
Driver »).

Un **iPhone** ne peut pas être inspecté de cette façon par un ordinateur : suivez le guide du logiciel.

## 4. Caméras cachées

| Pièce | Pourquoi | Prix indicatif |
|---|---|---|
| **Détecteur de lentilles** (viseur + LED rouges clignotantes) — recommandé | Fait briller l'objectif de n'importe quelle caméra, même éteinte, sans réseau ou sur carte mémoire : c'est la méthode la plus fiable | 15 à 40 € |
| tinySA (voir plus haut) | Repère une caméra **qui émet** (Wi-Fi 2,4 / 5,8 GHz) : le signal augmente quand on s'en approche | — |

Le logiciel trouve de son côté les caméras branchées sur votre box et les mini-caméras Wi-Fi qui créent leur
propre réseau.

## 5. Seulement si votre ordinateur n'a pas de Wi-Fi ou de Bluetooth (PC de bureau)

| Pièce | Prix indicatif |
|---|---|
| Adaptateur Wi-Fi USB compatible avec votre système | 10 à 25 € |
| Clé Bluetooth USB 5.0 | 10 à 15 € |

## 6. Déconseillé

Je vous les déconseille franchement, parce qu'ils coûtent cher sans vous apprendre quelque chose de fiable :

- **Détecteurs d'ondes « EMF meter » à 20-150 €** et **détecteurs « anti-espion » de radiofréquences** : non
  calibrés, ils sonnent pour votre propre box et votre propre téléphone. Ils produisent de l'inquiétude, pas de
  l'information. Le tinySA montre la fréquence et le niveau ; la mesure ANFR est gratuite et fait foi.
- **Appareils « biologie de l'habitat »** dont les seuils d'alerte sont des milliers de fois sous les limites
  réglementaires : même problème.
- **Applications « anti-espion » payantes pour téléphone** : la vérification faite par ce logiciel (liste publique
  Echap + droits des applications) et les contrôles intégrés au téléphone couvrent les logiciels espions grand
  public.
- **Peintures, rideaux, tissus, baldaquins « anti-ondes »** : chers, et aux niveaux mesurés dans un logement il n'y
  a rien de significatif à bloquer. Ils dégradent aussi la réception de votre téléphone, qui émet alors plus fort.
- **Brouilleurs** : interdits (article L33-3-1 du code des postes et des communications électroniques), et ils
  couperaient aussi votre téléphone, votre Wi-Fi et les appels d'urgence.

# Matériel à acheter (ou pas)

Résumé : **pour commencer, rien.** Un ordinateur portable a déjà le Wi-Fi et le Bluetooth, et la
mesure officielle des ondes chez vous est gratuite. N'achetez du matériel qu'après avoir lu vos
premiers rapports.

## 1. Rien à acheter : ce qui marche déjà

| Besoin | Solution | Prix |
|---|---|---|
| Wi-Fi, Bluetooth, réseau local, contrôle de l'ordinateur | Le logiciel + votre ordinateur portable | 0 € |
| Mesure d'exposition qui fait foi, toutes fréquences | Mesure ANFR : formulaire Cerfa n° 15003 (service-public.fr), signé par la mairie qui le transmet à l'ANFR ; un laboratoire accrédité vient chez vous | 0 € |
| Chercher un traceur (AirTag…) sur vous | iPhone : alerte automatique ; Android : Paramètres > Sécurité > Alertes de traceurs inconnus, ou l'application AirGuard | 0 € |

## 2. Seulement si votre ordinateur n'a pas de Wi-Fi ou de Bluetooth (PC de bureau)

| Pièce | Pourquoi | Prix indicatif |
|---|---|---|
| Adaptateur Wi-Fi USB compatible avec votre système | Lister les réseaux Wi-Fi | 10 à 25 € |
| Clé Bluetooth USB 5.0 | Lister les appareils Bluetooth | 10 à 15 € |

## 3. Optionnel : voir les ondes autres que Wi-Fi et Bluetooth

| Pièce | Pourquoi | Prix indicatif |
|---|---|---|
| Clé **RTL-SDR Blog V4** avec kit d'antennes dipôles | Balayage de 24 à 1 700 MHz : radio, TNT, antennes 4G, télécommandes 433 MHz, alarmes 868 MHz, compteurs 169 MHz | environ 40 à 90 € selon le revendeur |
| Rallonge USB de 1 à 2 m | Éloigner la clé de l'ordinateur, qui crée des parasites | 5 € |

À savoir avant d'acheter :

- La clé RTL-SDR **ne couvre pas** le Wi-Fi, le Bluetooth, ni la 5G à 3,5 GHz.
- Ses niveaux ne sont **pas calibrés** : elle sert à repérer et comparer des émissions (d'une pièce à
  l'autre, de jour et de nuit), pas à mesurer une exposition en V/m.
- Achetez la marque « RTL-SDR Blog » chez un revendeur sérieux : les copies bon marché sont nombreuses.

Installation de la clé :

- **Windows** : téléchargez les outils « rtl-sdr-blog » pour Windows (page GitHub `rtlsdrblog/rtl-sdr-blog`,
  rubrique Releases), installez le pilote WinUSB avec le programme **Zadig** (choisir « Bulk-In, Interface 0 »),
  puis copiez `rtl_power.exe` et ses fichiers `.dll` dans un dossier `outils` à côté de `lancer_windows.bat`.
- **macOS / Linux** : installez les pilotes « rtl-sdr-blog » (indispensables pour la V4) pour avoir la
  commande `rtl_power`.
- Cochez ensuite « Radio large bande » dans la fenêtre du logiciel.

## 4. Déconseillé

Je vous les déconseille franchement, parce qu'ils coûtent cher sans vous apprendre quelque chose de fiable :

- **Détecteurs d'ondes « EMF meter » à 20-150 €** : non calibrés, ils mélangent toutes les fréquences et
  affichent des alarmes rouges pour des niveaux parfaitement normaux (votre propre box, votre téléphone).
  Ils produisent de l'inquiétude, pas de l'information. La mesure ANFR est gratuite et fait foi.
- **Appareils « biologie de l'habitat »** dont les seuils d'alerte sont des milliers de fois sous les
  limites réglementaires : même problème.
- **HackRF One et autres SDR haut de gamme (300 € et plus)** : outils d'expert qui n'apportent rien ici de
  plus que la clé RTL-SDR et la mesure ANFR.
- **Peintures, rideaux, tissus, baldaquins « anti-ondes »** : chers, et aux niveaux mesurés dans un logement
  il n'y a rien de significatif à bloquer. Ils dégradent aussi la réception de votre téléphone, qui émet
  alors plus fort pour compenser.
- **Brouilleurs** : interdits (article L33-3-1 du code des postes et des communications électroniques),
  et ils couperaient aussi votre téléphone, votre Wi-Fi et les appels d'urgence.

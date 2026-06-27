# Wasp-TX (Wireless Altitude & Status Positioning)

Wasp-TX est un projet de tracker GPS et télémétrie LoRa conçu pour s'intégrer avec l'écosystème **NectarMC**. Il tourne principalement sur les cartes **LILYGO TTGO T-Beam** (V1.1 et V1.2).

## Fonctionnalités Principales
- Acquisition GPS (Latitude, Longitude, Altitude, Vitesse, Cap, Satellites).
- Télémétrie de la puce (Température, Tension Batterie).
- Transmission radio via module LoRa intégré (SX1262 ou SX1276).
- Format de trame binaire natif compatible NectarMC (Protocole propriétaire robuste).
- Configuration dynamique persistante via Commandes AT par le port Série.
- Tableau de bord en ligne ultra complet avec Outil de Flash ESP, Console Série, Télémétrie Live et Carte interactive GPS.

## Web Control Center
Un tableau de bord complet et statique (HTML/CSS/JS) est disponible et hébergé directement via GitHub Pages pour permettre une configuration et un suivi simplifiés :
👉 **[Accéder au Web Control Center Wasp-TX](https://axpaul.github.io/Wasp-TxTracker-TTGO/docs/)**

Ce tableau de bord permet de :
- **Flasher le firmware** directement depuis Chrome/Edge (via ESP Web Tools).
- **Configurer le tracker** en temps réel via une console et des raccourcis de commandes AT.
- **Suivre la télémétrie en direct** sur une carte et un tableau de données, grâce à l'API Web Serial.

## Format de Trame Binaire (32 Octets)

Pour garantir une efficacité spectrale maximale et une longue portée (Low Power Wide Area Network), Wasp-TX génère une payload LoRa ultra-compressée de **32 octets** (`wasp_payload_t`), qui est transmise sur les ondes et par liaison Série USB/Bluetooth.

### Structure `wasp_payload_t`

La payload LoRa brute (sans les headers Nectar additionnels ajoutés côté USB) est packée à l'octet près (`#pragma pack(1)`) :

| Offset | Taille (octets) | Type       | Nom        | Description |
|--------|-----------------|------------|------------|-------------|
| 0      | 1               | `uint8_t`  | `id`       | Numéro de l'ID du Tracker (SSID Num) |
| 1      | 1               | `uint8_t`  | `apid`     | Application Process Identifier |
| 2      | 1               | `uint8_t`  | `type`     | Type de Tracker (SSID Type) |
| 3      | 4               | `uint32_t` | `utc`      | Horodatage Unix Epoch (Timestamp GPS) |
| 7      | 4               | `float`    | `lat`      | Latitude (encodage binaire IEEE 754) |
| 11     | 4               | `float`    | `lon`      | Longitude (encodage binaire IEEE 754) |
| 15     | 4               | `float`    | `alt`      | Altitude en mètres |
| 19     | 4               | `float`    | `spd`      | Vitesse en km/h |
| 23     | 4               | `float`    | `cog`      | Cap (Course Over Ground) en degrés |
| 27     | 2               | `uint16_t` | `vbat`     | Tension de la batterie en millivolts (mV) |
| 29     | 2               | `int16_t`  | `temp`     | Température interne (en 1/100 °C) |
| 31     | 1               | `uint8_t`  | `status`   | Bitmask d'états (ex: Bit 0 = Fix GPS Valide) |
| 32     | 1               | `uint8_t`  | `sats`     | Nombre de satellites GPS accrochés |
| **TOTAL**| **33 octets**   |            |            | *(Note: La structure a été mise à jour à 33 octets avec les ajouts de champs au fil du développement)* |

*(Correction de la taille : La structure actuelle fait exactement 33 octets d'après le code C++)*

### Encapsulation NectarMC (Liaison Série / USB)
Lors de l'envoi de la télémétrie par le port USB vers le Web Control Center (ou vers NectarMC), la payload de 33 octets ci-dessus est encapsulée dans le protocole de transport NectarMC. La trame finale transmise (plus de 40 octets) inclut :
1. **Magic Word** (1 octet)
2. **ID Mission** (2 octets)
3. **Longueur de la payload** (1 octet)
4. **La Payload Wasp (`wasp_payload_t`)** (33 octets)
5. **Métriques Radio locales** (RSSI, SNR) (2 octets)
6. **Horodatage Local Epoch** (4 octets)
7. **CRC16-CCITT** (2 octets)
8. **Saut de Ligne `\n`** (1 octet)

C'est cette trame binaire complète que le script JavaScript `serial.js` ou l'interface NectarMC parse pour afficher la télémétrie fluide en temps réel.

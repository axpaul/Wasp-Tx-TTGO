#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
@file test_tracker.py
@brief Script de validation matérielle et de test des commandes AT pour Wasp-TX.
@author Paul Miailhe
@date 27/06/2026
"""

import time
import sys
import argparse

try:
    import serial
except ImportError:
    print("Erreur : La bibliothèque 'pyserial' est requise.")
    print("Veuillez l'installer avec la commande : pip install pyserial")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Script de test automatisé des commandes AT de Wasp-TX")
    parser.add_argument("port", help="Port série de la carte (ex: COM3 ou /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Vitesse en bauds (défaut: 115200)")
    args = parser.parse_args()

    print("==================================================")
    print("   WASP-TX - SUITE DE TEST DES COMMANDES AT       ")
    print("==================================================")
    print(f"Connexion au port {args.port} à {args.baud} bauds...")
    
    try:
        ser = serial.Serial(args.port, args.baud, timeout=1.5)
    except Exception as e:
        print(f"ERREUR : Impossible d'ouvrir le port série : {e}")
        sys.exit(1)

    # Vider le buffer d'entrée
    ser.reset_input_buffer()
    time.sleep(0.5)

    def exec_cmd(cmd, expected_ok=True, timeout=2.0):
        print(f"Envoi : {cmd:<18}", end="", flush=True)
        ser.write((cmd + "\r\n").encode("utf-8"))
        
        lines = []
        start_time = time.time()
        while time.time() - start_time < timeout:
            if ser.in_waiting > 0:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if line:
                    lines.append(line)
                    if line == "OK" or "ERROR" in line:
                        break
            time.sleep(0.02)
        
        # Vérification du résultat
        has_ok = any(l == "OK" for l in lines)
        has_error = any("ERROR" in l for l in lines)
        
        if expected_ok:
            success = has_ok and not has_error
        else:
            success = has_error
            
        if success:
            print(" -> [PASS]")
            # Affichage des réponses intermédiaires s'il y en a
            for l in lines:
                if l not in ["OK", "ERROR"]:
                    print(f"    └─ {l}")
            return True
        else:
            print(" -> [FAIL]")
            print("    Détail de la réponse :")
            for l in lines:
                print(f"    ├─ {l}")
            return False

    # Suite de tests séquentiels
    tests = [
        ("Test de liaison de base (AT)", "AT", True),
        ("Récupération version firmware", "AT+VER", True),
        ("Lecture de l'intervalle TX", "AT+INTERVAL?", True),
        ("Modification de l'intervalle à 2s", "AT+INTERVAL=2", True),
        ("Vérification intervalle à 2s", "AT+INTERVAL?", True),
        ("Restauration intervalle à 1s", "AT+INTERVAL=1", True),
        ("Lecture de la fréquence active", "AT+FREQ?", True),
        ("Lecture du Spreading Factor", "AT+SF?", True),
        ("Lecture de la bande passante", "AT+BW?", True),
        ("Lecture de la puissance d'émission", "AT+POWER?", True),
        ("Lecture du statut CRC matériel", "AT+CRC?", True),
        ("Lecture du statut de log debug", "AT+DEBUG?", True),
        ("Lecture du statut de sortie binaire", "AT+BINUSB?", True),
        ("Test d'une commande invalide", "AT+INVALID_CMD", False),
        ("Affichage de la configuration", "AT+CFG", True),
    ]

    failed = 0
    print("\nLancement de la suite de test...")
    print("-" * 50)
    
    for desc, cmd, expected in tests:
        print(f"[*] {desc}")
        success = exec_cmd(cmd, expected)
        if not success:
            failed += 1
        print("-" * 50)
        time.sleep(0.1)

    ser.close()
    
    print("\n================ RÉSULTATS ================")
    total = len(tests)
    passed = total - failed
    print(f"Total tests lancés : {total}")
    print(f"Réussis            : {passed} / {total}")
    print(f"Échecs             : {failed} / {total}")
    print("===========================================")
    
    if failed == 0:
        print("\nFélicitations ! Toutes les fonctions AT répondent correctement.")
        sys.exit(0)
    else:
        print("\nAttention : Certains tests ont échoué. Vérifiez vos connexions ou le firmware.")
        sys.exit(1)

if __name__ == "__main__":
    main()

"""Fenêtre simple (Tkinter, inclus avec Python) pour lancer les analyses sans ligne de commande.

Chaque analyse tourne dans un processus séparé : la fenêtre reste réactive et
une mesure qui se bloque (pilote Bluetooth…) peut être arrêtée avec le bouton.
"""

from __future__ import annotations

import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
import webbrowser
from tkinter import messagebox, ttk

from .historique import Historique
from .sdr import trouver_rtl_power

DOSSIER_PROJET = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Fenetre:
    def __init__(self, racine: tk.Tk):
        self.racine = racine
        self.historique = Historique()
        self.processus: subprocess.Popen | None = None
        self.file: queue.Queue[str | None] = queue.Queue()

        racine.title("Veille Ondes")
        racine.minsize(720, 560)
        cadre = ttk.Frame(racine, padding=14)
        cadre.pack(fill="both", expand=True)

        ttk.Label(cadre, text="Veille Ondes", font=("TkDefaultFont", 16, "bold")).pack(anchor="w")
        ttk.Label(cadre, text="Tout reste sur cet ordinateur : rien n'est envoyé sur Internet.",
                  foreground="#555").pack(anchor="w", pady=(0, 10))

        champs = ttk.Frame(cadre)
        champs.pack(fill="x")
        ttk.Label(champs, text="Nom de votre Wi-Fi :").grid(row=0, column=0, sticky="w", pady=3)
        self.mon_wifi = tk.StringVar(value=", ".join(self.historique.config().get("mes_wifi", [])))
        ttk.Entry(champs, textvariable=self.mon_wifi, width=40).grid(row=0, column=1, sticky="we", padx=8)
        ttk.Label(champs, text="(plusieurs noms : séparez par des virgules)", foreground="#666").grid(
            row=0, column=2, sticky="w")
        ttk.Label(champs, text="Pièce / lieu de la mesure :").grid(row=1, column=0, sticky="w", pady=3)
        self.lieu = tk.StringVar()
        ttk.Combobox(champs, textvariable=self.lieu, width=38,
                     values=["salon", "chambre", "cuisine", "bureau", "salle de bain", "entrée",
                             "côté voisin", "extérieur", "ailleurs (autre logement)"]).grid(
            row=1, column=1, sticky="we", padx=8)
        champs.columnconfigure(1, weight=1)

        options = ttk.LabelFrame(cadre, text="Mesures", padding=8)
        options.pack(fill="x", pady=10)
        self.choix = {}
        for i, (cle, texte) in enumerate([("wifi", "Wi-Fi"), ("bluetooth", "Bluetooth"),
                                          ("reseau_local", "Appareils sur ma box"),
                                          ("ordinateur", "Contrôle de l'ordinateur")]):
            v = tk.BooleanVar(value=True)
            ttk.Checkbutton(options, text=texte, variable=v).grid(row=0, column=i, sticky="w", padx=6)
            self.choix[cle] = v
        self.sdr = tk.BooleanVar(value=False)
        sdr_ok = trouver_rtl_power() is not None
        ttk.Checkbutton(options, text="Radio large bande (clé SDR)" if sdr_ok else
                        "Radio large bande (clé SDR non détectée)", variable=self.sdr,
                        state="normal" if sdr_ok else "disabled").grid(row=1, column=0, columnspan=2,
                                                                       sticky="w", padx=6, pady=(6, 0))

        boutons = ttk.Frame(cadre)
        boutons.pack(fill="x")
        self.bouton_analyse = ttk.Button(boutons, text="Lancer une analyse", command=self.analyser)
        self.bouton_analyse.pack(side="left")
        ttk.Label(boutons, text="  Surveillance : toutes les").pack(side="left")
        self.intervalle = tk.StringVar(value="15")
        ttk.Spinbox(boutons, from_=5, to=120, increment=5, width=4, textvariable=self.intervalle).pack(side="left")
        ttk.Label(boutons, text="min pendant").pack(side="left")
        self.duree = tk.StringVar(value="8")
        ttk.Spinbox(boutons, from_=1, to=48, width=4, textvariable=self.duree).pack(side="left")
        ttk.Label(boutons, text="h").pack(side="left")
        self.bouton_surveiller = ttk.Button(boutons, text="Démarrer", command=self.surveiller)
        self.bouton_surveiller.pack(side="left", padx=6)
        self.bouton_arreter = ttk.Button(boutons, text="Arrêter", command=self.arreter, state="disabled")
        self.bouton_arreter.pack(side="left")

        boutons2 = ttk.Frame(cadre)
        boutons2.pack(fill="x", pady=(8, 0))
        ttk.Button(boutons2, text="Ouvrir le dernier rapport", command=self.ouvrir_rapport).pack(side="left")
        ttk.Button(boutons2, text="Enregistrer mes appareils comme référence",
                   command=self.reference).pack(side="left", padx=6)

        self.texte = tk.Text(cadre, height=16, wrap="word", state="disabled", font=("TkFixedFont", 10))
        self.texte.pack(fill="both", expand=True, pady=(10, 0))
        self.ecrire("Prêt. Conseil : faites une première analyse, puis une dans chaque pièce, et une la nuit "
                    "avec la surveillance. Le rapport compare tout.\n")
        self.racine.after(150, self.lire_file)
        self.racine.protocol("WM_DELETE_WINDOW", self.fermer)

    # --- affichage ----------------------------------------------------------------

    def ecrire(self, ligne: str) -> None:
        self.texte.configure(state="normal")
        self.texte.insert("end", ligne)
        self.texte.see("end")
        self.texte.configure(state="disabled")

    def lire_file(self) -> None:
        try:
            while True:
                ligne = self.file.get_nowait()
                if ligne is None:
                    self.termine()
                else:
                    self.ecrire(ligne)
        except queue.Empty:
            pass
        self.racine.after(150, self.lire_file)

    # --- lancement des analyses ------------------------------------------------------

    def _arguments_mesure(self) -> list[str]:
        args = []
        noms = [n.strip() for n in self.mon_wifi.get().split(",") if n.strip()]
        for nom in noms or [""]:  # un champ vidé efface aussi la liste enregistrée
            args += ["--mon-wifi", nom]
        if self.lieu.get().strip():
            args += ["--lieu", self.lieu.get().strip()]
        for cle, v in self.choix.items():
            if not v.get():
                args.append(f"--sans-{cle.replace('_', '-')}")
        if self.sdr.get():
            args.append("--sdr")
        return args

    def _lancer(self, args: list[str]) -> None:
        if self.processus:
            return
        env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUNBUFFERED="1")
        options = {"creationflags": 0x08000000} if os.name == "nt" else {}
        try:
            self.processus = subprocess.Popen([sys.executable, "-m", "veille_ondes", *args], cwd=DOSSIER_PROJET,
                                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, **options)
        except OSError as e:
            messagebox.showerror("Veille Ondes", f"Impossible de lancer l'analyse : {e}")
            return
        for b in (self.bouton_analyse, self.bouton_surveiller):
            b.configure(state="disabled")
        self.bouton_arreter.configure(state="normal")
        threading.Thread(target=self._relayer, args=(self.processus,), daemon=True).start()

    def _relayer(self, processus: subprocess.Popen) -> None:
        for octets in processus.stdout:
            self.file.put(octets.decode("utf-8", errors="replace"))
        processus.wait()
        self.file.put(None)

    def termine(self) -> None:
        self.processus = None
        for b in (self.bouton_analyse, self.bouton_surveiller):
            b.configure(state="normal")
        self.bouton_arreter.configure(state="disabled")
        self.ecrire("\n")

    def analyser(self) -> None:
        self.ecrire("\n")
        self._lancer(["analyser", *self._arguments_mesure()])

    def surveiller(self) -> None:
        try:
            intervalle, duree = float(self.intervalle.get()), float(self.duree.get())
        except ValueError:
            messagebox.showerror("Veille Ondes", "Intervalle et durée doivent être des nombres.")
            return
        self.ecrire("\n")
        self._lancer(["surveiller", "--intervalle", str(intervalle), "--duree", str(duree),
                      *self._arguments_mesure()])

    def reference(self) -> None:
        if not messagebox.askyesno(
                "Veille Ondes",
                "Les appareils actuellement connectés à votre box vont être enregistrés comme « connus ».\n\n"
                "Faites-le seulement après avoir vérifié dans le rapport (ou dans votre box) que tous ces "
                "appareils sont bien à vous. Continuer ?"):
            return
        self.ecrire("\n")
        self._lancer(["reference"])

    def arreter(self) -> None:
        if self.processus:
            self.processus.terminate()
            self.ecrire("\nArrêt demandé.\n")

    def ouvrir_rapport(self) -> None:
        fichier = self.historique.dossier / "rapport.html"
        if fichier.exists():
            webbrowser.open(fichier.resolve().as_uri())
        else:
            messagebox.showinfo("Veille Ondes", "Aucun rapport pour l'instant : lancez d'abord une analyse.")

    def fermer(self) -> None:
        if self.processus and not messagebox.askyesno("Veille Ondes", "Une analyse est en cours. Quitter quand même ?"):
            return
        self.arreter()
        self.racine.destroy()


def lancer() -> int:
    racine = tk.Tk()
    try:
        ttk.Style().theme_use("vista" if os.name == "nt" else "clam")
    except tk.TclError:
        pass
    Fenetre(racine)
    racine.mainloop()
    return 0

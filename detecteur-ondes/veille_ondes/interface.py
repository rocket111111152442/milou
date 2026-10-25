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
from tkinter import filedialog, messagebox, ttk

from .analyse import LIBELLES_NIVEAUX
from .historique import Historique
from .rapport import page_guides
from .sdr import NOMS_MATERIELS, materiels_disponibles

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
                                          ("cameras", "Caméras cachées"),
                                          ("ordinateur", "Contrôle de l'ordinateur")]):
            v = tk.BooleanVar(value=True)
            ttk.Checkbutton(options, text=texte, variable=v).grid(row=i // 3, column=i % 3, sticky="w", padx=6)
            self.choix[cle] = v
        self.telephone = tk.BooleanVar(value=False)
        ttk.Checkbutton(options, text="Téléphone Android (câble USB)", variable=self.telephone).grid(
            row=1, column=2, sticky="w", padx=6)
        self.sdr = tk.BooleanVar(value=False)
        materiels = materiels_disponibles()
        texte_radio = ("Radio / micro-ondes : " + ", ".join(NOMS_MATERIELS[m] for m in materiels) if materiels
                       else "Radio / micro-ondes (aucun récepteur branché)")
        ttk.Checkbutton(options, text=texte_radio, variable=self.sdr,
                        state="normal" if materiels else "disabled").grid(row=2, column=0, columnspan=3,
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
        ttk.Button(boutons2, text="Guides (iPhone, caméras, micro-ondes)", command=self.ouvrir_guides).pack(side="left")

        boutons3 = ttk.Frame(cadre)
        boutons3.pack(fill="x", pady=(8, 0))
        ttk.Label(boutons3, text="Téléphone Android :").pack(side="left")
        self.bouton_telephone = ttk.Button(boutons3, text="Analyser le téléphone", command=self.analyser_telephone)
        self.bouton_telephone.pack(side="left", padx=6)
        ttk.Button(boutons3, text="Applis du téléphone…", command=self.gerer_telephone).pack(side="left")
        ttk.Button(boutons3, text="Choisir adb.exe…", command=self.choisir_adb).pack(side="left", padx=6)

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
        if self.telephone.get():
            args.append("--telephone")
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
        for b in (self.bouton_analyse, self.bouton_surveiller, self.bouton_telephone):
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
        for b in (self.bouton_analyse, self.bouton_surveiller, self.bouton_telephone):
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

    def analyser_telephone(self) -> None:
        self.ecrire("\nBranchez le téléphone Android avec un câble de données, activez le « Débogage USB » "
                    "(guide dans MATERIEL.md) et acceptez la demande qui s'affiche sur le téléphone.\n")
        self._lancer(["analyser", "--seulement", "telephone", "--lieu", self.lieu.get().strip() or "téléphone"])

    def gerer_telephone(self) -> None:
        tel = next((a["telephone"] for a in reversed(self.historique.charger(limite=100))
                    if (a.get("telephone") or {}).get("ok")), None)
        if not tel:
            messagebox.showinfo("Veille Ondes", "Analysez d'abord le téléphone (bouton « Analyser le téléphone »).")
            return
        fenetre = tk.Toplevel(self.racine)
        fenetre.title(f"Applications du téléphone — {tel['appareil'].get('modele', '')}")
        fenetre.minsize(760, 420)
        ttk.Label(fenetre, padding=8, wraplength=740, text=(
            "Seules les applications installées par l'utilisateur sont listées. « Désactiver » est réversible ; "
            "« Désinstaller » ne l'est pas. Si vous comptez porter plainte, faites d'abord constater le téléphone "
            "(le rapport est conservé).")).pack(fill="x")
        arbre = ttk.Treeview(fenetre, columns=("niveau", "origine", "raisons"), show="tree headings", height=14)
        for colonne, titre, largeur in (("#0", "Application", 240), ("niveau", "Niveau", 90),
                                        ("origine", "Origine", 110), ("raisons", "Raisons", 420)):
            arbre.heading(colonne, text=titre)
            arbre.column(colonne, width=largeur, stretch=colonne == "raisons")
        for app in tel["applications"]:
            arbre.insert("", "end", iid=app["paquet"], text=app["paquet"] + (" (désactivée)" if app.get("desactive") else ""),
                         values=(LIBELLES_NIVEAUX[app["niveau"]], app["magasin"] or "hors magasin",
                                 " ; ".join(app["raisons"])))
        arbre.pack(fill="both", expand=True, padx=8)
        detail = ttk.Label(fenetre, padding=8, wraplength=740, justify="left",
                           text="Sélectionnez une application pour voir le détail.")
        detail.pack(fill="x")
        par_paquet = {app["paquet"]: app for app in tel["applications"]}

        def afficher_detail(_evenement=None):
            if arbre.selection():
                app = par_paquet[arbre.selection()[0]]
                detail.configure(text=f"{app['paquet']} — {LIBELLES_NIVEAUX[app['niveau']]} — "
                                      + (" ; ".join(app["raisons"]) or "rien de particulier")
                                      + (f" — installée le {app['installe_le']}" if app.get("installe_le") else ""))
        arbre.bind("<<TreeviewSelect>>", afficher_detail)
        boutons = ttk.Frame(fenetre, padding=8)
        boutons.pack(fill="x")
        for action, texte in (("desactiver", "Désactiver"), ("reactiver", "Réactiver"),
                              ("desinstaller", "Désinstaller")):
            ttk.Button(boutons, text=texte, command=lambda a=action: self._agir_telephone(
                a, arbre.selection(), tel["appareil"]["serie"], fenetre)).pack(side="left", padx=(0, 6))

    def _agir_telephone(self, action: str, selection: tuple, serie: str, parent: tk.Toplevel) -> None:
        if not selection:
            messagebox.showinfo("Veille Ondes", "Sélectionnez d'abord une application.", parent=parent)
            return
        paquet = selection[0]
        verbes = {"desactiver": "désactiver", "reactiver": "réactiver", "desinstaller": "DÉSINSTALLER (définitif)"}
        if not messagebox.askyesno("Veille Ondes", f"Voulez-vous {verbes[action]} l'application\n{paquet} ?\n\n"
                                   "Le téléphone doit être branché et déverrouillé.", parent=parent):
            return
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        options = {"creationflags": 0x08000000} if os.name == "nt" else {}
        try:
            r = subprocess.run([sys.executable, "-m", "veille_ondes", "telephone", action, paquet, "--serie", serie],
                               cwd=DOSSIER_PROJET, capture_output=True, timeout=120, env=env, **options)
            message = r.stdout.decode("utf-8", errors="replace").strip() or r.stderr.decode("utf-8", "replace")
        except (OSError, subprocess.TimeoutExpired) as e:
            message = f"ÉCHEC : {e}"
        self.ecrire(f"\n{paquet} : {message}\n")
        messagebox.showinfo("Veille Ondes", message, parent=parent)

    def choisir_adb(self) -> None:
        chemin = filedialog.askopenfilename(
            title="Où se trouve adb.exe ? (dossier platform-tools)",
            filetypes=[("adb", "adb.exe adb"), ("Tous les fichiers", "*.*")])
        if not chemin:
            return
        if os.path.basename(chemin).lower() not in ("adb.exe", "adb"):
            messagebox.showerror("Veille Ondes", "Ce n'est pas le fichier adb.exe.")
            return
        config = self.historique.config()
        config["chemin_adb"] = chemin
        self.historique.enregistrer_config(config)
        self.ecrire(f"\nOutil adb enregistré : {chemin}\n")

    def ouvrir_guides(self) -> None:
        self.historique.dossier.mkdir(parents=True, exist_ok=True)
        fichier = self.historique.dossier / "guides.html"
        fichier.write_text(page_guides(), encoding="utf-8")
        webbrowser.open(fichier.resolve().as_uri())

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

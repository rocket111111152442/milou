"use client";
import { Bell, History, LayoutDashboard, ListPlus, Settings, ScanSearch } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  Field,
  Input,
  LineChart,
  SectionHeading,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@waverti/ui";
import { NotificationList, OverviewView, ResultTimeline, MonitorStatusBadge } from "@waverti/ui/app";
import { DEMO_NOW, demoMonitors, demoNotifications, demoOverview, demoResults } from "@/lib/demo-data";
import { BrowserFrame } from "./browser-frame";

const priceHistory = [
  { t: "J-6", v: 899 },
  { t: "J-5", v: 899 },
  { t: "J-4", v: 899 },
  { t: "J-3", v: 879 },
  { t: "J-2", v: 879 },
  { t: "J-1", v: 849 },
  { t: "J", v: 789 },
];

/**
 * Section 8 — écrans construits avec les VRAIS composants du tableau de bord
 * (OverviewView, NotificationList, ResultTimeline…) alimentés par des données fictives.
 */
export function AppShowcase() {
  return (
    <section aria-labelledby="showcase-title" className="py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="showcase-title"
          eyebrow="L'application"
          title="Simple à utiliser, même quand c'est technique"
          description="Ces écrans sont rendus avec les composants réels de l'application Waverti, alimentés par des données de démonstration."
        />
        <Tabs defaultValue="dashboard" className="mt-12 flex flex-col items-center gap-8">
          <TabsList aria-label="Écrans de l'application" className="max-w-full flex-wrap justify-center">
            <TabsTrigger value="dashboard">
              <LayoutDashboard aria-hidden="true" /> Tableau de bord
            </TabsTrigger>
            <TabsTrigger value="create">
              <ListPlus aria-hidden="true" /> Création
            </TabsTrigger>
            <TabsTrigger value="detail">
              <ScanSearch aria-hidden="true" /> Détail
            </TabsTrigger>
            <TabsTrigger value="history">
              <History aria-hidden="true" /> Historique
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell aria-hidden="true" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings aria-hidden="true" /> Paramètres
            </TabsTrigger>
          </TabsList>
          <div className="w-full max-w-6xl">
            <TabsContent value="dashboard">
              <BrowserFrame label="app.waverti — Vue d'ensemble" caption="Données fictives de démonstration">
                <div className="p-4 sm:p-6">
                  <OverviewView data={demoOverview} now={DEMO_NOW} cloudRelay renderLink={({ children, className }) => <span className={className}>{children}</span>} />
                </div>
              </BrowserFrame>
            </TabsContent>
            <TabsContent value="create">
              <BrowserFrame label="app.waverti — Nouvelle surveillance" caption="Aperçu non interactif">
                <div className="grid gap-6 p-4 sm:p-8 lg:grid-cols-[1.3fr_1fr]">
                  <fieldset disabled className="flex flex-col gap-5 rounded-xl border border-line bg-white p-6">
                    <legend className="sr-only">Exemple de formulaire</legend>
                    <Field id="demo-url" label="Adresse de la page">
                      {(p) => <Input {...p} defaultValue="https://boutique-exemple.fr/ordinateur-15" />}
                    </Field>
                    <Field id="demo-cond" label="M'alerter quand…">
                      {(p) => (
                        <Select {...p} defaultValue="price_below">
                          <option value="price_below">Le prix passe sous un seuil</option>
                        </Select>
                      )}
                    </Field>
                    <Field id="demo-threshold" label="Seuil (€)">
                      {(p) => <Input {...p} defaultValue="800" inputMode="decimal" />}
                    </Field>
                    <Field id="demo-freq" label="Fréquence" hint="Selon votre formule : toutes les 2 h en Pro.">
                      {(p) => (
                        <Select {...p} defaultValue="120">
                          <option value="120">Toutes les 2 heures</option>
                        </Select>
                      )}
                    </Field>
                  </fieldset>
                  <Card>
                    <CardHeader>
                      <CardTitle>Aperçu de la page</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-sm">
                      <p className="text-muted-fg">Résultat du contrôle initial :</p>
                      <dl className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-surface p-3">
                          <dt className="text-xs text-muted-fg">Prix détecté</dt>
                          <dd className="font-display text-lg font-semibold">899,00 €</dd>
                        </div>
                        <div className="rounded-lg bg-surface p-3">
                          <dt className="text-xs text-muted-fg">Disponibilité</dt>
                          <dd className="font-display text-lg font-semibold">En stock</dd>
                        </div>
                      </dl>
                      <p className="text-xs text-muted-fg">Source du prix : données structurées de la page (JSON-LD).</p>
                    </CardContent>
                  </Card>
                </div>
              </BrowserFrame>
            </TabsContent>
            <TabsContent value="detail">
              <BrowserFrame label="app.waverti — Ordinateur portable 15″" caption="Données fictives de démonstration">
                <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.4fr_1fr]">
                  <Card>
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle>Évolution du prix</CardTitle>
                      <MonitorStatusBadge monitor={demoMonitors[0]!} />
                    </CardHeader>
                    <CardContent>
                      <LineChart points={priceHistory} unit=" €" label="Évolution du prix sur 7 jours (données fictives)" formatValue={(v) => `${Math.round(v)} €`} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Règle</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm">
                      <p>
                        <Badge tone="info">Prix sous 800 €</Badge>
                      </p>
                      <p className="text-muted-fg">Vérifiée toutes les 2 heures, sur votre ordinateur avec relais cloud.</p>
                      <p className="text-muted-fg">Notifications : application, e-mail, bureau.</p>
                    </CardContent>
                  </Card>
                </div>
              </BrowserFrame>
            </TabsContent>
            <TabsContent value="history">
              <BrowserFrame label="app.waverti — Historique" caption="Données fictives de démonstration">
                <div className="p-4 sm:p-8">
                  <ResultTimeline results={demoResults} now={DEMO_NOW} />
                </div>
              </BrowserFrame>
            </TabsContent>
            <TabsContent value="notifications">
              <BrowserFrame label="app.waverti — Alertes" caption="Données fictives de démonstration">
                <div className="p-4 sm:p-6">
                  <NotificationList items={demoNotifications} now={DEMO_NOW} />
                </div>
              </BrowserFrame>
            </TabsContent>
            <TabsContent value="settings">
              <BrowserFrame label="app.waverti — Paramètres" caption="Aperçu non interactif">
                <div className="grid gap-4 p-4 sm:p-8 md:grid-cols-2">
                  {[
                    ["Alertes dans l'application", true],
                    ["Alertes par e-mail", true],
                    ["Notifications du bureau", true],
                    ["Démarrer avec l'ordinateur", false],
                  ].map(([label, on]) => (
                    <div key={label as string} className="flex items-center justify-between rounded-xl border border-line bg-white p-4">
                      <span className="text-sm font-medium">{label as string}</span>
                      <Switch checked={on as boolean} disabled aria-label={label as string} />
                    </div>
                  ))}
                </div>
              </BrowserFrame>
            </TabsContent>
          </div>
        </Tabs>
      </Container>
    </section>
  );
}

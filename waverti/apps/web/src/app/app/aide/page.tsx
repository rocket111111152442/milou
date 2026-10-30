import type { Metadata } from "next";
import Link from "next/link";
import { Accordion, AccordionItem, Button, Card, CardContent, PageHeader } from "@waverti/ui";
import { faqItems } from "@/components/marketing/faq";

export const metadata: Metadata = { title: "Aide" };

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Aide" description="Réponses aux questions fréquentes et contact de l'assistance." actions={<Button asChild variant="secondary"><Link href="/assistance">Contacter l'assistance</Link></Button>} />
      <Card>
        <CardContent className="pt-2">
          <Accordion type="single" collapsible>
            {faqItems.map((f, i) => (
              <AccordionItem key={f.q} value={`h-${i}`} question={f.q}>
                {f.a}
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

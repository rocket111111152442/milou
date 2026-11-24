"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/prospectos", label: "Prospectos" },
  { href: "/admin/citas", label: "Visitas" },
  { href: "/admin/notificaciones", label: "Notificaciones" },
  { href: "/admin/ajustes", label: "Configuración" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="CRM" className="overflow-x-auto px-2 pb-2 lg:px-3">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? "page" : undefined} className="flex min-h-[42px] items-center whitespace-nowrap rounded-xl px-3 text-sm font-medium text-navy-700 hover:bg-navy-50 aria-[current=page]:bg-navy aria-[current=page]:text-white">
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

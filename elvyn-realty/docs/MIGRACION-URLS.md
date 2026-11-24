# Migración de URLs (sitio AlterEstate actual → nuevo sitio)

Analizado el 24/11/2026 a partir de https://elvynarnaudrealty.com/sitemap.xml (205 URLs) y del menú.

| URL actual | Nueva URL | Tipo |
|---|---|---|
| `/` | `/` | igual |
| `/propiedades` | `/propiedades` | igual |
| `/propiedades?listing_type=1&…` | `/venta?…` | 308 (middleware) |
| `/propiedades?listing_type=2&…` | `/alquiler?…` | 308 (middleware) |
| `/propiedades?category=N&…` | `/propiedades?tipo=N` (o `/venta?tipo=N`) | 308 (middleware) |
| `/propiedad/{slug}` (193 fichas) | `/propiedad/{slug}` | igual |
| `/venta` | `/venta` | igual |
| `/rent` | `/alquiler` | 308 |
| `/vender-tu-propiedad` | `/vender-tu-propiedad` | igual (se ignoran los parámetros `_gl` de Google) |
| `/contacto` | `/contacto` | igual |
| `/agentes` | `/agentes` | igual |
| `/agente/elvyn-arnaud` | `/nosotros` | 308 |
| `/agente/{otro}` | `/agentes` | 308 |
| `/elvyn-arnaud-exprealty` | `/nosotros` | 308 |
| `/blog` (0 artículos) | `/` | 308 |
| `/testimonios` (0 testimonios) | `/` | 308 |
| — | `/servicios`, `/privacidad` | nuevas |
| — | `/en/…` (inglés) | nuevas |

`/propuestas/` estaba excluido en robots.txt del sitio actual; no se usa en el nuevo sitio.

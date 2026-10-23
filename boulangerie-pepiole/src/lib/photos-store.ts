import "server-only";
import { query } from "./db";

// Photos des produits ajoutés depuis /admin (table petrin_photos, contenu en base64, 4 Mo maximum).

export async function savePhoto(name: string, body: Buffer, contentType: string) {
  await query(
    `insert into petrin_photos (name, content_type, data) values ($1, $2, $3)
     on conflict (name) do update set content_type = excluded.content_type, data = excluded.data`,
    [name, contentType, body.toString("base64")],
  );
}

export async function readPhoto(name: string): Promise<{ body: Buffer; contentType: string } | null> {
  const { rows } = await query<{ content_type: string; data: string }>("select content_type, data from petrin_photos where name = $1", [name]);
  return rows[0] ? { body: Buffer.from(rows[0].data, "base64"), contentType: rows[0].content_type } : null;
}

/** Supprime toutes les photos ; renvoie leur nombre. */
export async function wipePhotos() {
  const { rowCount } = await query("delete from petrin_photos");
  return rowCount ?? 0;
}

import { ProductsScreen } from "@/components/admin/screens/Collections";
import { list } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [items, categories, occasions] = await Promise.all([list("products"), list("categories"), list("occasions")]);
  return <ProductsScreen items={items} categories={categories.sort((a, b) => a.sortOrder - b.sortOrder)} occasions={occasions.sort((a, b) => a.sortOrder - b.sortOrder)} />;
}

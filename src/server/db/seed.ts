/**
 * ⚠ DESTRUCTIVO: este seed **borra el catálogo**. Antes de sembrar elimina
 * físicamente todos los productos y después todas las categorías (ese orden: la
 * FK `products.category_id` es `onDelete: "restrict"`). Cualquier producto o
 * categoría creado a mano desde `/admin` se pierde, sin papelera. El bloque RBAC
 * (permisos, roles, matriz, super admin) es aditivo y no borra nada.
 * `audit_logs` no se toca: es append-only y `entity_id` no tiene FK.
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";

import type { PermissionCode } from "../../lib/permissions";
import {
  categories,
  permissions,
  products,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "./schema";
import type { NewProduct } from "./schema";

// Antes que cualquier import de valor de `./index` o de `../../lib/permissions`
// (que lo arrastra): ambos exigen DATABASE_URL al cargarse. Por eso los dos
// entran por `await import()` dentro de `main()`.
config({ path: ".env.local" });

type SystemRole = {
  slug: string;
  name: string;
  description: string;
  permissions: ReadonlyArray<PermissionCode>;
};

/**
 * Matriz explícita rol → permisos. El seed solo la **inicializa**
 * (`onConflictDoNothing`): a partir de ahí se edita desde la UI y una corrida
 * nueva del seed no debe pisar esos cambios.
 */
function buildSystemRoles(all: PermissionCode[]): SystemRole[] {
  return [
    {
      slug: "super_admin",
      name: "Super administrador",
      description: "Control total, incluida la matriz de permisos de cada rol",
      permissions: all,
    },
    {
      slug: "admin",
      name: "Administrador",
      description: "Gestiona catálogo, usuarios y auditoría",
      permissions: all.filter((code) => code !== "roles.update_permissions"),
    },
    {
      slug: "manager",
      name: "Gerente",
      description: "Gestiona el catálogo completo y consulta la auditoría",
      permissions: [
        "categories.read",
        "categories.create",
        "categories.update",
        "categories.delete",
        "products.read",
        "products.create",
        "products.update",
        "products.delete",
        "audit.read",
      ],
    },
    {
      slug: "employee",
      name: "Empleado",
      description: "Edita el catálogo existente, sin crear ni eliminar",
      permissions: [
        "categories.read",
        "categories.update",
        "products.read",
        "products.update",
      ],
    },
    {
      slug: "audit",
      name: "Auditor",
      description: "Solo lectura del catálogo y de la bitácora",
      permissions: ["categories.read", "products.read", "audit.read"],
    },
    {
      slug: "customer",
      name: "Cliente",
      description: "Rol por defecto de todo usuario nuevo, sin acceso al panel",
      permissions: [],
    },
  ];
}

const catalogCategories = [
  { name: "Laptops", slug: "laptops" },
  { name: "Teclados", slug: "teclados" },
  { name: "Monitores", slug: "monitores" },
  { name: "Audio", slug: "audio" },
  { name: "Almacenamiento", slug: "almacenamiento" },
] as const;

/**
 * Catálogo del diseño (`docs/design/Catalogo.dc.html`). `id` es a la vez `slug`
 * y base del `sku`. `image`: URL remota (foto real de Unsplash) o `null` para
 * usar la foto local `public/products/<id>.jpg`. 5 categorías × 5 productos.
 */
const catalogProducts = [
  {
    id: "xps13",
    name: "Dell XPS 13",
    brand: "Dell",
    category: "laptops",
    priceCents: 549900,
    compareAtPriceCents: 599900,
    stock: 12,
    spec: "Core i7 · 16 GB · 512 GB",
    image: null,
  },
  {
    id: "ideapad",
    name: "Lenovo IdeaPad Gaming 3",
    brand: "Lenovo",
    category: "laptops",
    priceCents: 399900,
    compareAtPriceCents: null,
    stock: 7,
    spec: "Ryzen 7 · RTX 3050 · 120 Hz",
    image: null,
  },
  {
    id: "macbook-air-m2",
    name: "Apple MacBook Air M2",
    brand: "Apple",
    category: "laptops",
    priceCents: 649900,
    compareAtPriceCents: null,
    stock: 10,
    spec: 'M2 · 13.6" · 8 GB · 256 GB',
    image:
      "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "spectre-x360",
    name: "HP Spectre x360 14",
    brand: "HP",
    category: "laptops",
    priceCents: 579900,
    compareAtPriceCents: 629900,
    stock: 6,
    spec: "Core i7 · 16 GB · OLED táctil",
    image:
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "rog-g14",
    name: "ASUS ROG Zephyrus G14",
    brand: "ASUS",
    category: "laptops",
    priceCents: 749900,
    compareAtPriceCents: null,
    stock: 5,
    spec: "Ryzen 9 · RTX 4060 · 165 Hz",
    image:
      "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "k2",
    name: "Keychron K2",
    brand: "Keychron",
    category: "teclados",
    priceCents: 42900,
    compareAtPriceCents: 49900,
    stock: 30,
    spec: "75% · switch marrón",
    image: null,
  },
  {
    id: "mxkeys",
    name: "Logitech MX Keys",
    brand: "Logitech",
    category: "teclados",
    priceCents: 39900,
    compareAtPriceCents: null,
    stock: 0,
    spec: "Bajo perfil · multidispositivo",
    image: null,
  },
  {
    id: "magic-keyboard",
    name: "Apple Magic Keyboard",
    brand: "Apple",
    category: "teclados",
    priceCents: 39900,
    compareAtPriceCents: null,
    stock: 18,
    spec: "Inalámbrico · Touch ID",
    image:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "blackwidow-v4",
    name: "Razer BlackWidow V4 Pro",
    brand: "Razer",
    category: "teclados",
    priceCents: 89900,
    compareAtPriceCents: 99900,
    stock: 12,
    spec: "Switch verde · RGB Chroma",
    image:
      "https://images.unsplash.com/photo-1560762484-813fc97650a0?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "k70-rgb",
    name: "Corsair K70 RGB PRO",
    brand: "Corsair",
    category: "teclados",
    priceCents: 74900,
    compareAtPriceCents: null,
    stock: 14,
    spec: "MX Red · marco de aluminio",
    image:
      "https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "ug27",
    name: 'LG UltraGear 27"',
    brand: "LG",
    category: "monitores",
    priceCents: 129900,
    compareAtPriceCents: 149900,
    stock: 9,
    spec: "QHD · 165 Hz · 1 ms",
    image: null,
  },
  {
    id: "odyssey-g7",
    name: 'Samsung Odyssey G7 32"',
    brand: "Samsung",
    category: "monitores",
    priceCents: 449900,
    compareAtPriceCents: 499900,
    stock: 7,
    spec: "QHD curvo · 240 Hz · 1 ms",
    image:
      "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "u2723qe",
    name: "Dell UltraSharp U2723QE",
    brand: "Dell",
    category: "monitores",
    priceCents: 289900,
    compareAtPriceCents: null,
    stock: 8,
    spec: '27" · 4K · IPS Black · USB-C',
    image:
      "https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "lg-27up850",
    name: "LG 27UP850N",
    brand: "LG",
    category: "monitores",
    priceCents: 199900,
    compareAtPriceCents: 239900,
    stock: 10,
    spec: '27" · 4K · HDR400 · USB-C 90 W',
    image:
      "https://images.unsplash.com/photo-1616763355603-9755a640a287?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "studio-display",
    name: "Apple Studio Display",
    brand: "Apple",
    category: "monitores",
    priceCents: 899900,
    compareAtPriceCents: null,
    stock: 4,
    spec: '27" · 5K · P3 · 600 nits',
    image:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "xm5",
    name: "Sony WH-1000XM5",
    brand: "Sony",
    category: "audio",
    priceCents: 179900,
    compareAtPriceCents: null,
    stock: 15,
    spec: "ANC · 30 h de batería",
    image: null,
  },
  {
    id: "airpods-max",
    name: "Apple AirPods Max",
    brand: "Apple",
    category: "audio",
    priceCents: 249900,
    compareAtPriceCents: null,
    stock: 9,
    spec: "ANC · audio espacial · USB-C",
    image:
      "https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "bose-qc-ultra",
    name: "Bose QuietComfort Ultra",
    brand: "Bose",
    category: "audio",
    priceCents: 219900,
    compareAtPriceCents: 249900,
    stock: 11,
    spec: "ANC · audio inmersivo · 24 h",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "hd560s",
    name: "Sennheiser HD 560S",
    brand: "Sennheiser",
    category: "audio",
    priceCents: 89900,
    compareAtPriceCents: null,
    stock: 13,
    spec: "Abierto · 120 Ω · referencia",
    image:
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "airpods-pro-2",
    name: "Apple AirPods Pro (2ª gen)",
    brand: "Apple",
    category: "audio",
    priceCents: 119900,
    compareAtPriceCents: 129900,
    stock: 20,
    spec: "ANC adaptativo · USB-C",
    image:
      "https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "980pro",
    name: "Samsung 980 Pro 1TB",
    brand: "Samsung",
    category: "almacenamiento",
    priceCents: 49900,
    compareAtPriceCents: 59900,
    stock: 25,
    spec: "NVMe PCIe 4.0 · 7000 MB/s",
    image: null,
  },
  {
    id: "sn850x-2tb",
    name: "WD Black SN850X 2TB",
    brand: "Western Digital",
    category: "almacenamiento",
    priceCents: 89900,
    compareAtPriceCents: 109900,
    stock: 16,
    spec: "NVMe PCIe 4.0 · 7300 MB/s",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "t7-shield-1tb",
    name: "Samsung T7 Shield 1TB",
    brand: "Samsung",
    category: "almacenamiento",
    priceCents: 54900,
    compareAtPriceCents: null,
    stock: 22,
    spec: "SSD portátil · USB 3.2 · IP65",
    image:
      "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "barracuda-2tb",
    name: "Seagate Barracuda 2TB",
    brand: "Seagate",
    category: "almacenamiento",
    priceCents: 29900,
    compareAtPriceCents: 34900,
    stock: 19,
    spec: 'HDD 3.5" · 7200 rpm · SATA',
    image:
      "https://images.unsplash.com/photo-1601737487795-dab272f52420?w=800&q=80&fit=crop&auto=format",
  },
  {
    id: "wd-blue-1tb",
    name: "WD Blue 1TB",
    brand: "Western Digital",
    category: "almacenamiento",
    priceCents: 19900,
    compareAtPriceCents: null,
    stock: 25,
    spec: 'HDD 3.5" · 7200 rpm · SATA',
    image:
      "https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=800&q=80&fit=crop&auto=format",
  },
] as const;

/**
 * Borra y vuelve a sembrar el catálogo en una sola transacción: si el insert
 * falla, la tienda no se queda vacía. Cada corrida deja exactamente estas 5
 * categorías y estos 25 productos (5 por categoría).
 */
async function seedCatalog(
  db: (typeof import("./index"))["db"],
): Promise<void> {
  console.warn(
    "⚠ db:seed BORRA el catálogo existente (productos y categorías) antes de sembrar el del diseño.",
  );

  const result = await db.transaction(async (tx) => {
    // Productos primero: la FK products.category_id es `restrict`.
    const removedProducts = await tx
      .delete(products)
      .returning({ id: products.id });
    const removedCategories = await tx
      .delete(categories)
      .returning({ id: categories.id });

    const insertedCategories = await tx
      .insert(categories)
      .values(catalogCategories.map((category) => ({ ...category })))
      .returning({ id: categories.id, slug: categories.slug });

    const categoryIdBySlug = new Map(
      insertedCategories.map((row) => [row.slug, row.id]),
    );

    const rows: NewProduct[] = catalogProducts.map((product) => {
      const categoryId = categoryIdBySlug.get(product.category);

      if (!categoryId) {
        throw new Error(`Categoría ${product.category} no sembrada`);
      }

      return {
        categoryId,
        sku: product.id.toUpperCase(),
        name: product.name,
        slug: product.id,
        priceCents: product.priceCents,
        compareAtPriceCents: product.compareAtPriceCents,
        stock: product.stock,
        brand: product.brand,
        specs: { resumen: product.spec },
        imageUrl: product.image ?? `/products/${product.id}.jpg`,
      };
    });

    const insertedProducts = await tx
      .insert(products)
      .values(rows)
      .returning({ id: products.id });

    return {
      removedProducts: removedProducts.length,
      removedCategories: removedCategories.length,
      categories: insertedCategories.length,
      products: insertedProducts.length,
    };
  });

  console.log(
    `Catálogo sembrado: borrados ${result.removedProducts} productos y ${result.removedCategories} categorías; insertadas ${result.categories} categorías y ${result.products} productos.`,
  );
}

async function main(): Promise<void> {
  const { db } = await import("./index");
  const { PERMISSIONS } = await import("../../lib/permissions");

  const permissionCodes = Object.keys(PERMISSIONS) as PermissionCode[];
  const systemRoles = buildSystemRoles(permissionCodes);

  await db
    .insert(permissions)
    .values(permissionCodes.map((code) => ({ code, ...PERMISSIONS[code] })))
    .onConflictDoNothing();

  await db
    .insert(roles)
    .values(
      systemRoles.map(({ slug, name, description }) => ({
        slug,
        name,
        description,
        isSystem: true,
      })),
    )
    .onConflictDoNothing();

  const permissionRows = await db
    .select({ id: permissions.id, code: permissions.code })
    .from(permissions);
  const roleRows = await db
    .select({ id: roles.id, slug: roles.slug })
    .from(roles);

  const permissionIdByCode = new Map(
    permissionRows.map((row) => [row.code, row.id]),
  );
  const roleIdBySlug = new Map(roleRows.map((row) => [row.slug, row.id]));

  const matrix = systemRoles.flatMap((role) => {
    const roleId = roleIdBySlug.get(role.slug);

    return roleId
      ? role.permissions.flatMap((code) => {
          const permissionId = permissionIdByCode.get(code);
          return permissionId ? [{ roleId, permissionId }] : [];
        })
      : [];
  });

  if (matrix.length > 0) {
    await db.insert(rolePermissions).values(matrix).onConflictDoNothing();
  }

  await assignSuperAdmin(db, roleIdBySlug.get("super_admin"));

  console.log(
    `Seed listo: ${permissionRows.length} permisos, ${roleRows.length} roles, ${matrix.length} pares rol-permiso.`,
  );

  await seedCatalog(db);
}

/**
 * Solo puede asignarse si el usuario ya se registró: `users` se puebla por
 * webhook. Si aún no existe, se vuelve a correr el seed tras el alta.
 */
async function assignSuperAdmin(
  db: (typeof import("./index"))["db"],
  roleId: string | undefined,
): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;

  if (!email || !roleId) {
    console.warn(
      "SUPER_ADMIN_EMAIL sin definir: no se asignó el rol super_admin.",
    );
    return;
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.warn(
      `Sin usuario con email ${email} en la base: regístralo y vuelve a correr el seed.`,
    );
    return;
  }

  await db
    .insert(userRoles)
    .values({ userId: user.id, roleId })
    .onConflictDoNothing();

  console.log(`Rol super_admin asignado a ${email}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Seed fallido", error);
    process.exit(1);
  });

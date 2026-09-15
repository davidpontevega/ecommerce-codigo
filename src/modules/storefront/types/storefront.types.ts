import type {
  ProductDto,
  ProductWithCategory,
} from "@/modules/products/types/product.types";

/**
 * Lo que devuelve `findBySlug()` para la ficha: la fila del repositorio (fechas
 * `Date`, no ISO: nunca pasa por `NextResponse.json`) más el slug de la
 * categoría, que el breadcrumb necesita y `productSelection` no trae.
 */
export type ProductDetail = ProductWithCategory & { categorySlug: string };

/** Lo que la tienda enseña de un producto: nada de SKU, stock interno ni fechas. */
export type StorefrontProduct = Pick<
  ProductDto,
  | "id"
  | "name"
  | "slug"
  | "brand"
  | "description"
  | "priceCents"
  | "compareAtPriceCents"
  | "stock"
  | "specs"
  | "imageUrl"
  | "categoryName"
>;

/**
 * Línea del carrito efímero (spec 006). 008 la mueve a `cart_items`.
 *
 * `stock` es una foto del momento de agregar: el tope lo aplican `add`/`setQty`
 * en el store, no cada llamador. `<CartDrawer>` es el segundo llamador de
 * `setQty` y sin esto sube sin techo (spec 007, D3).
 */
export type CartLine = Pick<
  StorefrontProduct,
  "id" | "name" | "slug" | "priceCents" | "imageUrl" | "stock"
> & { qty: number };

/** `categorySlug` se resuelve en la página con las categorías ya leídas. */
export type HeroSlide = StorefrontProduct & {
  index: string;
  categorySlug: string | null;
};

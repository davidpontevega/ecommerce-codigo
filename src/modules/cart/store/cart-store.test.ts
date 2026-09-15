import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import type { CartLine } from "@/modules/storefront/types/storefront.types";

import { cartCount, cartSubtotalCents, useCartStore } from "./cart-store";

type NewCartLine = Omit<CartLine, "qty">;

// Andamiaje (docs/testing/candidatas-pruebas-unitarias.md §6).
//
// Aislamiento resuelto: `useCartStore` es un singleton de módulo, pero
// `persist` (zustand) ya tolera un entorno sin `localStorage` por su cuenta
// (loguea un aviso y sigue en memoria) — no hace falta ningún polyfill. Lo
// único que hacía falta era resetear `lines` entre casos, con `beforeEach`.
// El aviso "[zustand persist middleware] Unable to update item 'cart', the
// given storage is currently unavailable." en la salida es esperado y
// inofensivo: solo dice que no persiste a disco, no que falle el test.

function makeProduct(overrides: Partial<NewCartLine> = {}): NewCartLine {
  return {
    id: "p1",
    name: "Producto",
    slug: "producto",
    priceCents: 1000,
    imageUrl: null,
    stock: 3,
    ...overrides,
  };
}

beforeEach(() => {
  // Merge, no `replace: true`: reemplazar el estado entero borraría también
  // `add`/`setQty`/`clear` de la store (justo el bug que esto encontró).
  useCartStore.setState({ lines: [] });
});

describe("cartCount", () => {
  test("lines vacío -> 0", () => {
    assert.equal(cartCount([]), 0);
  });

  test("suma qty de todas las líneas, no la cantidad de líneas", () => {
    const lines = [
      { ...makeProduct({ id: "1" }), qty: 3 },
      { ...makeProduct({ id: "2" }), qty: 2 },
    ];
    assert.equal(cartCount(lines), 5);
  });
});

describe("cartSubtotalCents", () => {
  test("lines vacío -> 0", () => {
    assert.equal(cartSubtotalCents([]), 0);
  });

  test("suma priceCents * qty de cada línea, en centavos enteros", () => {
    const lines = [
      { ...makeProduct({ id: "1", priceCents: 1000 }), qty: 2 },
      { ...makeProduct({ id: "2", priceCents: 500 }), qty: 3 },
    ];
    assert.equal(cartSubtotalCents(lines), 1000 * 2 + 500 * 3);
  });
});

describe("useCartStore.add", () => {
  test("producto nuevo con stock > 0 -> crea línea con qty 1", () => {
    useCartStore.getState().add(makeProduct({ stock: 5 }));
    assert.deepEqual(
      useCartStore.getState().lines.map((line) => [line.id, line.qty]),
      [["p1", 1]],
    );
  });

  test("producto nuevo con stock 0 -> no crea línea", () => {
    useCartStore.getState().add(makeProduct({ stock: 0 }));
    assert.equal(useCartStore.getState().lines.length, 0);
  });

  test("producto ya en el carrito -> suma 1 a qty", () => {
    useCartStore.getState().add(makeProduct({ stock: 5 }));
    useCartStore.getState().add(makeProduct({ stock: 5 }));
    assert.equal(useCartStore.getState().lines[0]?.qty, 2);
  });

  test("producto ya en el carrito al tope de stock -> qty no sube más", () => {
    useCartStore.getState().add(makeProduct({ stock: 1 }));
    useCartStore.getState().add(makeProduct({ stock: 1 }));
    assert.equal(useCartStore.getState().lines[0]?.qty, 1);
  });
});

describe("useCartStore.setQty", () => {
  beforeEach(() => {
    useCartStore.getState().add(makeProduct({ stock: 5 }));
  });

  test("qty dentro de rango -> se actualiza tal cual", () => {
    useCartStore.getState().setQty("p1", 3);
    assert.equal(useCartStore.getState().lines[0]?.qty, 3);
  });

  test("qty > stock -> se acota a stock", () => {
    useCartStore.getState().setQty("p1", 99);
    assert.equal(useCartStore.getState().lines[0]?.qty, 5);
  });

  test("qty <= 0 -> elimina la línea", () => {
    useCartStore.getState().setQty("p1", 0);
    assert.equal(useCartStore.getState().lines.length, 0);
  });

  test("id que no está en el carrito -> no cambia nada", () => {
    useCartStore.getState().setQty("no-existe", 2);
    assert.equal(useCartStore.getState().lines[0]?.qty, 1);
  });
});

describe("useCartStore.clear", () => {
  test("vacía lines sin importar cuántas líneas había", () => {
    useCartStore.getState().add(makeProduct({ id: "1", stock: 5 }));
    useCartStore.getState().add(makeProduct({ id: "2", stock: 5 }));
    useCartStore.getState().clear();
    assert.equal(useCartStore.getState().lines.length, 0);
  });
});

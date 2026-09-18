import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { fillSalesSeries, windowDays } from "./metrics.repository";

describe("windowDays", () => {
  test("ends on the given day and spans the requested length", () => {
    const days = windowDays("2026-09-18", 30);

    assert.equal(days.length, 30);
    assert.equal(days[0], "2026-08-20");
    assert.equal(days.at(-1), "2026-09-18");
  });

  test("crosses a month boundary without skipping or repeating a day", () => {
    assert.deepEqual(windowDays("2026-03-02", 4), [
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });
});

describe("fillSalesSeries", () => {
  // AC2: el `GROUP BY` no devuelve fila para un día sin ventas; el chart la
  // necesita como 0 o la línea sale entrecortada.
  test("fills days without sales with zero and keeps the window order", () => {
    assert.deepEqual(
      fillSalesSeries(["2026-09-16", "2026-09-17", "2026-09-18"], [
        { date: "2026-09-18", totalCents: 4500 },
        { date: "2026-09-16", totalCents: 1200 },
      ]),
      [
        { date: "2026-09-16", totalCents: 1200 },
        { date: "2026-09-17", totalCents: 0 },
        { date: "2026-09-18", totalCents: 4500 },
      ],
    );
  });

  test("ignores rows outside the window", () => {
    assert.deepEqual(
      fillSalesSeries(
        ["2026-09-18"],
        [
          { date: "2026-07-01", totalCents: 999 },
          { date: "2026-09-18", totalCents: 100 },
        ],
      ),
      [{ date: "2026-09-18", totalCents: 100 }],
    );
  });
});

/**
 * Constantes de negocio compartidas por servidor y cliente. Sin imports: lo que
 * se declare aquí puede viajar a un componente cliente sin arrastrar `db`.
 */

/**
 * Umbral fijo de stock bajo (spec 015 D4 / 016 D1): es un aviso, no una
 * configuración. Lo leen el Tablero (`metrics.repository`) e Inventario.
 */
export const LOW_STOCK_THRESHOLD = 5;

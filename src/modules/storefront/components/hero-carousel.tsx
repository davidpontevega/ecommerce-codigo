"use client";

import { ArrowUpRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { A11y, Autoplay, Keyboard, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { discountPercent, formatPrice } from "@/lib/utils";
import { ProductImage } from "@/modules/storefront/components/product-image";
import type { HeroSlide } from "@/modules/storefront/types/storefront.types";

import "swiper/css";
import "swiper/css/pagination";

// El CSS de Swiper llega sin `@layer`, así que gana a las utilidades de
// Tailwind: los dots se estilan con las variables que el propio Swiper expone.
const swiperTheme = {
  "--swiper-pagination-color": "var(--brand)",
  "--swiper-pagination-bullet-inactive-color": "var(--foreground)",
  "--swiper-pagination-bullet-inactive-opacity": "0.3",
  "--swiper-pagination-bullet-size": "8px",
  "--swiper-pagination-bottom": "20px",
} as React.CSSProperties;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const reduced = useReducedMotion();

  return (
    <Swiper
      modules={[Autoplay, Pagination, Keyboard, A11y]}
      style={swiperTheme}
      className="border-storefront-border bg-storefront-card h-full w-full min-w-0 overflow-hidden rounded-[26px] border"
      slidesPerView={1}
      loop={slides.length > 1}
      keyboard={{ enabled: true }}
      pagination={{ clickable: true }}
      // Sin autoplay cuando el sistema pide menos movimiento (AC8).
      autoplay={
        reduced ? false : { delay: 6000, disableOnInteraction: false }
      }
    >
      {slides.map((slide, index) => {
        const discount = discountPercent(
          slide.priceCents,
          slide.compareAtPriceCents,
        );
        const Heading = index === 0 ? "h1" : "p";

        return (
          <SwiperSlide key={slide.id}>
            <div className="grid items-center gap-6 px-6 pt-8 pb-14 sm:px-10 sm:pt-11 md:grid-cols-2 md:pb-16">
              <div className="min-w-0">
                <span className="border-storefront-border bg-storefront-card text-muted-foreground inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold">
                  <span className="bg-brand size-1.5 rounded-full" />
                  {slide.categoryName}
                </span>

                <Heading className="mt-5 text-[34px] leading-[1.02] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[58px]">
                  {slide.name}
                </Heading>

                <div className="mt-6 flex items-center gap-4">
                  <span className="text-muted-foreground font-mono text-xl sm:text-2xl">
                    {slide.index}
                  </span>
                  <span className="bg-storefront-border hidden h-px flex-1 sm:block" />
                  <span className="text-muted-foreground max-w-[190px] text-[13px] leading-relaxed">
                    {slide.description ?? slide.brand ?? "Disponible ahora"}
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-2xl font-semibold">
                    {formatPrice(slide.priceCents)}
                  </span>
                  {slide.compareAtPriceCents ? (
                    <span className="text-muted-foreground font-mono text-sm line-through">
                      {formatPrice(slide.compareAtPriceCents)}
                    </span>
                  ) : null}
                  {discount !== null ? (
                    <span className="bg-brand text-brand-foreground rounded-full px-2.5 py-1 font-mono text-xs font-semibold">
                      -{discount} %
                    </span>
                  ) : null}
                </div>

                <Link
                  href={
                    slide.categorySlug
                      ? `/products?category=${slide.categorySlug}`
                      : "/products"
                  }
                  className="bg-brand text-brand-foreground mt-8 inline-flex h-13 items-center gap-2.5 rounded-full py-0 pr-2 pl-6 text-[15px] font-semibold"
                >
                  Ver {slide.categoryName.toLowerCase()}
                  <span className="grid size-9 place-items-center rounded-full bg-white/20">
                    <ArrowUpRight className="size-4" />
                  </span>
                </Link>
              </div>

              <div className="hidden place-items-center md:grid">
                <ProductImage
                  name={slide.name}
                  imageUrl={slide.imageUrl}
                  className="w-full max-w-[290px] rounded-[26px]"
                />
              </div>
            </div>
          </SwiperSlide>
        );
      })}
    </Swiper>
  );
}

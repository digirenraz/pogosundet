import Image from "next/image";

interface HeroProps {
  /** Path to hero image (relative to /public). Defaults to the login hero. */
  imageSrc?: string;
  /** Hero image height in px. Defaults to 320 (the original design height). */
  height?: number;
}

// Hero illustration (320px by default) with a gradient fade at the bottom and
// the app logo floating over the edge — matches the Banani login screen design.
export function Hero({ imageSrc = "/hero-login.jpg", height = 320 }: HeroProps) {
  return (
    <>
      {/* Hero illustration */}
      <div className="w-full relative flex-shrink-0" style={{ height }}>
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        {/* Gradient that fades the image into the page background */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--color-background) 95%)",
          }}
        />
      </div>

      {/*
        Logo — overlaps the bottom edge of the hero by half its height (36px).
        `relative z-10`: without an explicit position, this box paints *behind*
        the hero above it in CSS's stacking order (the hero's `relative` makes
        it a positioned element, and positioned elements paint after
        non-positioned siblings regardless of DOM order) — the hero image was
        visibly clipping the top of this badge.
      */}
      <div
        data-testid="hero-logo"
        className="relative z-10 overflow-hidden border-4 border-background shadow-lg mx-auto -mt-9"
        style={{ width: 72, height: 72, borderRadius: 20 }}
      >
        <Image src="/icon-512.png" alt="" fill sizes="72px" className="object-cover" />
      </div>
    </>
  );
}

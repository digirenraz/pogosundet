import Image from "next/image";
import { Swords } from "lucide-react";

interface HeroProps {
  /** Path to hero image (relative to /public). Defaults to the login hero. */
  imageSrc?: string;
}

// 320px hero illustration with a gradient fade at the bottom and the app logo
// floating over the edge — matches the Banani login screen design.
export function Hero({ imageSrc = "/hero-login.jpg" }: HeroProps) {
  return (
    <>
      {/* Hero illustration */}
      <div className="w-full h-80 relative flex-shrink-0">
        <Image
          src={imageSrc}
          alt=""
          fill
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

      {/* Logo — overlaps the bottom edge of the hero by half its height (36px) */}
      <div
        className="flex items-center justify-center bg-primary border-4 border-background shadow-lg mx-auto -mt-9"
        style={{ width: 72, height: 72, borderRadius: 20 }}
      >
        <Swords size={32} className="text-primary-foreground" />
      </div>
    </>
  );
}

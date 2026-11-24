import Image from "next/image";
import logo from "../../../public/brand/logo.png";
import logoWhite from "../../../public/brand/logo-white.png";

export function Logo({ variant = "color", className = "", priority = false }: { variant?: "color" | "white"; className?: string; priority?: boolean }) {
  return (
    <Image
      src={variant === "white" ? logoWhite : logo}
      alt="Elvyn Arnaud Realty Group"
      className={`h-auto w-auto ${className}`}
      priority={priority}
      sizes="180px"
    />
  );
}

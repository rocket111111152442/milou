import { Fraunces, Inter } from "next/font/google";

export const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
export const fontDisplay = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["opsz"] });

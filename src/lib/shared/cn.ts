import { twMerge } from "tailwind-merge";

type ClassValue = false | null | string | undefined;

export function cn(...values: ClassValue[]) {
  return twMerge(values.filter(Boolean).join(" "));
}

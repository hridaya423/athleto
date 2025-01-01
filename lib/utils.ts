import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatPlanName = (name: string): string => {
  return name
    .split(' ')
    .map(word => {
      if (word === '-' || word.toLowerCase() === 'plan') return word;
      return word
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    })
    .join(' ');
};
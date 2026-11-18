import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const appearanceSchema = z.strictObject({
  preset: z.enum(["japanese-ink", "minimal", "midnight", "custom"]),
  formatVersion: z.literal(1),
  background: hex,
  surface: hex,
  text: hex,
  muted: hex,
  accent: hex,
  onAccent: hex,
  border: hex,
  font: z.enum(["sans", "serif"]),
});
export type FormAppearance = z.infer<typeof appearanceSchema>;
export const appearancePresets: Record<"japanese-ink" | "minimal" | "midnight", FormAppearance> = {
  "japanese-ink": {
    preset: "japanese-ink",
    formatVersion: 1,
    background: "#F6F2EA",
    surface: "#FFFCF7",
    text: "#252521",
    muted: "#68645D",
    accent: "#9F382C",
    onAccent: "#FFFCF7",
    border: "#827A6E",
    font: "serif",
  },
  minimal: {
    preset: "minimal",
    formatVersion: 1,
    background: "#FFFFFF",
    surface: "#FFFFFF",
    text: "#171714",
    muted: "#68645D",
    accent: "#171714",
    onAccent: "#FFFFFF",
    border: "#827A6E",
    font: "sans",
  },
  midnight: {
    preset: "midnight",
    formatVersion: 1,
    background: "#191B19",
    surface: "#222521",
    text: "#ECE6D8",
    muted: "#B6B09F",
    accent: "#E1947C",
    onAccent: "#191B19",
    border: "#79816F",
    font: "sans",
  },
};
function luminance(value: string): number {
  const rgb = [1, 3, 5]
    .map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
export function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
export function readableInk(background: string): string {
  return contrast(background, "#171714") >= contrast(background, "#FCFAF6") ? "#171714" : "#FCFAF6";
}
export function customAppearance(background: string, accent: string): FormAppearance {
  hex.parse(background);
  hex.parse(accent);
  const text = readableInk(background);
  return {
    preset: "custom",
    formatVersion: 1,
    background,
    surface: background,
    text,
    muted: text,
    accent,
    onAccent: readableInk(accent),
    border: text,
    font: "sans",
  };
}

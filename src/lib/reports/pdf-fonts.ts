import path from "path";
import { Font } from "@react-pdf/renderer";

export const PDF_FONT_FAMILY = "NotoSansTC";

let registered = false;

/** Register CJK-capable fonts once (Helvetica cannot render 中文). */
export function ensurePdfFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "fonts");
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(dir, "NotoSansTC-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "NotoSansTC-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Avoid Latin hyphenation splitting CJK runs into tofu/garbled layout.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

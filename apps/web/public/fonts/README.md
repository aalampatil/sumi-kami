# Bundled brand fonts

Inter (variable weights 400–700) and Noto Serif JP (variable weights 400–600) are served locally as WOFF2 language subsets. Unicode ranges in `styles/fonts.css` let browsers request only the subsets required by the page text. The two Latin subsets are preloaded; Japanese subsets load when their glyphs are used. Total font files on disk are approximately 7.3 MB; they are not downloaded together by the browser.

The source definitions and binaries come from [Google Fonts](https://fonts.google.com/), using the CSS2 API and `fonts.gstatic.com`. Font redistribution notices are retained in `OFL-Inter.txt` and `OFL-NotoSerifJP.txt`, sourced from the corresponding [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl) directories. Both use the SIL Open Font License 1.1.

Runtime rendering does not request Google Fonts. The existing bundled Geist Mono remains the technical-value font. Display headings use Noto Serif JP with serif system fallbacks; product text uses Inter with system sans-serif fallbacks.

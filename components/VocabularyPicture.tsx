import type { CSSProperties } from "react";
import {
  beginnerVocabularySpritePosition,
  beginnerVocabularySpriteSize,
  beginnerVocabularySpriteSource,
  type BeginnerVocabularyImageKey,
} from "../lib/smartlingo-vocabulary-images";

export function VocabularyPicture({ imageKey, label, className = "" }: { imageKey: BeginnerVocabularyImageKey | null; label: string; className?: string }) {
  if (!imageKey) return <span className={`vocabulary-picture vocabulary-picture-fallback ${className}`} role="img" aria-label={`${label} · generic concept illustration`} style={{overflow:"hidden"}}><svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><rect width="100" height="100" rx="18" fill="#dff5eb"/><circle cx="50" cy="34" r="15" fill="#21a77d"/><path d="M21 79c5-21 18-31 29-31s24 10 29 31" fill="#087d62"/><path d="M18 21l9 3-6 7zm64 0-9 3 6 7zM50 8l4 9h-8z" fill="#f5b82e"/><circle cx="44" cy="32" r="2.5" fill="#fff"/><circle cx="56" cy="32" r="2.5" fill="#fff"/></svg></span>;
  const style = {
    backgroundImage: `url('${beginnerVocabularySpriteSource(imageKey)}')`,
    backgroundPosition: beginnerVocabularySpritePosition(imageKey),
    backgroundSize: beginnerVocabularySpriteSize(imageKey),
  } satisfies CSSProperties;
  return <span className={`vocabulary-picture ${className}`} role="img" aria-label={label} style={style}/>;
}

import type { CSSProperties } from "react";
import {
  beginnerVocabularySpritePosition,
  beginnerVocabularySpriteSource,
  type BeginnerVocabularyImageKey,
} from "../lib/smartlingo-vocabulary-images";

export function VocabularyPicture({ imageKey, label, className = "" }: { imageKey: BeginnerVocabularyImageKey | null; label: string; className?: string }) {
  if (!imageKey) return <span className={`vocabulary-picture vocabulary-picture-fallback ${className}`} aria-hidden="true">◇</span>;
  const style = {
    backgroundImage: `url('${beginnerVocabularySpriteSource(imageKey)}')`,
    backgroundPosition: beginnerVocabularySpritePosition(imageKey),
    backgroundSize: "400% 400%",
  } satisfies CSSProperties;
  return <span className={`vocabulary-picture ${className}`} role="img" aria-label={label} style={style}/>;
}

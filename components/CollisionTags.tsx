"use client";

import { createContext, useContext } from "react";

/**
 * ユーザーが作ったカスタムタグ名。閉じタグの衝突検出に使う。
 * AutoTextarea は ExampleCard などの奥にあるので、props を数段バケツリレー
 * するより context で配ったほうが素直。
 */
const CollisionTagsContext = createContext<string[]>([]);

export const CollisionTagsProvider = CollisionTagsContext.Provider;

export function useCollisionTags(): string[] {
  return useContext(CollisionTagsContext);
}

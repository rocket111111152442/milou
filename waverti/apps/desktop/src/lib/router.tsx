import * as React from "react";
import type { RenderLink } from "@waverti/ui/app";
import { native } from "./native";

/** Navigation interne minimale (pas d'URL réelle dans une application desktop). */
export interface RouterValue {
  path: string;
  navigate: (path: string) => void;
}

export const RouterContext = React.createContext<RouterValue>({ path: "/", navigate: () => undefined });

export function useRouter() {
  return React.useContext(RouterContext);
}

/** Les liens du tableau de bord web (/app/...) sont traduits ; le reste s'ouvre dans le navigateur. */
export function toLocalPath(href: string): string | null {
  if (/^https?:\/\//.test(href)) return null;
  const p = href.replace(/^\/app(?=\/|$)/, "") || "/";
  if (p.startsWith("/abonnement")) return null;
  return p;
}

export function useRenderLink(webBase: string): RenderLink {
  const { navigate } = useRouter();
  return React.useCallback<RenderLink>(
    ({ href, className, children, onClick, ...rest }) => (
      <a
        href={href}
        className={className}
        aria-current={rest["aria-current"]}
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
          const local = toLocalPath(href);
          if (local) navigate(local);
          else void native.openExternal(/^https?:/.test(href) ? href : `${webBase}${href}`);
        }}
      >
        {children}
      </a>
    ),
    [navigate, webBase],
  );
}

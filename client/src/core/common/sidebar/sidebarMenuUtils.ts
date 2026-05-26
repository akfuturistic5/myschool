/** Collect route paths declared on a sidebar item (including nested children). */
export function collectLinksFromItem(item: any): string[] {
  if (!item) return [];
  const links: string[] = [
    item.link,
    item.subLink1,
    item.subLink2,
    item.subLink3,
    item.subLink4,
    item.subLink5,
    item.subLink6,
    item.subLink7,
  ].filter((l): l is string => Boolean(l) && l !== "#");

  if (Array.isArray(item.submenuItems)) {
    for (const child of item.submenuItems) {
      links.push(...collectLinksFromItem(child));
    }
  }
  return links;
}

/** True when pathname equals the link or is a nested route under it. */
export function isPathActive(pathname: string, link?: string | null): boolean {
  if (!link || link === "#") return false;
  if (pathname === link) return true;
  return pathname.startsWith(`${link}/`);
}

export function itemMatchesPath(item: any, pathname: string): boolean {
  return collectLinksFromItem(item).some((link) => isPathActive(pathname, link));
}

/** True if this item or any nested child matches the current route. */
export function hasActiveDescendant(item: any, pathname: string): boolean {
  if (!item) return false;
  if (itemMatchesPath(item, pathname)) return true;
  if (!Array.isArray(item.submenuItems)) return false;
  return item.submenuItems.some((child: any) => hasActiveDescendant(child, pathname));
}

export type MenuOpenState = { subOpen: string; subsidebar: string };

/** Find which accordion menus should be open for the current route. */
export function findMenuOpenState(sidebarData: any[], pathname: string): MenuOpenState {
  let subOpen = "";
  let subsidebar = "";

  for (const section of sidebarData || []) {
    for (const title of section.submenuItems || []) {
      if (!title?.submenu || !Array.isArray(title.submenuItems)) {
        if (itemMatchesPath(title, pathname)) {
          return { subOpen, subsidebar };
        }
        continue;
      }

      for (const item of title.submenuItems) {
        if (Array.isArray(item.submenuItems)) {
          for (const subItem of item.submenuItems) {
            if (itemMatchesPath(subItem, pathname)) {
              return { subOpen: title.label, subsidebar: item.label };
            }
          }
        }
        if (itemMatchesPath(item, pathname)) {
          subOpen = title.label;
          subsidebar = Array.isArray(item.submenuItems) ? item.label : "";
          return { subOpen, subsidebar };
        }
      }

      if (itemMatchesPath(title, pathname)) {
        return { subOpen: title.label, subsidebar: "" };
      }
    }
  }

  return { subOpen, subsidebar };
}

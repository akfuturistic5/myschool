/**
 * Use with Ant Design DatePicker inside Bootstrap 5 filter dropdowns.
 * Renders the calendar panel inside `.dropdown-menu` so clicks on dates are not treated as "outside" the menu.
 */
export function getFilterDropdownPopupContainer(triggerNode: HTMLElement): HTMLElement {
  const menu = triggerNode.closest(".dropdown-menu");
  if (menu) return menu as HTMLElement;
  return document.body;
}

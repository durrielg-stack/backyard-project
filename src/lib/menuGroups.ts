// ── DB category → tab group mapping ─────────────────────────────────────────
// Shared between the On-Going order menu (MenuPanel) and the Operations
// Recipe page, so both filter menu items into the same Food/Drinks/Add-Ons/
// Others groups instead of drifting into separate category schemes.
export const MENU_GROUPS = [
  { id: 'food',    label: 'Food',    key: '1',
    cats: ['Meals','Pork','Starters','Chicken','Noodles','Seafood'] },
  { id: 'drinks',  label: 'Drinks',  key: '2',
    cats: ['Beer','Cocktails','Hard Drinks','Palit Bote','Non-Alcohol'] },
  { id: 'addons',  label: 'Add-Ons', key: '3',
    cats: ['Extra','Others'] },
  { id: 'others',  label: 'Others',  key: '4',
    cats: ['Cigarettes','Charges'] },
] as const

export type MenuGroupId = (typeof MENU_GROUPS)[number]['id']

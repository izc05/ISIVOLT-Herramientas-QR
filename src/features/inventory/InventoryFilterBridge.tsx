import { useEffect } from 'react';

export default function InventoryFilterBridge() {
  useEffect(() => {
    const applyExternalCategory = (event: Event) => {
      const key = (event as CustomEvent<string>).detail || 'all';
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('.rc34-category-filter button')];
      buttons.find((button) => button.dataset.category === key)?.click();
    };

    window.addEventListener('isivolt:set-presentation-category', applyExternalCategory);
    return () => window.removeEventListener('isivolt:set-presentation-category', applyExternalCategory);
  }, []);

  return null;
}

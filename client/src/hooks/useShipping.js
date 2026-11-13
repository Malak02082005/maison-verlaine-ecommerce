import { useEffect, useState } from 'react';
import { getCatalog } from '../api';

// Shipping rules from the server (so they're only defined in one place).
// Until they've loaded, the same defaults as the server are used.
let cached = null;

export function useShipping() {
  const [rules, setRules] = useState(cached || { freeShippingFrom: 100, shippingFee: 5 });

  useEffect(() => {
    if (cached) return;
    getCatalog()
      .then((c) => {
        cached = { freeShippingFrom: c.freeShippingFrom, shippingFee: c.shippingFee };
        setRules(cached);
      })
      .catch(() => {});
  }, []);

  return {
    ...rules,
    shippingFor: (subtotal) => (subtotal >= rules.freeShippingFrom ? 0 : rules.shippingFee),
  };
}
